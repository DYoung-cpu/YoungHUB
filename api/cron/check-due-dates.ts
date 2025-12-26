import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Configure web-push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:dyoung1946@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface DueDocument {
  id: string;
  filename: string;
  category: string;
  provider?: string;
  property_address?: string;
  due_date: string;
  summary?: string;
}

/**
 * This endpoint is designed to be called by Vercel Cron
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-due-dates",
 *     "schedule": "0 9 * * *"  // Daily at 9 AM UTC
 *   }]
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret (optional but recommended)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development or if no secret is set
    if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check for documents due in 7, 3, and 1 days, and overdue
    const checkDays = [7, 3, 1, 0, -1, -2, -3]; // Including overdue

    const results = {
      checked: 0,
      notificationsSent: 0,
      errors: [] as string[]
    };

    for (const daysAhead of checkDays) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysAhead);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // Find documents due on this date
      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .eq('due_date', targetDateStr);

      if (error) {
        results.errors.push(`Error fetching documents for ${targetDateStr}: ${error.message}`);
        continue;
      }

      if (!documents || documents.length === 0) continue;

      results.checked += documents.length;

      // Send notifications for each document
      for (const doc of documents) {
        await sendDueDateNotification(doc as DueDocument, daysAhead, results);
      }
    }

    // Also check reminders table
    const { data: reminders, error: reminderError } = await supabase
      .from('reminders')
      .select('*')
      .eq('status', 'active')
      .lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

    if (!reminderError && reminders) {
      for (const reminder of reminders) {
        const dueDate = new Date(reminder.due_date);
        const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Check if we should notify based on remind_days_before
        const shouldNotify = reminder.remind_days_before?.includes(daysUntil) || daysUntil <= 0;

        if (shouldNotify) {
          await sendReminderNotification(reminder, daysUntil, results);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Due date check completed`,
      ...results
    });

  } catch (error) {
    console.error('Due date check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function sendDueDateNotification(
  doc: DueDocument,
  daysAhead: number,
  results: { notificationsSent: number; errors: string[] }
) {
  let urgencyLevel: string;
  let title: string;

  if (daysAhead < 0) {
    urgencyLevel = 'OVERDUE';
    title = `OVERDUE: ${doc.filename}`;
  } else if (daysAhead === 0) {
    urgencyLevel = 'DUE TODAY';
    title = `DUE TODAY: ${doc.filename}`;
  } else if (daysAhead <= 3) {
    urgencyLevel = 'Due Soon';
    title = `Due in ${daysAhead} day${daysAhead > 1 ? 's' : ''}: ${doc.filename}`;
  } else {
    urgencyLevel = 'Upcoming';
    title = `Reminder: ${doc.filename} due in ${daysAhead} days`;
  }

  const body = doc.provider
    ? `${doc.provider} - ${doc.category}${doc.property_address ? ` - ${doc.property_address.split(',')[0]}` : ''}`
    : `${doc.category}${doc.summary ? ': ' + doc.summary.substring(0, 50) : ''}`;

  // Get all active push subscriptions
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('is_active', true);

  if (!subscriptions || subscriptions.length === 0) return;

  const payload = JSON.stringify({
    title,
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `due-${doc.id}`,
    data: {
      category: 'bill_reminder',
      documentId: doc.id,
      urgencyLevel,
      url: '/?tab=documents'
    }
  });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      );
      results.notificationsSent++;

      // Log notification
      await supabase.from('notification_log').insert({
        family_member_id: sub.family_member_id,
        notification_type: 'push',
        category: 'bill_reminder',
        title,
        body,
        document_id: doc.id,
        status: 'sent'
      });
    } catch (error: any) {
      results.errors.push(`Push failed for subscription ${sub.id}: ${error.message}`);

      // Deactivate invalid subscriptions
      if (error.statusCode === 404 || error.statusCode === 410) {
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', sub.id);
      }
    }
  }
}

async function sendReminderNotification(
  reminder: any,
  daysUntil: number,
  results: { notificationsSent: number; errors: string[] }
) {
  let title: string;

  if (daysUntil < 0) {
    title = `OVERDUE: ${reminder.title}`;
  } else if (daysUntil === 0) {
    title = `TODAY: ${reminder.title}`;
  } else {
    title = `Reminder: ${reminder.title} in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;
  }

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('is_active', true);

  if (!subscriptions || subscriptions.length === 0) return;

  const payload = JSON.stringify({
    title,
    body: reminder.description || `${reminder.reminder_type} reminder`,
    icon: '/icons/icon-192x192.png',
    tag: `reminder-${reminder.id}`,
    data: {
      category: 'reminder',
      reminderId: reminder.id,
      documentId: reminder.document_id,
      url: reminder.document_id ? '/?tab=documents' : '/?tab=overview'
    }
  });

  for (const sub of subscriptions) {
    // Check notification preferences
    if (reminder.notify_david && sub.family_member_id) {
      // Would check if this subscription belongs to David
    }

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      );
      results.notificationsSent++;
    } catch (error: any) {
      results.errors.push(`Reminder push failed: ${error.message}`);
    }
  }
}
