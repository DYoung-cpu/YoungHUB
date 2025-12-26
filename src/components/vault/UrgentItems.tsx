import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface UrgentDocument {
  id: string;
  filename: string;
  category: string;
  provider?: string;
  property_address?: string;
  due_date: string;
  summary?: string;
  tags?: string[];
}

interface UrgentItemsProps {
  onDocumentClick?: (docId: string) => void;
}

export function UrgentItems({ onDocumentClick }: UrgentItemsProps) {
  const [urgentDocs, setUrgentDocs] = useState<UrgentDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUrgentItems();
  }, []);

  const fetchUrgentItems = async () => {
    try {
      const today = new Date();
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Fetch documents with due dates within 7 days or overdue
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Filter and categorize by urgency
      const urgent = data?.filter(doc => {
        const dueDate = new Date(doc.due_date);
        return dueDate <= sevenDaysFromNow;
      }) || [];

      setUrgentDocs(urgent);
    } catch (error) {
      console.error('Error fetching urgent items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyLevel = (dueDate: string): 'overdue' | 'critical' | 'warning' | 'upcoming' => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue === 0) return 'critical';
    if (daysUntilDue <= 3) return 'warning';
    return 'upcoming';
  };

  const getUrgencyLabel = (level: string) => {
    switch (level) {
      case 'overdue': return '🚨 OVERDUE';
      case 'critical': return '⚠️ DUE TODAY';
      case 'warning': return '⏰ Due Soon';
      default: return '📅 Upcoming';
    }
  };

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

    const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
    if (daysUntil <= 7) return `In ${daysUntil} days`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      insurance: '🛡️',
      mortgage: '🏠',
      bank: '🏦',
      utility: '💡',
      medical: '🏥',
      tax: '📋',
      housing: '🏢',
      legal: '⚖️',
    };
    return icons[category] || '📄';
  };

  if (loading) {
    return (
      <div className="urgent-items loading">
        <div className="loading-spinner" />
        <span>Loading urgent items...</span>
      </div>
    );
  }

  if (urgentDocs.length === 0) {
    return (
      <div className="urgent-items empty">
        <span className="empty-icon">✅</span>
        <span className="empty-text">No urgent items! You're all caught up.</span>
      </div>
    );
  }

  return (
    <div className="urgent-items">
      <div className="urgent-header">
        <span className="urgent-icon">🔔</span>
        <h3>Action Required</h3>
        <span className="urgent-count">{urgentDocs.length}</span>
      </div>

      <div className="urgent-list">
        {urgentDocs.map(doc => {
          const urgencyLevel = getUrgencyLevel(doc.due_date);
          return (
            <div
              key={doc.id}
              className={`urgent-item ${urgencyLevel}`}
              onClick={() => onDocumentClick?.(doc.id)}
            >
              <div className="item-icon">{getCategoryIcon(doc.category)}</div>
              <div className="item-content">
                <div className="item-title">{doc.filename}</div>
                <div className="item-details">
                  {doc.provider && <span className="item-provider">{doc.provider}</span>}
                  {doc.property_address && (
                    <span className="item-property">
                      {doc.property_address.split(',')[0]}
                    </span>
                  )}
                </div>
                {doc.summary && <div className="item-summary">{doc.summary}</div>}
              </div>
              <div className="item-urgency">
                <span className={`urgency-badge ${urgencyLevel}`}>
                  {getUrgencyLabel(urgencyLevel)}
                </span>
                <span className="due-date">{formatDueDate(doc.due_date)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default UrgentItems;
