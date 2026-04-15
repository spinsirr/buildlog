-- Revert of 20260414224500_billing_access_and_entitlements.sql
-- Paired with PR that reverts spinsirr/buildlog#18.
--
-- WARNING: dropping subscriptions.plan_key / access_status / etc. is destructive.
-- Any values written by the reverted stripe-webhook / billing code will be lost.
-- If you need to preserve them, dump these columns before applying this migration.

-- 1. Tear down account_entitlements (drops its policy, RLS, and index as a side effect).
DROP TABLE IF EXISTS public.account_entitlements;

-- 2. Drop check constraints on subscriptions (if present).
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_key_check;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_access_status_check;

-- 3. Drop columns added by the reverted migration.
ALTER TABLE public.subscriptions
  DROP COLUMN IF EXISTS plan_key,
  DROP COLUMN IF EXISTS price_lookup_key,
  DROP COLUMN IF EXISTS access_status,
  DROP COLUMN IF EXISTS cancel_at_period_end,
  DROP COLUMN IF EXISTS trial_ends_at,
  DROP COLUMN IF EXISTS last_invoice_id;
