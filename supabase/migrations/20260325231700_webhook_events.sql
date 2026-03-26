-- Webhook events table for idempotent processing
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'stripe',
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed — only accessed by service role in edge functions
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events (event_id);
