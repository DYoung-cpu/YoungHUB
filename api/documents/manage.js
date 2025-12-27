const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk').default;
const { PDFDocument } = require('pdf-lib');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Family context for accurate analysis
const FAMILY_CONTEXT = `
# Young Family Context
## Family Members:
- David Young (husband/father) - works at Lendwise Mortgage
- Lisa Young (wife/mother) - works at City National Bank
- Jacob Young (son, 2 years old)
- Noah Young (son, 9 months old)
- Anita Young (David's mother) - owns 1135 S Hayworth Ave
- Coty A Coleman (David's aunt) - lives at Pico Terrace Assisted Living
- Marc D Young (David's brother) - joint investment account holder

## Properties:
1. 1085 Acanto Pl, Los Angeles, CA 90049 (Primary Residence)
2. 1808 Manning Ave #202, Los Angeles, CA 90025 (Rental)
3. 2224 Birchglen St, Unit 111, Simi Valley, CA 93063 (Condo)
4. 1135 S Hayworth Ave, Los Angeles, CA 90035 (Anita Young's)
`;

const AUDIT_PROMPT = `Analyze this document page for the Young family. Return ONLY valid JSON (no markdown):
{
  "page_type": "bill|statement|letter|form|legal|medical|tax|insurance|mortgage|other",
  "document_title": "extracted title if visible",
  "belongs_to_entity": "person or property name from family context",
  "provider": "company/organization name",
  "account_number": "if visible, otherwise null",
  "date": "YYYY-MM-DD if visible, otherwise null",
  "is_continuation": false,
  "key_amounts": [{"label": "description", "amount": 123.45}],
  "suggested_category": "insurance|mortgage|bank|utility|medical|tax|housing|legal|investment|other",
  "suggested_filename": "Provider_DocumentType_YYYY-MM.pdf",
  "issues": []
}

Known issues to flag in "issues" array:
- "mislabeled" - if filename doesn't match content
- "wrong_entity" - if assigned to wrong person/property
- "bundle_should_split" - if this page is from a different document than previous
- "missing_pages" - if document appears incomplete

${FAMILY_CONTEXT}`;

// ============================================
// PDF UTILITIES
// ============================================

async function splitPdf(pdfBytes, pageRanges) {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const results = [];

  for (const range of pageRanges) {
    const newDoc = await PDFDocument.create();
    const [start, end] = Array.isArray(range) ? range : [range, range];

    for (let i = start - 1; i < end && i < srcDoc.getPageCount(); i++) {
      const [page] = await newDoc.copyPages(srcDoc, [i]);
      newDoc.addPage(page);
    }

    const pdfBytes = await newDoc.save();
    results.push({ range: [start, end], pdfBytes });
  }

  return results;
}

async function combinePdfs(pdfBytesArray) {
  const mergedDoc = await PDFDocument.create();

  for (const pdfBytes of pdfBytesArray) {
    const srcDoc = await PDFDocument.load(pdfBytes);
    const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    pages.forEach(page => mergedDoc.addPage(page));
  }

  return await mergedDoc.save();
}

async function extractPages(pdfBytes, pageNumbers) {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const newDoc = await PDFDocument.create();

  for (const pageNum of pageNumbers) {
    if (pageNum > 0 && pageNum <= srcDoc.getPageCount()) {
      const [page] = await newDoc.copyPages(srcDoc, [pageNum - 1]);
      newDoc.addPage(page);
    }
  }

  return await newDoc.save();
}

async function getPdfPageCount(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes);
  return doc.getPageCount();
}

// ============================================
// DOCUMENT ANALYSIS
// ============================================

async function analyzeDocumentPage(pageBytes, pageNumber, filename, mediaType = 'application/pdf') {
  try {
    const base64 = Buffer.from(pageBytes).toString('base64');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: `This is page ${pageNumber} of "${filename}". ${AUDIT_PROMPT}`,
          },
        ],
      }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (textContent) {
      // Parse JSON from response, handling potential markdown wrapping
      let jsonStr = textContent.text.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }
      return JSON.parse(jsonStr);
    }
    return null;
  } catch (error) {
    console.error(`Error analyzing page ${pageNumber}:`, error.message);
    return { error: error.message, page: pageNumber };
  }
}

// ============================================
// ACTION HANDLERS
// ============================================

async function handleAudit(req, res) {
  const { documentId, documentIds, limit = 10 } = req.body;

  try {
    // Get documents to audit
    let query = supabase.from('documents').select('*');

    if (documentId) {
      query = query.eq('id', documentId);
    } else if (documentIds && documentIds.length > 0) {
      query = query.in('id', documentIds);
    } else {
      // Get documents that haven't been audited yet
      query = query.order('created_at', { ascending: false }).limit(limit);
    }

    const { data: documents, error } = await query;
    if (error) throw error;

    const results = [];

    for (const doc of documents) {
      console.log(`Auditing: ${doc.filename}`);

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('family-vault')
        .download(doc.file_path);

      if (downloadError) {
        results.push({ document_id: doc.id, filename: doc.filename, error: downloadError.message });
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);

      // Get page count
      let pageCount = 1;
      let pageResults = [];

      if (doc.file_type === 'application/pdf' || doc.filename.endsWith('.pdf')) {
        try {
          pageCount = await getPdfPageCount(pdfBytes);
          console.log(`  ${pageCount} pages detected`);

          // Analyze pages in batches of 20
          const batchSize = 20;
          for (let i = 0; i < pageCount; i += batchSize) {
            const batch = [];
            for (let j = i; j < Math.min(i + batchSize, pageCount); j++) {
              // Extract single page for analysis
              const pageBytes = await extractPages(pdfBytes, [j + 1]);
              const analysis = await analyzeDocumentPage(pageBytes, j + 1, doc.filename);

              // Store result
              if (analysis && !analysis.error) {
                await supabase.from('document_audit_results').upsert({
                  document_id: doc.id,
                  page_number: j + 1,
                  page_type: analysis.page_type,
                  document_title: analysis.document_title,
                  belongs_to_entity: analysis.belongs_to_entity,
                  provider: analysis.provider,
                  account_number: analysis.account_number,
                  document_date: analysis.date,
                  is_continuation: analysis.is_continuation,
                  key_amounts: analysis.key_amounts,
                  suggested_category: analysis.suggested_category,
                  suggested_filename: analysis.suggested_filename,
                  issues: analysis.issues,
                  raw_analysis: analysis,
                }, { onConflict: 'document_id,page_number' });
              }

              batch.push({ page: j + 1, ...analysis });
            }
            pageResults.push(...batch);
          }
        } catch (pdfError) {
          console.error(`  PDF processing error: ${pdfError.message}`);
          // Try analyzing as single image
          const analysis = await analyzeDocumentPage(pdfBytes, 1, doc.filename);
          pageResults.push({ page: 1, ...analysis });
        }
      } else {
        // Image file - analyze directly
        const mediaType = doc.file_type || 'image/png';
        const analysis = await analyzeDocumentPage(pdfBytes, 1, doc.filename, mediaType);
        pageResults.push({ page: 1, ...analysis });
      }

      // Detect if this is a bundle that should be split
      const bundleAnalysis = detectBundle(pageResults);

      results.push({
        document_id: doc.id,
        filename: doc.filename,
        current_category: doc.category,
        page_count: pageCount,
        pages: pageResults,
        bundle_detected: bundleAnalysis.isBundle,
        suggested_splits: bundleAnalysis.splits,
        issues: bundleAnalysis.issues,
      });
    }

    return res.status(200).json({
      success: true,
      documents_audited: results.length,
      results,
    });
  } catch (error) {
    console.error('Audit error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function detectBundle(pageResults) {
  const splits = [];
  const issues = [];
  let currentDoc = null;
  let currentStart = 1;

  for (let i = 0; i < pageResults.length; i++) {
    const page = pageResults[i];
    if (page.error) continue;

    // Check if this is a new document
    const isNewDoc = !page.is_continuation && i > 0;
    const differentProvider = currentDoc && page.provider !== currentDoc.provider;
    const differentType = currentDoc && page.page_type !== currentDoc.page_type;

    if (isNewDoc || (differentProvider && differentType)) {
      if (currentDoc) {
        splits.push({
          range: [currentStart, i],
          suggested_filename: currentDoc.suggested_filename || `Document_pages_${currentStart}-${i}.pdf`,
          provider: currentDoc.provider,
          category: currentDoc.suggested_category,
        });
      }
      currentStart = i + 1;
      currentDoc = page;
    } else if (!currentDoc) {
      currentDoc = page;
    }

    // Collect issues
    if (page.issues && page.issues.length > 0) {
      issues.push(...page.issues.map(issue => ({ page: i + 1, issue })));
    }
  }

  // Add final document
  if (currentDoc && pageResults.length > 0) {
    splits.push({
      range: [currentStart, pageResults.length],
      suggested_filename: currentDoc.suggested_filename || `Document_pages_${currentStart}-${pageResults.length}.pdf`,
      provider: currentDoc.provider,
      category: currentDoc.suggested_category,
    });
  }

  return {
    isBundle: splits.length > 1,
    splits,
    issues,
  };
}

async function handleSplit(req, res) {
  const { documentId, ranges, outputNames } = req.body;

  if (!documentId || !ranges || ranges.length === 0) {
    return res.status(400).json({ error: 'documentId and ranges required' });
  }

  try {
    // Get document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;

    // Download file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('family-vault')
      .download(doc.file_path);

    if (downloadError) throw downloadError;

    const arrayBuffer = await fileData.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);

    // Split PDF
    const splitResults = await splitPdf(pdfBytes, ranges);
    const createdDocs = [];

    for (let i = 0; i < splitResults.length; i++) {
      const { range, pdfBytes: newPdfBytes } = splitResults[i];
      const outputName = outputNames?.[i] || `${doc.filename.replace('.pdf', '')}_pages_${range[0]}-${range[1]}.pdf`;
      const filePath = `documents/${doc.category || 'other'}/${Date.now()}_${outputName}`;

      // Upload new PDF
      const { error: uploadError } = await supabase.storage
        .from('family-vault')
        .upload(filePath, newPdfBytes, { contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      // Create document record
      const { data: newDoc, error: insertError } = await supabase
        .from('documents')
        .insert({
          filename: outputName,
          original_filename: doc.original_filename,
          file_path: filePath,
          file_type: 'application/pdf',
          file_size: newPdfBytes.length,
          category: doc.category,
          property_address: doc.property_address,
          tags: [...(doc.tags || []), 'split-from-bundle'],
          supersedes_id: null,
          is_latest: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      createdDocs.push(newDoc);

      // Log history
      await supabase.from('document_history').insert({
        document_id: newDoc.id,
        action: 'split',
        old_values: { source_document: documentId, source_filename: doc.filename },
        new_values: { pages: range, filename: outputName },
        reason: 'Split from bundle document',
      });
    }

    // Archive original
    await supabase
      .from('documents')
      .update({ is_archived: true, tags: [...(doc.tags || []), 'archived-bundle'] })
      .eq('id', documentId);

    await supabase.from('document_history').insert({
      document_id: documentId,
      action: 'archive',
      old_values: { is_archived: false },
      new_values: { is_archived: true },
      reason: 'Original bundle archived after split',
    });

    return res.status(200).json({
      success: true,
      original_archived: true,
      created_documents: createdDocs,
    });
  } catch (error) {
    console.error('Split error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleCombine(req, res) {
  const { documentIds, outputName, category } = req.body;

  if (!documentIds || documentIds.length < 2) {
    return res.status(400).json({ error: 'At least 2 documentIds required' });
  }

  try {
    // Get documents
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .in('id', documentIds);

    if (docsError) throw docsError;

    // Download and combine
    const pdfBytesArray = [];
    for (const doc of docs) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('family-vault')
        .download(doc.file_path);

      if (downloadError) throw downloadError;

      const arrayBuffer = await fileData.arrayBuffer();
      pdfBytesArray.push(new Uint8Array(arrayBuffer));
    }

    const combinedBytes = await combinePdfs(pdfBytesArray);
    const finalName = outputName || `Combined_${Date.now()}.pdf`;
    const finalCategory = category || docs[0].category || 'other';
    const filePath = `documents/${finalCategory}/${Date.now()}_${finalName}`;

    // Upload combined PDF
    const { error: uploadError } = await supabase.storage
      .from('family-vault')
      .upload(filePath, combinedBytes, { contentType: 'application/pdf' });

    if (uploadError) throw uploadError;

    // Create document record
    const { data: newDoc, error: insertError } = await supabase
      .from('documents')
      .insert({
        filename: finalName,
        file_path: filePath,
        file_type: 'application/pdf',
        file_size: combinedBytes.length,
        category: finalCategory,
        tags: ['combined'],
        is_latest: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log history
    await supabase.from('document_history').insert({
      document_id: newDoc.id,
      action: 'merge',
      old_values: { source_documents: documentIds },
      new_values: { filename: finalName },
      reason: 'Combined multiple documents',
    });

    return res.status(200).json({
      success: true,
      created_document: newDoc,
      source_documents: docs.map(d => ({ id: d.id, filename: d.filename })),
    });
  } catch (error) {
    console.error('Combine error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleReorganize(req, res) {
  const { actions, preview = true } = req.body;

  if (!actions || actions.length === 0) {
    return res.status(400).json({ error: 'actions array required' });
  }

  const results = [];

  for (const action of actions) {
    try {
      if (preview) {
        // Just describe what would happen
        results.push({ action: action.type, document_id: action.documentId, preview: true, would_do: action });
        continue;
      }

      switch (action.type) {
        case 'rename':
          const { error: renameError } = await supabase
            .from('documents')
            .update({
              filename: action.newFilename,
              updated_at: new Date().toISOString(),
            })
            .eq('id', action.documentId);

          if (renameError) throw renameError;

          await supabase.from('document_history').insert({
            document_id: action.documentId,
            action: 'rename',
            old_values: { filename: action.oldFilename },
            new_values: { filename: action.newFilename },
            reason: action.reason || 'Renamed based on audit',
          });

          results.push({ action: 'rename', document_id: action.documentId, success: true });
          break;

        case 'recategorize':
          const { error: catError } = await supabase
            .from('documents')
            .update({
              category: action.newCategory,
              subcategory: action.newSubcategory,
              updated_at: new Date().toISOString(),
            })
            .eq('id', action.documentId);

          if (catError) throw catError;

          await supabase.from('document_history').insert({
            document_id: action.documentId,
            action: 'recategorize',
            old_values: { category: action.oldCategory },
            new_values: { category: action.newCategory, subcategory: action.newSubcategory },
            reason: action.reason || 'Recategorized based on audit',
          });

          results.push({ action: 'recategorize', document_id: action.documentId, success: true });
          break;

        case 'reassign':
          const { error: assignError } = await supabase
            .from('documents')
            .update({
              property_address: action.newPropertyAddress,
              family_member_id: action.newFamilyMemberId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', action.documentId);

          if (assignError) throw assignError;

          await supabase.from('document_history').insert({
            document_id: action.documentId,
            action: 'reassign',
            old_values: { property_address: action.oldPropertyAddress },
            new_values: { property_address: action.newPropertyAddress },
            reason: action.reason || 'Reassigned based on audit',
          });

          results.push({ action: 'reassign', document_id: action.documentId, success: true });
          break;

        default:
          results.push({ action: action.type, error: 'Unknown action type' });
      }
    } catch (error) {
      results.push({ action: action.type, document_id: action.documentId, error: error.message });
    }
  }

  return res.status(200).json({
    success: true,
    preview,
    results,
  });
}

async function handleAnalyze(req, res) {
  const { documentId, question } = req.body;

  if (!documentId) {
    return res.status(400).json({ error: 'documentId is required' });
  }

  try {
    // Fetch document metadata
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!doc.file_path) {
      return res.status(400).json({ error: 'Document has no file_path' });
    }

    // Download the file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('family-vault')
      .download(doc.file_path);

    if (downloadError || !fileData) {
      return res.status(500).json({ error: 'Failed to download document' });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    let mediaType = 'application/pdf';
    if (doc.file_type?.includes('image')) {
      mediaType = doc.file_type;
    }

    const userQuestion = question || 'Analyze this document and extract all key information.';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are analyzing a document for the Young family. Document: "${doc.filename}".
${FAMILY_CONTEXT}
Be specific with amounts, dates, account numbers, and action items.`,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: userQuestion },
        ],
      }],
    });

    const textContent = response.content.find(c => c.type === 'text');

    // Update extracted_text if not set
    if (!doc.extracted_text && textContent) {
      await supabase
        .from('documents')
        .update({ extracted_text: textContent.text.substring(0, 10000) })
        .eq('id', documentId);
    }

    return res.status(200).json({
      success: true,
      document: { id: doc.id, filename: doc.filename, category: doc.category },
      analysis: textContent?.text || 'No analysis generated',
    });
  } catch (error) {
    console.error('Analyze error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleAccounting(req, res) {
  try {
    // Get all documents
    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .eq('is_archived', false);

    if (error) throw error;

    // Aggregate by category
    const byCategory = {};
    const byProperty = {};
    const byPerson = {};
    const alerts = [];

    const now = new Date();

    for (const doc of documents) {
      // By category
      const cat = doc.category || 'uncategorized';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, total_size: 0, documents: [] };
      byCategory[cat].count++;
      byCategory[cat].total_size += doc.file_size || 0;
      byCategory[cat].documents.push({ id: doc.id, filename: doc.filename });

      // By property
      if (doc.property_address) {
        if (!byProperty[doc.property_address]) byProperty[doc.property_address] = { count: 0, categories: {} };
        byProperty[doc.property_address].count++;
        byProperty[doc.property_address].categories[cat] = (byProperty[doc.property_address].categories[cat] || 0) + 1;
      }

      // Check for alerts
      if (doc.expiration_date) {
        const expDate = new Date(doc.expiration_date);
        if (expDate < now) {
          alerts.push({ type: 'expired', document_id: doc.id, filename: doc.filename, expired: doc.expiration_date });
        } else if (expDate < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
          alerts.push({ type: 'expiring_soon', document_id: doc.id, filename: doc.filename, expires: doc.expiration_date });
        }
      }

      if (doc.due_date) {
        const dueDate = new Date(doc.due_date);
        if (dueDate < now) {
          alerts.push({ type: 'overdue', document_id: doc.id, filename: doc.filename, due: doc.due_date });
        } else if (dueDate < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          alerts.push({ type: 'due_soon', document_id: doc.id, filename: doc.filename, due: doc.due_date });
        }
      }
    }

    // Format sizes
    for (const cat in byCategory) {
      byCategory[cat].total_size = `${(byCategory[cat].total_size / (1024 * 1024)).toFixed(2)} MB`;
    }

    // Get documents pending review (no summary or extracted_data)
    const pendingReview = documents.filter(d => !d.summary && !d.extracted_data);

    // Get recent uploads
    const recentUploads = documents
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(d => ({ id: d.id, filename: d.filename, category: d.category, uploaded: d.created_at }));

    return res.status(200).json({
      success: true,
      summary: {
        total_documents: documents.length,
        total_size: `${(documents.reduce((sum, d) => sum + (d.file_size || 0), 0) / (1024 * 1024)).toFixed(2)} MB`,
        categories: Object.keys(byCategory).length,
        pending_review: pendingReview.length,
        alerts_count: alerts.length,
      },
      by_category: byCategory,
      by_property: byProperty,
      alerts,
      recent_uploads: recentUploads,
      pending_review: pendingReview.slice(0, 20).map(d => ({ id: d.id, filename: d.filename })),
    });
  } catch (error) {
    console.error('Accounting error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ============================================
// MAIN HANDLER
// ============================================

module.exports = async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action || req.body?.action;

  if (!action) {
    return res.status(400).json({
      error: 'action parameter required',
      available_actions: ['audit', 'split', 'combine', 'reorganize', 'accounting', 'analyze'],
    });
  }

  switch (action) {
    case 'audit':
      return handleAudit(req, res);
    case 'split':
      return handleSplit(req, res);
    case 'combine':
      return handleCombine(req, res);
    case 'reorganize':
      return handleReorganize(req, res);
    case 'accounting':
      return handleAccounting(req, res);
    case 'analyze':
      return handleAnalyze(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
};
