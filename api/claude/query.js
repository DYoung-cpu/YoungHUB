const Anthropic = require('@anthropic-ai/sdk').default;
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Keywords that indicate user wants deep document analysis
const ANALYSIS_KEYWORDS = [
  'analyze', 'breakdown', 'details', 'usage', 'consumption',
  'explain', 'what does', 'show me', 'review', 'look at',
  'read', 'examine', 'itemized', 'line by line', 'charges',
  'why is', 'how much', 'compare', 'tier', 'rate'
];

// Document type keywords for matching
const DOC_TYPE_KEYWORDS = {
  'electric': ['ladwp', 'dwp', 'electric', 'power', 'utility', 'electricity'],
  'mortgage': ['mortgage', 'loan', 'sps', 'crosscountry', 'rocket', 'freedom'],
  'insurance': ['insurance', 'mercury', 'policy', 'ho6', 'homeowner'],
  'tax': ['tax', 'property tax', 'assessment'],
  'bill': ['bill', 'statement', 'invoice', 'payment']
};

// Family context for accurate responses
const FAMILY_CONTEXT = `
# Young Family Context

## Family Members:
- David Young (husband/father) - works at Lendwise Mortgage, CA Real Estate Broker License #01371572
- Lisa Young (wife/mother) - works at City National Bank (Compliance)
- Jacob Young (son, 2 years old)
- Noah Young (son, 9 months old)
- Anita Young (David's mother) - owns 1135 S Hayworth Ave
- Coty A Coleman (David's aunt) - lives at Pico Terrace Assisted Living, SSA benefits $1,188/month, Medicare #7KH4-F70-KN94
- Marc D Young (David's brother) - joint investment account holder

## Properties:
1. 1085 Acanto Pl, Los Angeles, CA 90049 (Primary Residence)
   - Mortgage: SPS, Account #0034953794
   - HELOC: Mechanics Bank, Loan #0001166102, $272K limit
   - Insurance: Mercury/KW Specialty, Policy #1000017887HO

2. 1808 Manning Ave #202, Los Angeles, CA 90025 (Rental)
   - Mortgage: CrossCountry, Loan #0764193843
   - Monthly Payment: $2,353.71

3. 2224 Birchglen St, Unit 111, Simi Valley, CA 93063 (Condo)
   - Mortgage: Rocket Mortgage, Loan #0715348686
   - HO6 Insurance: EXPIRED - needs attention

4. 1135 S Hayworth Ave, Los Angeles, CA 90035 (Anita Young's)
   - Tenant at 1133: Steve Watson, $3,362/month

## Investment Account:
- J.P. Morgan JTWROS Account #767-44030 (David & Marc Young)
- Value: ~$410,892 (Nov 2025)
`;

// Helper function to check if question needs deep document analysis
function needsDocumentAnalysis(question) {
  const lowerQ = question.toLowerCase();
  return ANALYSIS_KEYWORDS.some(keyword => lowerQ.includes(keyword));
}

// Helper function to find the best matching document for a question
function findBestDocument(question, documents) {
  const lowerQ = question.toLowerCase();

  // Score each document based on keyword matches
  const scored = documents.map(doc => {
    let score = 0;
    const docText = `${doc.filename} ${doc.category} ${doc.provider} ${doc.property_address} ${(doc.tags || []).join(' ')}`.toLowerCase();

    // Check document type keywords
    for (const [type, keywords] of Object.entries(DOC_TYPE_KEYWORDS)) {
      if (keywords.some(k => lowerQ.includes(k))) {
        if (keywords.some(k => docText.includes(k))) {
          score += 10;
        }
      }
    }

    // Boost recent documents
    const docDate = new Date(doc.created_at);
    const daysSinceUpload = (Date.now() - docDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpload < 30) score += 5;
    if (daysSinceUpload < 7) score += 5;

    // Check for specific mentions
    if (lowerQ.includes('latest') || lowerQ.includes('recent') || lowerQ.includes('last')) {
      score += 3;
    }

    return { doc, score };
  });

  // Return highest scoring document if score > 5
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 5 ? scored[0].doc : null;
}

// Helper function to analyze a document with Claude Vision
async function analyzeDocument(doc, question) {
  if (!doc.file_path) {
    return null;
  }

  try {
    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('family-vault')
      .download(doc.file_path);

    if (downloadError || !fileData) {
      console.error('Failed to download document:', downloadError);
      return null;
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Determine media type
    let mediaType = 'application/pdf';
    if (doc.file_type?.includes('image')) {
      mediaType = doc.file_type;
    }

    // Call Claude with vision
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are analyzing a document for the Young family. Document: "${doc.filename}".
Answer the user's question with specific details from the document including exact amounts, dates, account numbers, usage breakdowns, and any itemized charges.`,
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
              text: question,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    return textContent?.text || null;
  } catch (error) {
    console.error('Document analysis error:', error);
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'No question provided' });
    }

    // Fetch relevant documents from Supabase
    const { data: documents, error: dbError } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // Check if this question needs deep document analysis
    let documentAnalysis = null;
    let analyzedDoc = null;

    if (needsDocumentAnalysis(question) && documents?.length > 0) {
      analyzedDoc = findBestDocument(question, documents);
      if (analyzedDoc) {
        console.log(`Analyzing document: ${analyzedDoc.filename}`);
        documentAnalysis = await analyzeDocument(analyzedDoc, question);
      }
    }

    if (dbError) {
      console.error('Database error:', dbError);
    }

    // Format documents for context
    const documentsContext = documents?.map(doc => `
Document: ${doc.filename}
Category: ${doc.category}
Provider: ${doc.provider || 'Unknown'}
Property: ${doc.property_address || 'N/A'}
Due Date: ${doc.due_date || 'N/A'}
Summary: ${doc.summary || 'No summary'}
Tags: ${doc.tags?.join(', ') || 'None'}
Extracted Data: ${JSON.stringify(doc.extracted_data || {})}
---`).join('\n') || 'No documents available';

    // Fetch any reminders
    const { data: reminders } = await supabase
      .from('reminders')
      .select('*')
      .eq('status', 'active')
      .order('due_date', { ascending: true })
      .limit(10);

    const remindersContext = reminders?.map(r => `
- ${r.title}: Due ${r.due_date}${r.description ? ` - ${r.description}` : ''}`).join('\n') || 'No active reminders';

    // Build the user message with optional document analysis
    let userMessage = `Here are the documents in the vault:

${documentsContext}

Active Reminders:
${remindersContext}`;

    // If we performed deep document analysis, include those results
    if (documentAnalysis && analyzedDoc) {
      userMessage += `

=== DETAILED DOCUMENT ANALYSIS ===
I analyzed the document "${analyzedDoc.filename}" for you. Here is what I found:

${documentAnalysis}
=== END ANALYSIS ===`;
    }

    userMessage += `

User Question: ${question}

Please answer the question based on the documents and context provided. Be specific and cite document names or account numbers when relevant.`;

    // Call Claude for Q&A
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are Family Vault AI, an intelligent assistant for the Young family's financial document management system.

${FAMILY_CONTEXT}

You have access to the family's documents and can answer questions about:
- Bills, due dates, and payment amounts
- Insurance policies and coverage
- Mortgage and property information
- Medical/Medicare information (especially for Coty Coleman)
- Investment accounts
- Any stored documents

IMPORTANT GUIDELINES:
1. When asked about mortgages, insurance, or property-related questions without specifying which property, ALWAYS list ALL properties and their relevant information. The family owns 3 properties with mortgages.
2. Always be specific with property addresses, account numbers, and servicer names.
3. Reference specific document names when citing information.
4. If the question is ambiguous (e.g., "who is my mortgage servicer"), provide a complete list of all servicers for all properties rather than picking one.
5. Format currency as $X,XXX.XX and dates as Month Day, Year.
6. If you don't have information to answer a question, say so clearly.
7. When you have detailed document analysis available (marked with "DETAILED DOCUMENT ANALYSIS"), use that information to provide specific answers about document contents, usage breakdowns, rate tiers, itemized charges, and comparisons.`,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No response from Claude');
    }

    // Find documents that might be relevant to the answer
    let relevantDocs = documents?.filter(doc => {
      const questionLower = question.toLowerCase();
      const matchTerms = [
        doc.filename?.toLowerCase(),
        doc.category?.toLowerCase(),
        doc.provider?.toLowerCase(),
        doc.property_address?.toLowerCase(),
        ...(doc.tags || []).map(t => t.toLowerCase()),
      ].filter(Boolean);

      return matchTerms.some(term =>
        questionLower.includes(term) || term.includes(questionLower.split(' ')[0])
      );
    }).slice(0, 5) || [];

    // If we analyzed a document, make sure it's first in the list
    if (analyzedDoc) {
      relevantDocs = relevantDocs.filter(d => d.id !== analyzedDoc.id);
      relevantDocs.unshift(analyzedDoc);
    }

    return res.status(200).json({
      success: true,
      answer: textContent.text,
      document_analyzed: analyzedDoc ? {
        id: analyzedDoc.id,
        filename: analyzedDoc.filename,
        analyzed: true
      } : null,
      relevant_documents: relevantDocs.map(d => ({
        id: d.id,
        filename: d.filename,
        category: d.category,
        summary: d.summary,
      })),
      model: response.model,
    });
  } catch (error) {
    console.error('Query error:', error);
    return res.status(500).json({
      error: 'Failed to process question',
      message: error.message,
    });
  }
};
