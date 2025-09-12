-- Family Tracking Database Setup for Supabase
-- Run this in Supabase SQL Editor

-- Enable real-time for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE family_members;
ALTER PUBLICATION supabase_realtime ADD TABLE locations;
ALTER PUBLICATION supabase_realtime ADD TABLE places;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- 1. Family Members Table
CREATE TABLE IF NOT EXISTS family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT,
  is_sharing BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Locations Table (stores current location for each member)
CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),
  speed DECIMAL(10, 2),
  battery_level INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(member_id) -- Only one current location per member
);

-- 3. Location History Table (stores all location updates)
CREATE TABLE IF NOT EXISTS location_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),
  speed DECIMAL(10, 2),
  battery_level INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Places Table
CREATE TABLE IF NOT EXISTS places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius INTEGER DEFAULT 100,
  icon TEXT DEFAULT '📍',
  notifications_enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES family_members(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'location', 'sos'
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Insert initial family members
INSERT INTO family_members (email, name, status, is_sharing)
VALUES 
  ('dyoung1946@gmail.com', 'David', 'Available', false),
  ('lisa.young@gmail.com', 'Lisa', 'Available', false)
ON CONFLICT (email) DO NOTHING;

-- 7. Insert default home place
INSERT INTO places (name, address, latitude, longitude, radius, icon)
VALUES 
  ('Home', '1808 Manning Ave Unit 202, Los Angeles, CA 90049', 34.0549, -118.4426, 100, '🏠');

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_locations_member_id ON locations(member_id);
CREATE INDEX IF NOT EXISTS idx_location_history_member_id ON location_history(member_id);
CREATE INDEX IF NOT EXISTS idx_location_history_timestamp ON location_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);

-- 9. Create function to update location (upsert)
CREATE OR REPLACE FUNCTION update_member_location(
  p_email TEXT,
  p_latitude DECIMAL,
  p_longitude DECIMAL,
  p_accuracy DECIMAL DEFAULT NULL,
  p_speed DECIMAL DEFAULT NULL,
  p_battery INTEGER DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_member_id UUID;
BEGIN
  -- Get member ID
  SELECT id INTO v_member_id FROM family_members WHERE email = p_email;
  
  IF v_member_id IS NOT NULL THEN
    -- Update or insert current location
    INSERT INTO locations (member_id, latitude, longitude, accuracy, speed, battery_level)
    VALUES (v_member_id, p_latitude, p_longitude, p_accuracy, p_speed, p_battery)
    ON CONFLICT (member_id) 
    DO UPDATE SET 
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      accuracy = EXCLUDED.accuracy,
      speed = EXCLUDED.speed,
      battery_level = EXCLUDED.battery_level,
      timestamp = NOW();
    
    -- Add to history
    INSERT INTO location_history (member_id, latitude, longitude, accuracy, speed, battery_level)
    VALUES (v_member_id, p_latitude, p_longitude, p_accuracy, p_speed, p_battery);
    
    -- Update member's sharing status
    UPDATE family_members 
    SET is_sharing = true, updated_at = NOW() 
    WHERE id = v_member_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 10. Row Level Security (RLS) Policies
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all family data
CREATE POLICY "Family members can view all family data" ON family_members
  FOR ALL USING (true);

CREATE POLICY "Family members can view all locations" ON locations
  FOR ALL USING (true);

CREATE POLICY "Family members can view location history" ON location_history
  FOR SELECT USING (true);

CREATE POLICY "Family members can manage places" ON places
  FOR ALL USING (true);

CREATE POLICY "Family members can view and send messages" ON chat_messages
  FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;