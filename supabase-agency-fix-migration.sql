-- =====================================================
-- AGENCY REQUESTS FIX MIGRATION
-- Add missing columns to agency_requests table
-- Execute this in Supabase SQL Editor
-- =====================================================

-- Add missing columns to agency_requests table
ALTER TABLE agency_requests
ADD COLUMN IF NOT EXISTS tiktok TEXT,
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add index for location for better query performance
CREATE INDEX IF NOT EXISTS idx_agency_requests_location ON agency_requests(location);

-- Verify the migration
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agency_requests' 
ORDER BY ordinal_position;
