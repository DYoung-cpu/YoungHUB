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

interface VaultChatProps {
  onDocumentClick?: (docId: string) => void;
}

export function VaultChat({ onDocumentClick }: VaultChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hi! I'm your Family Vault assistant. I can help you find information about your documents, bills, insurance policies, and more.

Try asking me:
- "What bills are due this month?"
- "What is Coty's Medicare number?"
- "Show me the latest mortgage statement"
- "When does the HO6 insurance expire?"`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      const response = await fetch('/api/claude/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage.content }),
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

  return (
    <div className="vault-chat">
      <div className="chat-header">
        <span className="chat-icon">🤖</span>
        <h3>Ask Family Vault</h3>
      </div>

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
