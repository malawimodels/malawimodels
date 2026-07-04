-- Messaging, account deletion records, appeals, and notification dedupe.
-- Apply with Supabase CLI or SQL editor before enabling these production flows.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS delivered_via TEXT[] NOT NULL DEFAULT ARRAY['in_app']::TEXT[];

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe
  ON notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS account_deletion_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  former_user_id UUID,
  email_hash TEXT,
  role_snapshot TEXT,
  display_name_snapshot TEXT,
  deletion_count INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_records_former_user
  ON account_deletion_records(former_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_deletion_records_email_hash
  ON account_deletion_records(email_hash);

CREATE TABLE IF NOT EXISTS account_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deletion_record_id UUID REFERENCES account_deletion_records(id) ON DELETE SET NULL,
  contact_email TEXT NOT NULL,
  email_hash TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'denied')),
  warning_message TEXT,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_appeals_status_created
  ON account_appeals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_appeals_email_hash
  ON account_appeals(email_hash);

CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_type TEXT NOT NULL DEFAULT 'direct' CHECK (thread_type IN ('direct', 'support', 'group')),
  direct_key TEXT UNIQUE,
  title TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_threads_last_message
  ON message_threads(last_message_at DESC);

CREATE TABLE IF NOT EXISTS message_thread_participants (
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  muted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_thread_participants_user
  ON message_thread_participants(user_id, archived_at, thread_id);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT,
  voice_url TEXT,
  voice_public_id TEXT,
  voice_duration_seconds INTEGER,
  reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_has_content CHECK (body IS NOT NULL OR voice_url IS NOT NULL OR deleted_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_created
  ON messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_created
  ON messages(sender_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_deletions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(message_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_thread_participant(p_thread_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM message_thread_participants mtp
    WHERE mtp.thread_id = p_thread_id
      AND mtp.user_id = auth.uid()
      AND mtp.archived_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_or_create_direct_message_thread(p_other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  current_user_id UUID := auth.uid();
  direct_key_value TEXT;
  thread_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_other_user_id IS NULL OR p_other_user_id = current_user_id THEN
    RAISE EXCEPTION 'Choose a different recipient';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_other_user_id AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Recipient is not available';
  END IF;

  direct_key_value := LEAST(current_user_id::TEXT, p_other_user_id::TEXT) || ':' || GREATEST(current_user_id::TEXT, p_other_user_id::TEXT);

  SELECT id INTO thread_id
  FROM message_threads
  WHERE direct_key = direct_key_value
  LIMIT 1;

  IF thread_id IS NULL THEN
    INSERT INTO message_threads(thread_type, direct_key, created_by)
    VALUES ('direct', direct_key_value, current_user_id)
    RETURNING id INTO thread_id;

    INSERT INTO message_thread_participants(thread_id, user_id)
    VALUES (thread_id, current_user_id), (thread_id, p_other_user_id)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO message_thread_participants(thread_id, user_id)
    VALUES (thread_id, current_user_id), (thread_id, p_other_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.touch_message_thread()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_threads
  SET last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_touch_message_thread ON messages;
CREATE TRIGGER trg_touch_message_thread
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION public.touch_message_thread();

ALTER TABLE account_deletion_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read deletion records" ON account_deletion_records;
CREATE POLICY "Admins can read deletion records" ON account_deletion_records
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert deletion records" ON account_deletion_records;
CREATE POLICY "Admins can insert deletion records" ON account_deletion_records
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Anyone can submit account appeals" ON account_appeals;
CREATE POLICY "Anyone can submit account appeals" ON account_appeals
  FOR INSERT WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "Admins can read account appeals" ON account_appeals;
CREATE POLICY "Admins can read account appeals" ON account_appeals
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update account appeals" ON account_appeals;
CREATE POLICY "Admins can update account appeals" ON account_appeals
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Participants can read message threads" ON message_threads;
CREATE POLICY "Participants can read message threads" ON message_threads
  FOR SELECT USING (is_thread_participant(id) OR is_admin());

DROP POLICY IF EXISTS "Users can create message threads" ON message_threads;
CREATE POLICY "Users can create message threads" ON message_threads
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Participants can update message threads" ON message_threads;
CREATE POLICY "Participants can update message threads" ON message_threads
  FOR UPDATE USING (is_thread_participant(id) OR is_admin()) WITH CHECK (is_thread_participant(id) OR is_admin());

DROP POLICY IF EXISTS "Participants can read participants" ON message_thread_participants;
CREATE POLICY "Participants can read participants" ON message_thread_participants
  FOR SELECT USING (is_thread_participant(thread_id) OR user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users can add themselves as participants" ON message_thread_participants;
CREATE POLICY "Users can add themselves as participants" ON message_thread_participants
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users can update their participant state" ON message_thread_participants;
CREATE POLICY "Users can update their participant state" ON message_thread_participants
  FOR UPDATE USING (user_id = auth.uid() OR is_admin()) WITH CHECK (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Participants can read messages" ON messages;
CREATE POLICY "Participants can read messages" ON messages
  FOR SELECT USING (is_thread_participant(thread_id) OR is_admin());

DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages" ON messages
  FOR INSERT WITH CHECK (sender_id = auth.uid() AND is_thread_participant(thread_id));

DROP POLICY IF EXISTS "Senders can update messages" ON messages;
CREATE POLICY "Senders can update messages" ON messages
  FOR UPDATE USING (sender_id = auth.uid() OR is_admin()) WITH CHECK (sender_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users can read own message deletions" ON message_deletions;
CREATE POLICY "Users can read own message deletions" ON message_deletions
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users can delete messages for themselves" ON message_deletions;
CREATE POLICY "Users can delete messages for themselves" ON message_deletions
  FOR INSERT WITH CHECK (user_id = auth.uid());