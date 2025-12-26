const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for server-side operations
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:dyoung1946@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { familyMemberIds, sendToAll, notification, category } = req.body;

    if (!notification || !notification.title) {
      return res.status(400).json({ error: 'Missing notification title' });
    }

    // Get push subscriptions
    let query = supabase
      .from('push_subscriptions')
      .select('*, family_members(id, name, email)')
      .eq('is_active', true);

    if (!sendToAll && familyMemberIds && familyMemberIds.length > 0) {
      query = query.in('family_member_id', familyMemberIds);
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active subscriptions found',
        sent: 0
      });
    }

    // Check notification preferences for each subscription
    const memberIds = [...new Set(subscriptions.map(s => s.family_member_id))];
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('*')
      .in('family_member_id', memberIds);

    const prefsMap = new Map(preferences?.map(p => [p.family_member_id, p]) || []);

    // Prepare push payload
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icons/icon-192x192.png',
      badge: notification.badge || '/icons/badge-72x72.png',
      tag: notification.tag,
      data: notification.data || {}
    });

    // Send to each subscription
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        // Check if member has push enabled
        const prefs = prefsMap.get(sub.family_member_id);
        if (prefs && !prefs.push_enabled) {
          return { skipped: true, reason: 'push_disabled', memberId: sub.family_member_id };
        }

        // Check category preferences
        if (prefs && category) {
          if (category === 'bill_reminder' && !prefs.notify_bills) {
            return { skipped: true, reason: 'bills_disabled', memberId: sub.family_member_id };
          }
          if (category === 'calendar_update' && !prefs.notify_calendar) {
            return { skipped: true, reason: 'calendar_disabled', memberId: sub.family_member_id };
          }
          if (category === 'urgent_item' && !prefs.notify_urgent_items) {
            return { skipped: true, reason: 'urgent_disabled', memberId: sub.family_member_id };
          }
        }

        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys
            },
            payload
          );

          // Update last_used timestamp
          await supabase
            .from('push_subscriptions')
            .update({ last_used: new Date().toISOString() })
            .eq('id', sub.id);

          // Log successful notification
          await supabase.from('notification_log').insert({
            family_member_id: sub.family_member_id,
            notification_type: 'push',
            category: category || 'general',
            title: notification.title,
            body: notification.body,
            document_id: notification.data?.documentId,
            reminder_id: notification.data?.reminderId,
            calendar_event_id: notification.data?.calendarEventId,
            status: 'sent'
          });

          return { success: true, memberId: sub.family_member_id };
        } catch (error) {
          console.error('Push send error:', error);

          // If subscription is invalid, mark it as inactive
          if (error.statusCode === 404 || error.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .update({ is_active: false })
              .eq('id', sub.id);
          }

          // Log failed notification
          await supabase.from('notification_log').insert({
            family_member_id: sub.family_member_id,
            notification_type: 'push',
            category: category || 'general',
            title: notification.title,
            body: notification.body,
            status: 'failed',
            error_message: error.message
          });

          return { error: true, memberId: sub.family_member_id, message: error.message };
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const skipped = results.filter(r => r.status === 'fulfilled' && r.value.skipped).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error)).length;

    return res.status(200).json({
      success: true,
      sent,
      skipped,
      failed,
      total: subscriptions.length
    });

  } catch (error) {
    console.error('Push notification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
