-- Let any participant delete a message for everyone without opening broad message updates.

CREATE OR REPLACE FUNCTION public.delete_message_for_everyone(p_message_id UUID)
RETURNS UUID AS $$
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

  IF NOT public.is_thread_participant(message_row.thread_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'You are not allowed to delete this message';
  END IF;

  UPDATE messages
  SET body = NULL,
      voice_url = NULL,
      voice_public_id = NULL,
      deleted_at = COALESCE(deleted_at, NOW()),
      deleted_by = COALESCE(deleted_by, current_user_id),
      updated_at = NOW()
  WHERE id = p_message_id;

  RETURN message_row.thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';