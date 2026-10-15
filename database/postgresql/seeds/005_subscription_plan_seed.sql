BEGIN;

INSERT INTO finance.subscription_plans
  (plan_code, plan_name_ar, plan_name_en, subscriber_scope_code, tier_code,
   billing_period_code, base_price, currency_code, included_membership_count,
   additional_membership_price, trial_days, effective_from)
VALUES
  ('IND_FREE', 'الفردية المجانية', 'Individual Free', 'INDIVIDUAL', 'FREE',
   'MONTHLY', 0, 'USD', 1, 0, 0, DATE '2026-01-01'),
  ('IND_SILVER_M', 'الفردية الفضية الشهرية', 'Individual Silver Monthly', 'INDIVIDUAL', 'SILVER',
   'MONTHLY', 0, 'USD', 1, 0, 0, DATE '2026-01-01'),
  ('IND_SILVER_Y', 'الفردية الفضية السنوية', 'Individual Silver Annual', 'INDIVIDUAL', 'SILVER',
   'ANNUAL', 0, 'USD', 1, 0, 0, DATE '2026-01-01'),
  ('IND_GOLD_M', 'الفردية الذهبية الشهرية', 'Individual Gold Monthly', 'INDIVIDUAL', 'GOLD',
   'MONTHLY', 0, 'USD', 1, 0, 0, DATE '2026-01-01'),
  ('IND_GOLD_Y', 'الفردية الذهبية السنوية', 'Individual Gold Annual', 'INDIVIDUAL', 'GOLD',
   'ANNUAL', 0, 'USD', 1, 0, 0, DATE '2026-01-01'),
  ('ORG_SILVER_M', 'المؤسسية الفضية الشهرية', 'Organization Silver Monthly', 'ORGANIZATION', 'SILVER',
   'MONTHLY', 0, 'USD', 5, 0, 0, DATE '2026-01-01'),
  ('ORG_SILVER_Y', 'المؤسسية الفضية السنوية', 'Organization Silver Annual', 'ORGANIZATION', 'SILVER',
   'ANNUAL', 0, 'USD', 5, 0, 0, DATE '2026-01-01'),
  ('ORG_GOLD_M', 'المؤسسية الذهبية الشهرية', 'Organization Gold Monthly', 'ORGANIZATION', 'GOLD',
   'MONTHLY', 0, 'USD', 10, 0, 0, DATE '2026-01-01'),
  ('ORG_GOLD_Y', 'المؤسسية الذهبية السنوية', 'Organization Gold Annual', 'ORGANIZATION', 'GOLD',
   'ANNUAL', 0, 'USD', 10, 0, 0, DATE '2026-01-01')
ON CONFLICT (plan_code, billing_period_code, effective_from) DO UPDATE SET
  plan_name_ar = EXCLUDED.plan_name_ar,
  plan_name_en = EXCLUDED.plan_name_en,
  subscriber_scope_code = EXCLUDED.subscriber_scope_code,
  tier_code = EXCLUDED.tier_code,
  included_membership_count = EXCLUDED.included_membership_count,
  is_active = true;

COMMIT;
