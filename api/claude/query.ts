import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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

    // Call Claude for Q&A
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `You are Family Vault AI, an intelligent assistant for the Young family's financial document management system.

${FAMILY_CONTEXT}

You have access to the family's documents and can answer questions about:
- Bills, due dates, and payment amounts
- Insurance policies and coverage
- Mortgage and property information
- Medical/Medicare information (especially for Coty Coleman)
- Investment accounts
- Any stored documents

Always be helpful, accurate, and reference specific documents or account numbers when relevant.
If you don't have information to answer a question, say so clearly.
Format currency as $X,XXX.XX and dates as Month Day, Year.`,
      messages: [
        {
          role: 'user',
          content: `Here are the documents in the vault:

${documentsContext}

Active Reminders:
${remindersContext}

User Question: ${question}

Please answer the question based on the documents and context provided. Be specific and cite document names or account numbers when relevant.`,
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No response from Claude');
    }

    // Find documents that might be relevant to the answer
    const relevantDocs = documents?.filter(doc => {
      const questionLower = question.toLowerCase();
      const matchTerms = [
        doc.filename?.toLowerCase(),
        doc.category?.toLowerCase(),
        doc.provider?.toLowerCase(),
        doc.property_address?.toLowerCase(),
        ...(doc.tags || []).map((t: string) => t.toLowerCase()),
      ].filter(Boolean);

      return matchTerms.some(term =>
        questionLower.includes(term) || term.includes(questionLower.split(' ')[0])
      );
    }).slice(0, 5);

    return res.status(200).json({
      success: true,
      answer: textContent.text,
      relevant_documents: relevantDocs?.map(d => ({
        id: d.id,
        filename: d.filename,
        category: d.category,
        summary: d.summary,
      })),
      model: response.model,
    });
  } catch (error: any) {
    console.error('Query error:', error);
    return res.status(500).json({
      error: 'Failed to process question',
      message: error.message,
    });
  }
}
