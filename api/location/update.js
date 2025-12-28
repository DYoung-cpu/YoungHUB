const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

module.exports = async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, latitude, longitude, accuracy, speed } = req.body;

  if (!email || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Missing required fields: email, latitude, longitude' });
  }

  console.log('=== LOCATION UPDATE API ===');
  console.log('Email:', email);
  console.log('Coords:', latitude, longitude);

  try {
    // Find or create member
    let { data: member, error: findError } = await supabase
      .from('family_members')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (findError) {
      console.error('Find member error:', findError);
      return res.status(500).json({ error: 'Failed to find member', details: findError });
    }

    let memberId = member?.id;

    if (!memberId) {
      // Create new member
      const name = email.split('@')[0].split('.').map(n =>
        n.charAt(0).toUpperCase() + n.slice(1)
      ).join(' ');

      const { data: newMember, error: createError } = await supabase
        .from('family_members')
        .insert({ email, name, status: 'Active', is_sharing: true })
        .select('id')
        .single();

      if (createError) {
        console.error('Create member error:', createError);
        return res.status(500).json({ error: 'Failed to create member', details: createError });
      }

      memberId = newMember.id;
      console.log('Created new member:', memberId);
    } else {
      console.log('Found member:', memberId);
    }

    // Update member status
    await supabase
      .from('family_members')
      .update({
        is_sharing: true,
        status: 'Active',
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId);

    // Delete old location
    await supabase
      .from('locations')
      .delete()
      .eq('member_id', memberId);

    // Insert new location
    const { error: locationError } = await supabase
      .from('locations')
      .insert({
        member_id: memberId,
        latitude,
        longitude,
        accuracy: accuracy || 0,
        speed: speed || 0,
        battery_level: null,
        timestamp: new Date().toISOString()
      });

    if (locationError) {
      console.error('Location insert error:', locationError);
      return res.status(500).json({ error: 'Failed to save location', details: locationError });
    }

    // Also save to history
    await supabase.from('location_history').insert({
      member_id: memberId,
      latitude,
      longitude,
      accuracy: accuracy || 0,
      speed: speed || 0,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Location saved successfully!');

    return res.status(200).json({
      success: true,
      member_id: memberId,
      location: { latitude, longitude }
    });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};
