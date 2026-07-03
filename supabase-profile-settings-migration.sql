-- =====================================================
-- MALAWI MODELS - PROFILE SETTINGS MIGRATION
-- Adds age storage and enforces 24-hour display-name changes.
-- Run this once in the Supabase SQL Editor.
-- =====================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name_changed_at TIMESTAMPTZ;

ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age IS NULL OR (age >= 16 AND age <= 65));

CREATE INDEX IF NOT EXISTS idx_models_age ON public.models(age);

CREATE OR REPLACE FUNCTION public.enforce_display_name_cooldown()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.display_name IS DISTINCT FROM NEW.display_name THEN
    IF OLD.display_name_changed_at IS NOT NULL
       AND OLD.display_name_changed_at > NOW() - INTERVAL '24 hours' THEN
      RAISE EXCEPTION 'Display name can be changed again after %',
        OLD.display_name_changed_at + INTERVAL '24 hours';
    END IF;

    NEW.display_name_changed_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_display_name_cooldown_trigger ON public.users;

CREATE TRIGGER enforce_display_name_cooldown_trigger
  BEFORE UPDATE OF display_name ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_display_name_cooldown();
