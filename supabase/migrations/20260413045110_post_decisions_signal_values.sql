-- Ranker architecture: post_decisions.decision used to be gatekeeper values
-- (post / skip / bundle_later) but now carries ranker signal values
-- (high / low / error). Relax the CHECK constraint so both shapes are valid —
-- legacy rows stay readable, new inserts succeed.

ALTER TABLE public.post_decisions
  DROP CONSTRAINT IF EXISTS post_decisions_decision_check;

ALTER TABLE public.post_decisions
  ADD CONSTRAINT post_decisions_decision_check
  CHECK (decision IN ('high', 'low', 'error', 'post', 'skip', 'bundle_later'));
