const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

module.exports = async (req, res) => {
  // Handle subscription management
  if (req.method === 'POST') {
    // Subscribe to push notifications
    try {
      const { familyMemberId, subscription, deviceName, userAgent } = req.body;

      if (!familyMemberId || !subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ error: 'Missing required subscription data' });
      }

      // Upsert the subscription (update if endpoint exists, insert if new)
      const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert({
          family_member_id: familyMemberId,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          device_name: deviceName,
          user_agent: userAgent,
          is_active: true,
          last_used: new Date().toISOString()
        }, {
          onConflict: 'endpoint',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        console.error('Subscription error:', error);
        return res.status(500).json({ error: 'Failed to save subscription' });
      }

      return res.status(200).json({
        success: true,
        subscriptionId: data.id,
        message: 'Successfully subscribed to push notifications'
      });

    } catch (error) {
      console.error('Subscribe error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    // Unsubscribe from push notifications
    try {
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({ error: 'Missing endpoint' });
      }

      // Mark subscription as inactive (soft delete)
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('endpoint', endpoint);

      if (error) {
        console.error('Unsubscribe error:', error);
        return res.status(500).json({ error: 'Failed to unsubscribe' });
      }

      return res.status(200).json({
        success: true,
        message: 'Successfully unsubscribed from push notifications'
      });

    } catch (error) {
      console.error('Unsubscribe error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'GET') {
    // Get VAPID public key for client subscription
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      return res.status(500).json({ error: 'VAPID keys not configured' });
    }

    return res.status(200).json({
      vapidPublicKey
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
