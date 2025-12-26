import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Gmail OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground' // Redirect URI
);

// Set refresh token
if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
}

interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

interface SendEmailRequest {
  familyMemberIds?: string[];  // Send to specific members
  sendToAll?: boolean;         // Send to all family members
  subject: string;
  body: string;
  html?: string;
  category?: string;           // For logging
  documentId?: string;
  reminderId?: string;
  calendarEventId?: string;
}

// Email templates
const emailTemplates = {
  billReminder: (data: { title: string; dueDate: string; amount?: string; documentName?: string }) => ({
    subject: `Bill Reminder: ${data.title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Family Vault</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <h2 style="color: #333; margin-bottom: 20px;">Bill Reminder</h2>
          <p style="color: #555; font-size: 16px;">
            <strong>${data.title}</strong> is due on <strong>${data.dueDate}</strong>
          </p>
          ${data.amount ? `<p style="color: #555; font-size: 16px;">Amount: <strong>$${data.amount}</strong></p>` : ''}
          ${data.documentName ? `<p style="color: #888; font-size: 14px;">Document: ${data.documentName}</p>` : ''}
          <div style="margin-top: 30px;">
            <a href="https://familyfinancehub.vercel.app/documents"
               style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              View in Family Vault
            </a>
          </div>
        </div>
        <div style="padding: 20px; background: #f8f9fa; text-align: center; color: #888; font-size: 12px;">
          Sent from Family Vault. You can manage notification preferences in the app.
        </div>
      </div>
    `
  }),

  urgentItem: (data: { title: string; description: string; urgencyLevel: string }) => ({
    subject: `URGENT: ${data.title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Family Vault - Urgent</h1>
        </div>
        <div style="padding: 30px; background: #fff; border-left: 4px solid #dc2626;">
          <h2 style="color: #dc2626; margin-bottom: 20px;">${data.urgencyLevel}</h2>
          <p style="color: #333; font-size: 18px; font-weight: bold;">${data.title}</p>
          <p style="color: #555; font-size: 16px;">${data.description}</p>
          <div style="margin-top: 30px;">
            <a href="https://familyfinancehub.vercel.app/documents"
               style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Take Action Now
            </a>
          </div>
        </div>
        <div style="padding: 20px; background: #f8f9fa; text-align: center; color: #888; font-size: 12px;">
          This is an urgent notification from Family Vault.
        </div>
      </div>
    `
  }),

  calendarUpdate: (data: { memberName: string; eventType: string; eventDate: string }) => ({
    subject: `Calendar Update: ${data.memberName} - ${data.eventType}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Family Vault</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <h2 style="color: #333; margin-bottom: 20px;">Calendar Update</h2>
          <p style="color: #555; font-size: 16px;">
            <strong>${data.memberName}</strong> updated their calendar:
          </p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #333;">
              <strong>${data.eventType}</strong> on ${data.eventDate}
            </p>
          </div>
          <div style="margin-top: 30px;">
            <a href="https://familyfinancehub.vercel.app/calendar"
               style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              View Calendar
            </a>
          </div>
        </div>
        <div style="padding: 20px; background: #f8f9fa; text-align: center; color: #888; font-size: 12px;">
          Sent from Family Vault.
        </div>
      </div>
    `
  })
};

async function sendGmailEmail(email: EmailNotification): Promise<boolean> {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const senderAddress = process.env.GMAIL_SENDER_ADDRESS || 'familyvault.notifications@gmail.com';

    // Create email message
    const message = [
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `To: ${email.to}`,
      `From: Family Vault <${senderAddress}>`,
      `Subject: ${email.subject}`,
      '',
      email.html || email.body
    ].join('\r\n');

    // Base64 encode the message
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    return true;
  } catch (error) {
    console.error('Gmail send error:', error);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if Gmail is configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    return res.status(503).json({ error: 'Email service not configured' });
  }

  try {
    const {
      familyMemberIds,
      sendToAll,
      subject,
      body,
      html,
      category,
      documentId,
      reminderId,
      calendarEventId
    } = req.body as SendEmailRequest;

    if (!subject || !body) {
      return res.status(400).json({ error: 'Missing subject or body' });
    }

    // Get recipients
    let query = supabase
      .from('notification_preferences')
      .select('*, family_members(id, name, email)')
      .eq('email_enabled', true);

    if (!sendToAll && familyMemberIds && familyMemberIds.length > 0) {
      query = query.in('family_member_id', familyMemberIds);
    }

    const { data: preferences, error: prefError } = await query;

    if (prefError) {
      console.error('Error fetching preferences:', prefError);
      return res.status(500).json({ error: 'Failed to fetch preferences' });
    }

    if (!preferences || preferences.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No recipients with email enabled',
        sent: 0
      });
    }

    // Filter by category preferences
    const recipients = preferences.filter(p => {
      if (category === 'bill_reminder' && !p.notify_bills) return false;
      if (category === 'calendar_update' && !p.notify_calendar) return false;
      if (category === 'urgent_item' && !p.notify_urgent_items) return false;
      return true;
    });

    // Send emails
    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const emailAddress = recipient.email_address || recipient.family_members?.email;
        if (!emailAddress) {
          return { skipped: true, reason: 'no_email' };
        }

        const success = await sendGmailEmail({
          to: emailAddress,
          subject,
          body,
          html
        });

        // Log notification
        await supabase.from('notification_log').insert({
          family_member_id: recipient.family_member_id,
          notification_type: 'email',
          category: category || 'general',
          title: subject,
          body: body,
          document_id: documentId,
          reminder_id: reminderId,
          calendar_event_id: calendarEventId,
          status: success ? 'sent' : 'failed'
        });

        return { success, memberId: recipient.family_member_id };
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success && !(r.value as any).skipped)).length;

    return res.status(200).json({
      success: true,
      sent,
      failed,
      total: recipients.length
    });

  } catch (error) {
    console.error('Email notification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Export templates for use in other API routes
export { emailTemplates };
