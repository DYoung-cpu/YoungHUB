-- Family Tracking Database Setup for Supabase
-- Run this in Supabase SQL Editor
--
-- IMPORTANT: Before running this SQL, create the storage bucket:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name: "family-vault"
-- 4. Check "Public bucket"
-- 5. Click "Create bucket"

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

-- ============================================
-- FAMILY VAULT (FV) TABLES
-- ============================================

-- Enable real-time for FV tables
ALTER PUBLICATION supabase_realtime ADD TABLE documents;
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE reminders;

-- 11. Documents Table - Core document storage
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT, -- pdf, image, etc
  file_size INTEGER,

  -- Categorization
  category TEXT, -- insurance, mortgage, bank, medical, tax, housing
  subcategory TEXT,
  tags TEXT[],

  -- Ownership & Association
  family_member_id UUID REFERENCES family_members(id),
  property_address TEXT,
  account_number TEXT,
  provider TEXT, -- Mercury Insurance, US Bank, Chase, etc.

  -- Extracted data (from AI parsing)
  extracted_text TEXT,
  extracted_data JSONB, -- structured data
  summary TEXT,

  -- Important dates
  document_date DATE,
  due_date DATE,
  expiration_date DATE,

  -- Metadata
  uploaded_by UUID REFERENCES family_members(id),
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Calendar Events Table - Lisa's work schedule, appointments, vacations
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,

  -- Event details
  title TEXT NOT NULL,
  event_type TEXT NOT NULL, -- office, wfh, vacation, appointment, bill_due, reminder
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN DEFAULT true,

  -- Location (for office days)
  location TEXT,

  -- Recurring
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- weekly, monthly, yearly

  -- Linked items
  document_id UUID REFERENCES documents(id),

  -- Notes
  notes TEXT,
  color TEXT DEFAULT '#3b82f6',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Calendar Subscriptions - Who gets notified when someone updates calendar
CREATE TABLE IF NOT EXISTS calendar_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id UUID REFERENCES family_members(id) ON DELETE CASCADE, -- David
  target_id UUID REFERENCES family_members(id) ON DELETE CASCADE, -- Lisa
  notify_on_update BOOLEAN DEFAULT true,
  notify_types TEXT[] DEFAULT ARRAY['office', 'wfh', 'vacation', 'appointment'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscriber_id, target_id)
);

-- 14. Reminders Table - Bill due dates, renewals, appointments
CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- What to remind about
  title TEXT NOT NULL,
  description TEXT,
  reminder_type TEXT NOT NULL, -- bill, appointment, renewal, deadline, custom

  -- Timing
  due_date TIMESTAMPTZ NOT NULL,
  remind_days_before INTEGER[] DEFAULT '{7,3,1}',

  -- Status
  status TEXT DEFAULT 'active', -- active, snoozed, completed, dismissed
  snoozed_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Links
  document_id UUID REFERENCES documents(id),
  calendar_event_id UUID REFERENCES calendar_events(id),
  family_member_id UUID REFERENCES family_members(id),

  -- Notification settings
  notify_push BOOLEAN DEFAULT true,
  notify_david BOOLEAN DEFAULT true,
  notify_lisa BOOLEAN DEFAULT true,

  -- Recurring
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Appointments Table - Medical, legal, etc.
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Who
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,

  -- What
  title TEXT NOT NULL,
  description TEXT,
  appointment_type TEXT, -- medical, legal, financial, school, personal
  provider_name TEXT, -- Doctor name, lawyer, etc.

  -- When
  appointment_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,

  -- Where
  location TEXT,
  address TEXT,

  -- Notes
  notes TEXT,
  preparation_notes TEXT, -- "Bring insurance card", "Fast for 12 hours"

  -- Links
  reminder_id UUID REFERENCES reminders(id),
  calendar_event_id UUID REFERENCES calendar_events(id),

  -- Recurring
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,

  -- Status
  status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled, rescheduled

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Photos Table - Family photo dump
CREATE TABLE IF NOT EXISTS photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,

  -- Metadata
  description TEXT,
  tags TEXT[],
  taken_date TIMESTAMPTZ,

  -- People & Events
  tagged_members UUID[], -- family members in photo
  event TEXT, -- "Jacob's 2nd Birthday", "Christmas 2024"

  -- Favorites
  is_favorite BOOLEAN DEFAULT false,

  -- Upload info
  uploaded_by UUID REFERENCES family_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Create indexes for FV tables
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

-- 18. RLS Policies for FV tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family can manage documents" ON documents FOR ALL USING (true);
CREATE POLICY "Family can manage calendar_events" ON calendar_events FOR ALL USING (true);
CREATE POLICY "Family can manage calendar_subscriptions" ON calendar_subscriptions FOR ALL USING (true);
CREATE POLICY "Family can manage reminders" ON reminders FOR ALL USING (true);
CREATE POLICY "Family can manage appointments" ON appointments FOR ALL USING (true);
CREATE POLICY "Family can manage photos" ON photos FOR ALL USING (true);

-- 19. Function to notify on calendar update
CREATE OR REPLACE FUNCTION notify_calendar_update()
RETURNS TRIGGER AS $$
BEGIN
  -- This will trigger Supabase Realtime which the app listens to
  PERFORM pg_notify(
    'calendar_update',
    json_build_object(
      'event_id', NEW.id,
      'member_id', NEW.family_member_id,
      'event_type', NEW.event_type,
      'event_date', NEW.event_date,
      'action', TG_OP
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_event_notify
  AFTER INSERT OR UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_calendar_update();

-- 20. Insert calendar subscriptions (David subscribes to Lisa's updates)
INSERT INTO calendar_subscriptions (subscriber_id, target_id, notify_on_update)
SELECT
  (SELECT id FROM family_members WHERE email = 'dyoung1946@gmail.com'),
  (SELECT id FROM family_members WHERE email = 'lisa.young@gmail.com'),
  true
ON CONFLICT DO NOTHING;

-- Lisa subscribes to David's updates
INSERT INTO calendar_subscriptions (subscriber_id, target_id, notify_on_update)
SELECT
  (SELECT id FROM family_members WHERE email = 'lisa.young@gmail.com'),
  (SELECT id FROM family_members WHERE email = 'dyoung1946@gmail.com'),
  true
ON CONFLICT DO NOTHING;

-- ============================================
-- STORAGE BUCKET POLICIES
-- ============================================
-- Note: The bucket "family-vault" must be created manually in the Dashboard first

-- 21. Storage policies for family-vault bucket
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'family-vault');

-- Allow authenticated users to update their files
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'family-vault');

-- Allow authenticated users to read all files
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'family-vault');

-- Allow authenticated users to delete files
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'family-vault');

-- Allow public read access (since bucket is public)
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'family-vault');

-- ============================================
-- PUSH NOTIFICATIONS & NOTIFICATION PREFERENCES
-- ============================================

-- 22. Push Subscriptions Table - Web Push subscriptions for each device
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,

  -- Web Push subscription data
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL, -- { p256dh: "...", auth: "..." }

  -- Device info
  device_name TEXT,
  user_agent TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(endpoint) -- Each endpoint is unique
);

-- 23. Notification Preferences Table - What notifications each member wants
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,

  -- Email settings
  email_enabled BOOLEAN DEFAULT true,
  email_address TEXT,

  -- Push settings
  push_enabled BOOLEAN DEFAULT true,

  -- What to notify about
  notify_bills BOOLEAN DEFAULT true,
  notify_calendar BOOLEAN DEFAULT true,
  notify_urgent_items BOOLEAN DEFAULT true,
  notify_document_uploads BOOLEAN DEFAULT true,
  notify_family_location BOOLEAN DEFAULT false,

  -- Timing
  days_before_due INTEGER[] DEFAULT '{7,3,1}',
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(family_member_id)
);

-- 24. Notification Log Table - Track sent notifications
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Who received it
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,

  -- What type
  notification_type TEXT NOT NULL, -- 'push', 'email'
  category TEXT, -- 'bill_reminder', 'calendar_update', 'urgent_item', etc.

  -- Content
  title TEXT NOT NULL,
  body TEXT,

  -- Related items
  document_id UUID REFERENCES documents(id),
  reminder_id UUID REFERENCES reminders(id),
  calendar_event_id UUID REFERENCES calendar_events(id),

  -- Status
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'clicked'
  error_message TEXT,

  -- Metadata
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. Create indexes for notification tables
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_member ON push_subscriptions(family_member_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_member ON notification_preferences(family_member_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_member ON notification_log(family_member_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at ON notification_log(sent_at);

-- 26. RLS Policies for notification tables
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family can manage push_subscriptions" ON push_subscriptions FOR ALL USING (true);
CREATE POLICY "Family can manage notification_preferences" ON notification_preferences FOR ALL USING (true);
CREATE POLICY "Family can view notification_log" ON notification_log FOR ALL USING (true);

-- 27. Insert default notification preferences for David and Lisa
INSERT INTO notification_preferences (family_member_id, email_address)
SELECT id, email FROM family_members WHERE email IN ('dyoung1946@gmail.com', 'lisa.young@gmail.com')
ON CONFLICT (family_member_id) DO NOTHING;

-- Enable real-time for notification tables
ALTER PUBLICATION supabase_realtime ADD TABLE push_subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE notification_preferences;

-- ============================================
-- VERSION TRACKING FOR DOCUMENTS
-- ============================================

-- 28. Add version tracking columns to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES documents(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT true;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS statement_period_start DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS statement_period_end DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;

-- 29. Create index for version tracking
CREATE INDEX IF NOT EXISTS idx_documents_supersedes ON documents(supersedes_id);
CREATE INDEX IF NOT EXISTS idx_documents_is_latest ON documents(is_latest);

-- ============================================
-- SETUP COMPLETE
-- ============================================
-- Next steps:
-- 1. Create "family-vault" bucket in Storage (if not done)
-- 2. Run: node scripts/upload-documents.js
-- 3. Start app: npm run dev
-- 4. Add VAPID keys to Vercel environment variables
-- 5. Set up Gmail API credentials for email notifications