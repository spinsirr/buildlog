ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_key text,
  ADD COLUMN IF NOT EXISTS price_lookup_key text,
  ADD COLUMN IF NOT EXISTS access_status text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_invoice_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_plan_key_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_plan_key_check
      CHECK (plan_key IS NULL OR plan_key IN ('free', 'pro'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_access_status_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_access_status_check
      CHECK (access_status IN ('free', 'pro', 'grace_period', 'suspended'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.account_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  feature_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'stripe',
  source_event_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_key)
);

ALTER TABLE public.account_entitlements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own entitlements' AND tablename = 'account_entitlements'
  ) THEN
    CREATE POLICY "Users can read own entitlements" ON public.account_entitlements
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_account_entitlements_user_active
  ON public.account_entitlements (user_id, is_active);
