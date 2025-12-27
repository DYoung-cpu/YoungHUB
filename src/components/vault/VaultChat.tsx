import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  relevantDocs?: Array<{
    id: string;
    filename: string;
    category: string;
    summary: string;
  }>;
}

interface ChatSession {
  id: string;
  title: string;
  last_message_at: string;
  message_count: number;
  summary?: string;
}

interface VaultChatProps {
  onDocumentClick?: (docId: string) => void;
}

const WELCOME_MESSAGE: Message = {
  id: '1',
  role: 'assistant',
  content: `Hi! I'm your Family Vault assistant. I can help you find information about your documents, bills, insurance policies, and more.

Try asking me:
- "What bills are due this month?"
- "What is Coty's Medicare number?"
- "Show me the latest mortgage statement"
- "When does the HO6 insurance expire?"`,
  timestamp: new Date(),
};

export function VaultChat({ onDocumentClick }: VaultChatProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [factsCount, setFactsCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load previous sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/memory?action=sessions&limit=10');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadSession = async (session: ChatSession) => {
    try {
      const response = await fetch('/api/memory?action=sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions_action: 'get', session_id: session.id }),
      });

      if (response.ok) {
        const data = await response.json();
        const loadedMessages: Message[] = data.messages.map((m: { id: string; role: 'user' | 'assistant'; content: string; created_at: string }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
        }));

        setMessages([WELCOME_MESSAGE, ...loadedMessages]);
        setSessionId(session.id);
        setShowHistory(false);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const startNewSession = () => {
    setMessages([WELCOME_MESSAGE]);
    setSessionId(null);
    setShowHistory(false);
  };

  const saveToMemory = async (userContent: string, assistantContent: string, docs: Message['relevantDocs']) => {
    try {
      const response = await fetch('/api/memory?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_message: userContent,
          assistant_response: assistantContent,
          documents_discussed: docs || [],
          create_session: !sessionId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.session_id && !sessionId) {
          setSessionId(data.session_id);
        }
        if (data.facts_extracted > 0) {
          setFactsCount(prev => prev + data.facts_extracted);
        }
      }
    } catch (error) {
      console.error('Failed to save to memory:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send conversation history for context (last 10 messages to stay within limits)
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/claude/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage.content,
          conversation_history: conversationHistory
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        relevantDocs: data.relevant_documents,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save to memory system (async, don't block UI)
      saveToMemory(userMessage.content, assistantMessage.content, assistantMessage.relevantDocs);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your question. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    "What bills are due soon?",
    "What is Coty's Medicare number?",
    "Show property insurance details",
    "HELOC balance and limit",
  ];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="vault-chat">
      <div className="chat-header">
        <span className="chat-icon">🤖</span>
        <h3>Ask Family Vault</h3>
        <div className="chat-header-actions">
          {factsCount > 0 && (
            <span className="facts-badge" title="Facts learned this session">
              🧠 {factsCount}
            </span>
          )}
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
            title="Chat history"
          >
            📋
          </button>
          <button
            className="new-chat-btn"
            onClick={startNewSession}
            title="New conversation"
          >
            ✨
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="chat-history-panel">
          <div className="history-header">
            <h4>Previous Conversations</h4>
            <button onClick={() => setShowHistory(false)}>✕</button>
          </div>
          <div className="history-list">
            {sessions.length === 0 ? (
              <p className="no-sessions">No previous conversations</p>
            ) : (
              sessions.map(session => (
                <button
                  key={session.id}
                  className={`session-item ${session.id === sessionId ? 'active' : ''}`}
                  onClick={() => loadSession(session)}
                >
                  <div className="session-title">{session.title}</div>
                  <div className="session-meta">
                    <span>{formatDate(session.last_message_at)}</span>
                    <span>{session.message_count} messages</span>
                  </div>
                  {session.summary && (
                    <div className="session-summary">{session.summary}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="chat-messages">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar">
              {message.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              {message.relevantDocs && message.relevantDocs.length > 0 && (
                <div className="relevant-docs">
                  <span className="docs-label">Related documents:</span>
                  <div className="docs-list">
                    {message.relevantDocs.map(doc => (
                      <button
                        key={doc.id}
                        className="doc-chip"
                        onClick={() => onDocumentClick?.(doc.id)}
                      >
                        📄 {doc.filename}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="message-time">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="quick-questions">
        {quickQuestions.map((q, i) => (
          <button
            key={i}
            className="quick-question"
            onClick={() => setInput(q)}
            disabled={isLoading}
          >
            {q}
          </button>
        ))}
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about your documents..."
          disabled={isLoading}
          className="chat-input"
        />
        <button type="submit" disabled={isLoading || !input.trim()} className="send-button">
          {isLoading ? '...' : '➤'}
        </button>
      </form>
    </div>
  );
}

export default VaultChat;
