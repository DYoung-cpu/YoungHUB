-- Family Vault Database Setup for Supabase (FIXED ORDER)
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: CREATE ALL TABLES FIRST
-- ============================================

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

-- 2. Locations Table
CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),
  speed DECIMAL(10, 2),
  battery_level INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(member_id)
);

-- 3. Location History Table
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
  message_type TEXT DEFAULT 'text',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT,
  subcategory TEXT,
  tags TEXT[],
  family_member_id UUID REFERENCES family_members(id),
  property_address TEXT,
  account_number TEXT,
  provider TEXT,
  extracted_text TEXT,
  extracted_data JSONB,
  summary TEXT,
  document_date DATE,
  due_date DATE,
  expiration_date DATE,
  uploaded_by UUID REFERENCES family_members(id),
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN DEFAULT true,
  location TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  document_id UUID REFERENCES documents(id),
  notes TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Calendar Subscriptions Table
CREATE TABLE IF NOT EXISTS calendar_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  target_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  notify_on_update BOOLEAN DEFAULT true,
  notify_types TEXT[] DEFAULT ARRAY['office', 'wfh', 'vacation', 'appointment'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscriber_id, target_id)
);

-- 9. Reminders Table
CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  reminder_type TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  remind_days_before INTEGER[] DEFAULT '{7,3,1}',
  status TEXT DEFAULT 'active',
  snoozed_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  document_id UUID REFERENCES documents(id),
  calendar_event_id UUID REFERENCES calendar_events(id),
  family_member_id UUID REFERENCES family_members(id),
  notify_push BOOLEAN DEFAULT true,
  notify_david BOOLEAN DEFAULT true,
  notify_lisa BOOLEAN DEFAULT true,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  appointment_type TEXT,
  provider_name TEXT,
  appointment_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  location TEXT,
  address TEXT,
  notes TEXT,
  preparation_notes TEXT,
  reminder_id UUID REFERENCES reminders(id),
  calendar_event_id UUID REFERENCES calendar_events(id),
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Photos Table
CREATE TABLE IF NOT EXISTS photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  description TEXT,
  tags TEXT[],
  taken_date TIMESTAMPTZ,
  tagged_members UUID[],
  event TEXT,
  is_favorite BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES family_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 2: INSERT INITIAL DATA
-- ============================================

INSERT INTO family_members (email, name, status, is_sharing)
VALUES
  ('dyoung1946@gmail.com', 'David', 'Available', false),
  ('lisa.young@gmail.com', 'Lisa', 'Available', false)
ON CONFLICT (email) DO NOTHING;

INSERT INTO places (name, address, latitude, longitude, radius, icon)
VALUES ('Home', '1085 Acanto Pl, Los Angeles, CA 90049', 34.0734, -118.4801, 100, '🏠')
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 3: CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_locations_member_id ON locations(member_id);
CREATE INDEX IF NOT EXISTS idx_location_history_member_id ON location_history(member_id);
CREATE INDEX IF NOT EXISTS idx_location_history_timestamp ON location_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_family_member ON documents(family_member_id);
CREATE INDEX IF NOT EXISTS idx_documents_due_date ON documents(due_date);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_calendar_events_member ON calendar_events(family_member_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_appointments_member ON appointments(family_member_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_photos_tags ON photos USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_photos_event ON photos(event);

-- ============================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: CREATE RLS POLICIES (allow all for family app)
-- ============================================

CREATE POLICY "Allow all on family_members" ON family_members FOR ALL USING (true);
CREATE POLICY "Allow all on locations" ON locations FOR ALL USING (true);
CREATE POLICY "Allow all on location_history" ON location_history FOR ALL USING (true);
CREATE POLICY "Allow all on places" ON places FOR ALL USING (true);
CREATE POLICY "Allow all on chat_messages" ON chat_messages FOR ALL USING (true);
CREATE POLICY "Allow all on documents" ON documents FOR ALL USING (true);
CREATE POLICY "Allow all on calendar_events" ON calendar_events FOR ALL USING (true);
CREATE POLICY "Allow all on calendar_subscriptions" ON calendar_subscriptions FOR ALL USING (true);
CREATE POLICY "Allow all on reminders" ON reminders FOR ALL USING (true);
CREATE POLICY "Allow all on appointments" ON appointments FOR ALL USING (true);
CREATE POLICY "Allow all on photos" ON photos FOR ALL USING (true);

-- ============================================
-- STEP 6: GRANT PERMISSIONS
-- ============================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- DONE! Tables created successfully.
-- ============================================
