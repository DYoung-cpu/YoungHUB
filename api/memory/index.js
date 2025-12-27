const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk').default;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// FACT EXTRACTION
// ============================================

const FACT_EXTRACTION_PROMPT = `Extract important facts from this conversation exchange. Return ONLY valid JSON array:
[
  {
    "fact": "specific fact statement",
    "entity_type": "person|property|account|date|amount|document",
    "entity_name": "name of entity this relates to",
    "confidence": 0.0-1.0
  }
]

Focus on:
- Account numbers and balances
- Due dates and deadlines
- Insurance policy details
- Mortgage information
- Property-specific data
- Family member information
- Important amounts

If no extractable facts, return empty array: []`;

async function extractFacts(userMessage, assistantResponse, documentsDiscussed) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `User asked: "${userMessage}"

Assistant responded: "${assistantResponse}"

Documents discussed: ${documentsDiscussed?.map(d => d.filename).join(', ') || 'None'}

${FACT_EXTRACTION_PROMPT}`,
      }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (textContent) {
      let jsonStr = textContent.text.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }
      return JSON.parse(jsonStr);
    }
    return [];
  } catch (error) {
    console.error('Fact extraction error:', error.message);
    return [];
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

async function handleSave(req, res) {
  const {
    session_id,
    user_message,
    assistant_response,
    documents_discussed,
    create_session = false,
  } = req.body;

  try {
    let sessionId = session_id;

    // Create new session if needed
    if (create_session || !sessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from('vault_chat_sessions')
        .insert({
          title: user_message.substring(0, 50) + (user_message.length > 50 ? '...' : ''),
          message_count: 0,
          documents_discussed: documents_discussed?.map(d => d.id) || [],
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      sessionId = newSession.id;
    }

    // Save user message
    const { error: userMsgError } = await supabase
      .from('vault_chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: user_message,
        documents_referenced: documents_discussed?.map(d => d.id) || [],
      });

    if (userMsgError) throw userMsgError;

    // Save assistant message
    const { error: assistantMsgError } = await supabase
      .from('vault_chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: assistant_response,
        documents_referenced: documents_discussed?.map(d => d.id) || [],
      });

    if (assistantMsgError) throw assistantMsgError;

    // Update session
    const { error: updateError } = await supabase
      .from('vault_chat_sessions')
      .update({
        last_message_at: new Date().toISOString(),
        message_count: supabase.rpc('increment', { row_id: sessionId, table_name: 'vault_chat_sessions', column_name: 'message_count' }),
        documents_discussed: documents_discussed?.map(d => d.id) || [],
      })
      .eq('id', sessionId);

    // Ignore update error for now (increment might need different approach)

    // Extract and store facts
    const facts = await extractFacts(user_message, assistant_response, documents_discussed);

    if (facts.length > 0) {
      for (const fact of facts) {
        // Check if this fact already exists
        const { data: existing } = await supabase
          .from('learned_facts')
          .select('id')
          .eq('fact', fact.fact)
          .eq('entity_name', fact.entity_name)
          .single();

        if (!existing) {
          await supabase.from('learned_facts').insert({
            fact: fact.fact,
            source_type: 'conversation',
            source_id: sessionId,
            entity_type: fact.entity_type,
            entity_name: fact.entity_name,
            confidence: fact.confidence || 0.8,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      session_id: sessionId,
      facts_extracted: facts.length,
    });
  } catch (error) {
    console.error('Save error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleRecall(req, res) {
  const { query, entity_type, entity_name, limit = 20 } = req.query;

  try {
    const results = {
      sessions: [],
      facts: [],
      documents: [],
    };

    // Search learned facts
    let factsQuery = supabase
      .from('learned_facts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (query) {
      factsQuery = factsQuery.ilike('fact', `%${query}%`);
    }
    if (entity_type) {
      factsQuery = factsQuery.eq('entity_type', entity_type);
    }
    if (entity_name) {
      factsQuery = factsQuery.ilike('entity_name', `%${entity_name}%`);
    }

    const { data: facts, error: factsError } = await factsQuery;
    if (!factsError) results.facts = facts;

    // Search recent sessions mentioning query
    if (query) {
      const { data: messages, error: messagesError } = await supabase
        .from('vault_chat_messages')
        .select('session_id, content, role, created_at')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!messagesError && messages) {
        // Get unique sessions
        const sessionIds = [...new Set(messages.map(m => m.session_id))];
        const { data: sessions } = await supabase
          .from('vault_chat_sessions')
          .select('*')
          .in('id', sessionIds);

        results.sessions = sessions || [];
      }
    } else {
      // Get recent sessions
      const { data: sessions } = await supabase
        .from('vault_chat_sessions')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(5);

      results.sessions = sessions || [];
    }

    // Search related documents
    if (query) {
      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('id, filename, category, summary, provider')
        .or(`filename.ilike.%${query}%,summary.ilike.%${query}%,provider.ilike.%${query}%`)
        .limit(10);

      if (!docsError) results.documents = docs;
    }

    return res.status(200).json({
      success: true,
      query,
      results,
    });
  } catch (error) {
    console.error('Recall error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleFacts(req, res) {
  const { action } = req.body;

  try {
    switch (action) {
      case 'list':
        const { entity_type, entity_name, verified_only, limit = 50 } = req.body;

        let query = supabase
          .from('learned_facts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (entity_type) query = query.eq('entity_type', entity_type);
        if (entity_name) query = query.ilike('entity_name', `%${entity_name}%`);
        if (verified_only) query = query.eq('verified', true);

        const { data: facts, error: listError } = await query;
        if (listError) throw listError;

        return res.status(200).json({ success: true, facts });

      case 'verify':
        const { fact_id, verified } = req.body;

        const { error: verifyError } = await supabase
          .from('learned_facts')
          .update({ verified, updated_at: new Date().toISOString() })
          .eq('id', fact_id);

        if (verifyError) throw verifyError;

        return res.status(200).json({ success: true, fact_id, verified });

      case 'delete':
        const { fact_ids } = req.body;

        const { error: deleteError } = await supabase
          .from('learned_facts')
          .delete()
          .in('id', fact_ids);

        if (deleteError) throw deleteError;

        return res.status(200).json({ success: true, deleted: fact_ids.length });

      case 'add':
        const { fact, entity_type: et, entity_name: en, source_type, source_id } = req.body;

        const { data: newFact, error: addError } = await supabase
          .from('learned_facts')
          .insert({
            fact,
            entity_type: et,
            entity_name: en,
            source_type: source_type || 'manual',
            source_id,
            verified: true,
            confidence: 1.0,
          })
          .select()
          .single();

        if (addError) throw addError;

        return res.status(200).json({ success: true, fact: newFact });

      default:
        return res.status(400).json({ error: 'Unknown facts action' });
    }
  } catch (error) {
    console.error('Facts error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleSessions(req, res) {
  const { action } = req.body || req.query;

  try {
    switch (action || 'list') {
      case 'list':
        const { limit = 20 } = req.query;

        const { data: sessions, error: listError } = await supabase
          .from('vault_chat_sessions')
          .select('*')
          .order('last_message_at', { ascending: false })
          .limit(parseInt(limit));

        if (listError) throw listError;

        return res.status(200).json({ success: true, sessions });

      case 'get':
        const { session_id } = req.body || req.query;

        const { data: session, error: sessionError } = await supabase
          .from('vault_chat_sessions')
          .select('*')
          .eq('id', session_id)
          .single();

        if (sessionError) throw sessionError;

        const { data: messages, error: messagesError } = await supabase
          .from('vault_chat_messages')
          .select('*')
          .eq('session_id', session_id)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        return res.status(200).json({ success: true, session, messages });

      case 'delete':
        const { session_id: deleteId } = req.body;

        const { error: deleteError } = await supabase
          .from('vault_chat_sessions')
          .delete()
          .eq('id', deleteId);

        if (deleteError) throw deleteError;

        return res.status(200).json({ success: true, deleted: deleteId });

      case 'summarize':
        const { session_id: sumId } = req.body;

        // Get messages
        const { data: sessionMsgs } = await supabase
          .from('vault_chat_messages')
          .select('role, content')
          .eq('session_id', sumId)
          .order('created_at', { ascending: true });

        if (!sessionMsgs || sessionMsgs.length === 0) {
          return res.status(400).json({ error: 'No messages in session' });
        }

        // Generate summary
        const conversationText = sessionMsgs.map(m => `${m.role}: ${m.content}`).join('\n\n');

        const summaryResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: `Summarize this conversation in 2-3 sentences:\n\n${conversationText}`,
          }],
        });

        const summary = summaryResponse.content.find(c => c.type === 'text')?.text || '';

        // Extract topics
        const topicsResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 128,
          messages: [{
            role: 'user',
            content: `List the main topics discussed (comma-separated, max 5):\n\n${conversationText}`,
          }],
        });

        const topicsText = topicsResponse.content.find(c => c.type === 'text')?.text || '';
        const topics = topicsText.split(',').map(t => t.trim()).filter(t => t).slice(0, 5);

        // Update session
        await supabase
          .from('vault_chat_sessions')
          .update({ summary, topics })
          .eq('id', sumId);

        return res.status(200).json({ success: true, summary, topics });

      default:
        return res.status(400).json({ error: 'Unknown sessions action' });
    }
  } catch (error) {
    console.error('Sessions error:', error);
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
      available_actions: ['save', 'recall', 'facts', 'sessions'],
    });
  }

  switch (action) {
    case 'save':
      return handleSave(req, res);
    case 'recall':
      return handleRecall(req, res);
    case 'facts':
      return handleFacts(req, res);
    case 'sessions':
      return handleSessions(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
};
