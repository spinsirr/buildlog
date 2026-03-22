-- Token refresh state tracking (inspired by Nango)
ALTER TABLE public.platform_connections
  ADD COLUMN IF NOT EXISTS last_refresh_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_failures integer DEFAULT 0;

-- RPC to atomically increment refresh failures
CREATE OR REPLACE FUNCTION increment_refresh_failures(p_user_id uuid, p_platform text)
RETURNS void AS $$
BEGIN
  UPDATE platform_connections
  SET refresh_failures = COALESCE(refresh_failures, 0) + 1
  WHERE user_id = p_user_id AND platform = p_platform;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
