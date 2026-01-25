-- Add last_activity and ended_at columns to programs table
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_programs_last_activity ON programs(last_activity);
CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);

-- Function to mark rooms as inactive after 24 hours of no activity
CREATE OR REPLACE FUNCTION mark_inactive_rooms()
RETURNS void AS $$
BEGIN
  UPDATE programs
  SET status = 'inactive',
      ended_at = NOW()
  WHERE status = 'active'
    AND last_activity < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Function to delete old inactive/ended rooms after 7 days
CREATE OR REPLACE FUNCTION cleanup_old_rooms()
RETURNS void AS $$
BEGIN
  DELETE FROM programs
  WHERE status IN ('inactive', 'ended')
    AND (ended_at < NOW() - INTERVAL '7 days' 
         OR created_at < NOW() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;

-- Enable pg_cron if not already enabled (requires superuser)
-- Run these commands in Supabase SQL Editor if pg_cron is available:
-- SELECT cron.schedule('mark-inactive-rooms', '0 * * * *', 'SELECT mark_inactive_rooms()');
-- SELECT cron.schedule('cleanup-old-rooms', '0 0 * * *', 'SELECT cleanup_old_rooms()');

-- Trigger to update last_activity on any update
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_programs_last_activity
  BEFORE UPDATE ON programs
  FOR EACH ROW
  EXECUTE FUNCTION update_last_activity();

-- Comment with instructions
COMMENT ON FUNCTION mark_inactive_rooms() IS 'Marks rooms as inactive after 24 hours of no activity';
COMMENT ON FUNCTION cleanup_old_rooms() IS 'Deletes rooms that have been inactive/ended for 7+ days';
