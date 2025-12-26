const Anthropic = require('@anthropic-ai/sdk').default;
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Family context for accurate responses
const FAMILY_CONTEXT = `
# Young Family Context

## Family Members:
- David Young (husband/father) - works at Lendwise Mortgage
- Lisa Young (wife/mother) - works at City National Bank
- Jacob Young (son, 2 years old)
- Noah Young (son, 9 months old)
- Anita Young (David's mother) - owns 1135 S Hayworth Ave
- Coty A Coleman (David's aunt) - Pico Terrace Assisted Living

## Properties:
1. 1085 Acanto Pl, Los Angeles, CA 90049 (Primary Residence)
   - LADWP Account: 437 712 1509
2. 1808 Manning Ave #202, Los Angeles, CA 90025 (Rental)
3. 2224 Birchglen St, Unit 111, Simi Valley, CA 93063 (Condo)
4. 1135 S Hayworth Ave, Los Angeles, CA 90035 (Anita Young's)
`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { documentId, question } = req.body;

    if (!documentId) {
      return res.status(400).json({ error: 'documentId is required' });
    }

    // Fetch document metadata
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'Document not found', details: docError?.message });
    }

    if (!doc.file_path) {
      return res.status(400).json({ error: 'Document has no file_path - cannot access file' });
    }

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('family-vault')
      .download(doc.file_path);

    if (downloadError || !fileData) {
      return res.status(500).json({
        error: 'Failed to download document',
        details: downloadError?.message,
        file_path: doc.file_path
      });
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Determine media type
    let mediaType = 'application/pdf';
    if (doc.file_type) {
      if (doc.file_type.includes('image')) {
        mediaType = doc.file_type;
      } else if (doc.file_type.includes('pdf')) {
        mediaType = 'application/pdf';
      }
    }

    // Build the prompt
    const userQuestion = question || 'Please analyze this document and extract all key information including dates, amounts, account numbers, and any important details.';

    const systemPrompt = `You are Family Vault AI, analyzing a document for the Young family.

${FAMILY_CONTEXT}

You are looking at the document: "${doc.filename}"
Category: ${doc.category || 'Unknown'}
Provider: ${doc.provider || 'Unknown'}
Property: ${doc.property_address || 'Not specified'}

Analyze this document thoroughly and answer the user's question. Be specific with:
- Exact amounts and dates
- Account/policy numbers
- Due dates and deadlines
- Any action items or warnings
- Comparisons to previous periods if shown
- Rate breakdowns, usage details, or itemized charges`;

    // Call Claude with vision
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
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
              text: userQuestion,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No response from Claude');
    }

    // Optionally update the document's extracted_text field
    if (!doc.extracted_text) {
      await supabase
        .from('documents')
        .update({
          extracted_text: textContent.text.substring(0, 10000), // First 10k chars
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);
    }

    return res.status(200).json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        category: doc.category,
        provider: doc.provider,
      },
      question: userQuestion,
      analysis: textContent.text,
      model: response.model,
    });

  } catch (error) {
    console.error('Document analysis error:', error);
    return res.status(500).json({
      error: 'Failed to analyze document',
      message: error.message,
    });
  }
};
