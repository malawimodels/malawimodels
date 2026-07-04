-- Messaging permissions, pinned conversations, and one-time unread edits.

ALTER TABLE message_thread_participants
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_message_thread_participants_user_pinned
  ON message_thread_participants(user_id, pinned_at DESC NULLS LAST, thread_id);

CREATE OR REPLACE FUNCTION public.can_message_user(p_other_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_role TEXT;
  other_role TEXT;
BEGIN
  IF current_user_id IS NULL OR p_other_user_id IS NULL OR p_other_user_id = current_user_id THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO current_role
  FROM users
  WHERE id = current_user_id AND is_active = TRUE;

  SELECT role INTO other_role
  FROM users
  WHERE id = p_other_user_id AND is_active = TRUE;

  IF current_role IS NULL OR other_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF current_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF other_role = 'admin' AND current_role IN ('model', 'agency') THEN
    RETURN TRUE;
  END IF;

  IF current_role = 'agency' AND other_role = 'model' THEN
    RETURN EXISTS (
      SELECT 1
      FROM models m
      WHERE m.id = p_other_user_id
        AND m.agency_id = current_user_id
    );
  END IF;

  IF current_role = 'model' AND other_role = 'agency' THEN
    RETURN EXISTS (
      SELECT 1
      FROM models m
      WHERE m.id = current_user_id
        AND m.agency_id = p_other_user_id
    );
  END IF;

  IF current_role = 'client' AND other_role = 'model' THEN
    RETURN EXISTS (
      SELECT 1
      FROM projects p
      JOIN project_applications pa ON pa.project_id = p.id
      WHERE p.owner_id = current_user_id
        AND pa.model_id = p_other_user_id
    ) OR EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.client_id = current_user_id
        AND b.model_id = p_other_user_id
    );
  END IF;

  IF current_role = 'model' AND other_role = 'client' THEN
    RETURN EXISTS (
      SELECT 1
      FROM projects p
      JOIN project_applications pa ON pa.project_id = p.id
      WHERE p.owner_id = p_other_user_id
        AND pa.model_id = current_user_id
    ) OR EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.client_id = p_other_user_id
        AND b.model_id = current_user_id
    );
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_message_recipients(p_query TEXT DEFAULT '')
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  email TEXT,
  role TEXT,
  photo_url TEXT
) AS $$
DECLARE
  normalized_query TEXT := LOWER(TRIM(COALESCE(p_query, '')));
BEGIN
  RETURN QUERY
  SELECT u.id, u.display_name, u.email, u.role, u.photo_url
  FROM users u
  WHERE u.is_active = TRUE
    AND u.id <> auth.uid()
    AND public.can_message_user(u.id)
    AND (
      normalized_query = ''
      OR LOWER(COALESCE(u.display_name, '')) LIKE '%' || normalized_query || '%'
      OR LOWER(COALESCE(u.email, '')) LIKE '%' || normalized_query || '%'
    )
  ORDER BY COALESCE(u.display_name, u.email) ASC
  LIMIT 80;
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

  IF NOT public.can_message_user(p_other_user_id) THEN
    RAISE EXCEPTION 'You cannot message this user yet';
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
  END IF;

  INSERT INTO message_thread_participants(thread_id, user_id)
  VALUES (thread_id, current_user_id), (thread_id, p_other_user_id)
  ON CONFLICT DO NOTHING;

  RETURN thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.mark_message_thread_read(p_thread_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE message_thread_participants
  SET last_read_at = NOW()
  WHERE thread_id = p_thread_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.edit_message_once(p_message_id UUID, p_body TEXT)
RETURNS VOID AS $$
DECLARE
  current_user_id UUID := auth.uid();
  message_row messages%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO message_row
  FROM messages
  WHERE id = p_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF message_row.sender_id <> current_user_id THEN
    RAISE EXCEPTION 'You can edit only your own messages';
  END IF;

  IF message_row.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Deleted messages cannot be edited';
  END IF;

  IF message_row.edit_count > 0 THEN
    RAISE EXCEPTION 'This message has already been edited';
  END IF;

  IF TRIM(COALESCE(p_body, '')) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM message_thread_participants mtp
    WHERE mtp.thread_id = message_row.thread_id
      AND mtp.user_id <> current_user_id
      AND mtp.last_read_at IS NOT NULL
      AND mtp.last_read_at >= message_row.created_at
  ) THEN
    RAISE EXCEPTION 'Messages can be edited only before another participant reads them';
  END IF;

  UPDATE messages
  SET body = TRIM(p_body),
      edit_count = edit_count + 1,
      edited_at = NOW(),
      updated_at = NOW()
  WHERE id = p_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;