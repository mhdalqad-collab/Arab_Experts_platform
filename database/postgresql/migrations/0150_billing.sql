BEGIN;

CREATE TABLE finance.subscription_plans (
  subscription_plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code varchar(50) NOT NULL,
  plan_name_ar varchar(160) NOT NULL,
  plan_name_en varchar(160) NOT NULL,
  subscriber_scope_code varchar(20) NOT NULL
    CHECK (subscriber_scope_code IN ('INDIVIDUAL', 'ORGANIZATION')),
  tier_code varchar(30) NOT NULL
    CHECK (tier_code IN ('FREE', 'SILVER', 'GOLD', 'CUSTOM')),
  billing_period_code varchar(20) NOT NULL
    CHECK (billing_period_code IN ('MONTHLY', 'ANNUAL')),
  base_price numeric(18,3) NOT NULL CHECK (base_price >= 0),
  currency_code char(3) NOT NULL REFERENCES reference.currencies(currency_code),
  included_membership_count integer NOT NULL DEFAULT 1 CHECK (included_membership_count > 0),
  additional_membership_price numeric(18,3) NOT NULL DEFAULT 0
    CHECK (additional_membership_price >= 0),
  trial_days integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  effective_from date NOT NULL,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_subscription_plan_period CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (plan_code, billing_period_code, effective_from)
);

CREATE TABLE finance.plan_features (
  plan_feature_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_plan_id uuid NOT NULL
    REFERENCES finance.subscription_plans(subscription_plan_id) ON DELETE CASCADE,
  feature_code varchar(60) NOT NULL,
  feature_name_ar varchar(180) NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  limit_value numeric(18,3),
  limit_unit varchar(40),
  display_order integer NOT NULL CHECK (display_order > 0),
  UNIQUE (subscription_plan_id, feature_code)
);

CREATE TABLE finance.subscriptions (
  subscription_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_number varchar(40) NOT NULL UNIQUE,
  subscriber_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  subscription_plan_id uuid NOT NULL
    REFERENCES finance.subscription_plans(subscription_plan_id) ON DELETE RESTRICT,
  billing_cycle_code varchar(20) NOT NULL
    CHECK (billing_cycle_code IN ('MONTHLY', 'ANNUAL')),
  membership_quantity integer NOT NULL DEFAULT 1 CHECK (membership_quantity > 0),
  status_code varchar(30) NOT NULL DEFAULT 'PENDING_PAYMENT'
    CHECK (status_code IN (
      'PENDING_PAYMENT', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD',
      'SUSPENDED', 'CANCELLATION_PENDING', 'CANCELLED', 'EXPIRED'
    )),
  start_date date,
  current_period_start date,
  current_period_end date,
  renewal_date date,
  auto_renew boolean NOT NULL DEFAULT true,
  cancellation_requested_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_subscription_period
    CHECK (
      current_period_end IS NULL OR current_period_start IS NULL
      OR current_period_end >= current_period_start
    )
);

CREATE TABLE finance.subscription_memberships (
  subscription_membership_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL
    REFERENCES finance.subscriptions(subscription_id) ON DELETE CASCADE,
  membership_id uuid NOT NULL
    REFERENCES membership.memberships(membership_id) ON DELETE RESTRICT,
  coverage_start date NOT NULL,
  coverage_end date,
  status_code varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status_code IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'ENDED')),
  CONSTRAINT ck_subscription_membership_period
    CHECK (coverage_end IS NULL OR coverage_end >= coverage_start),
  UNIQUE (subscription_id, membership_id, coverage_start)
);

CREATE TABLE finance.subscription_changes (
  subscription_change_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL
    REFERENCES finance.subscriptions(subscription_id) ON DELETE RESTRICT,
  change_type_code varchar(30) NOT NULL
    CHECK (change_type_code IN ('UPGRADE', 'DOWNGRADE', 'ADD_MEMBERSHIPS', 'REMOVE_MEMBERSHIPS', 'BILLING_CYCLE')),
  old_value_json jsonb NOT NULL,
  new_value_json jsonb NOT NULL,
  effective_at timestamptz NOT NULL,
  proration_amount numeric(18,3),
  currency_code char(3) REFERENCES reference.currencies(currency_code),
  approved_by_party_id uuid REFERENCES core.parties(party_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_subscription_change_proration
    CHECK (proration_amount IS NULL OR currency_code IS NOT NULL)
);

CREATE TABLE finance.renewal_orders (
  renewal_order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL
    REFERENCES finance.subscriptions(subscription_id) ON DELETE RESTRICT,
  old_plan_id uuid NOT NULL REFERENCES finance.subscription_plans(subscription_plan_id),
  new_plan_id uuid NOT NULL REFERENCES finance.subscription_plans(subscription_plan_id),
  membership_quantity integer NOT NULL CHECK (membership_quantity > 0),
  renewal_period_start date NOT NULL,
  renewal_period_end date NOT NULL,
  calculated_amount numeric(18,3) NOT NULL CHECK (calculated_amount >= 0),
  currency_code char(3) NOT NULL REFERENCES reference.currencies(currency_code),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'INVOICED', 'PAID', 'APPLIED', 'CANCELLED', 'FAILED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_renewal_period CHECK (renewal_period_end >= renewal_period_start)
);

CREATE TABLE finance.invoices (
  invoice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number varchar(50) NOT NULL UNIQUE,
  invoice_type_code varchar(20) NOT NULL DEFAULT 'INVOICE'
    CHECK (invoice_type_code IN ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE')),
  bill_to_party_id uuid NOT NULL REFERENCES core.parties(party_id) ON DELETE RESTRICT,
  source_entity_type varchar(60) NOT NULL,
  source_entity_id uuid NOT NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  currency_code char(3) NOT NULL REFERENCES reference.currencies(currency_code),
  subtotal_amount numeric(18,3) NOT NULL CHECK (subtotal_amount >= 0),
  discount_amount numeric(18,3) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount numeric(18,3) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(18,3)
    GENERATED ALWAYS AS (subtotal_amount - discount_amount + tax_amount) STORED,
  paid_amount numeric(18,3) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  balance_amount numeric(18,3)
    GENERATED ALWAYS AS (subtotal_amount - discount_amount + tax_amount - paid_amount) STORED,
  status_code varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN (
      'DRAFT', 'APPROVED', 'ISSUED', 'PARTIALLY_PAID',
      'PAID', 'OVERDUE', 'DISPUTED', 'VOID', 'CREDITED'
    )),
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_invoice_dates CHECK (due_date >= issue_date),
  CONSTRAINT ck_invoice_discount CHECK (discount_amount <= subtotal_amount),
  CONSTRAINT ck_invoice_paid_total
    CHECK (paid_amount <= subtotal_amount - discount_amount + tax_amount)
);

CREATE TABLE finance.invoice_lines (
  invoice_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES finance.invoices(invoice_id) ON DELETE CASCADE,
  line_no integer NOT NULL CHECK (line_no > 0),
  item_type_code varchar(40) NOT NULL,
  item_reference_id uuid,
  description_ar varchar(500) NOT NULL,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(18,3) NOT NULL CHECK (unit_price >= 0),
  discount_amount numeric(18,3) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
  tax_amount numeric(18,3) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total numeric(18,3)
    GENERATED ALWAYS AS (round(quantity * unit_price - discount_amount + tax_amount, 3)) STORED,
  CONSTRAINT ck_invoice_line_discount CHECK (discount_amount <= quantity * unit_price),
  UNIQUE (invoice_id, line_no)
);

CREATE TABLE finance.payment_schedules (
  payment_schedule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES finance.contracts(contract_id) ON DELETE RESTRICT,
  installment_no integer NOT NULL CHECK (installment_no > 0),
  milestone_id uuid REFERENCES delivery.milestones(milestone_id),
  trigger_type_code varchar(30) NOT NULL,
  due_date date,
  due_percentage numeric(6,3)
    CHECK (due_percentage IS NULL OR due_percentage BETWEEN 0 AND 100),
  due_amount numeric(18,3) CHECK (due_amount IS NULL OR due_amount >= 0),
  currency_code char(3) REFERENCES reference.currencies(currency_code),
  status_code varchar(20) NOT NULL DEFAULT 'PLANNED'
    CHECK (status_code IN ('PLANNED', 'DUE', 'INVOICED', 'PAID', 'WAIVED', 'CANCELLED')),
  CONSTRAINT ck_payment_schedule_value
    CHECK (due_percentage IS NOT NULL OR (due_amount IS NOT NULL AND currency_code IS NOT NULL)),
  UNIQUE (contract_id, installment_no)
);

CREATE TABLE finance.payments (
  payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference varchar(80) NOT NULL UNIQUE,
  payer_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  payment_method_code varchar(40) NOT NULL,
  gateway_provider_code varchar(40),
  gateway_transaction_id varchar(180),
  amount numeric(18,3) NOT NULL CHECK (amount > 0),
  currency_code char(3) NOT NULL REFERENCES reference.currencies(currency_code),
  payment_status_code varchar(30) NOT NULL DEFAULT 'INITIATED'
    CHECK (payment_status_code IN (
      'INITIATED', 'PENDING', 'AUTHORIZED', 'CAPTURED',
      'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED'
    )),
  idempotency_key uuid NOT NULL UNIQUE,
  initiated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  authorized_at timestamptz,
  captured_at timestamptz,
  failed_at timestamptz,
  failure_code varchar(60),
  failure_message text,
  gateway_payload_redacted jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX uq_gateway_transaction
  ON finance.payments(gateway_provider_code, gateway_transaction_id)
  WHERE gateway_transaction_id IS NOT NULL;

CREATE TABLE finance.payment_allocations (
  payment_allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES finance.payments(payment_id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES finance.invoices(invoice_id) ON DELETE RESTRICT,
  allocated_amount numeric(18,3) NOT NULL CHECK (allocated_amount > 0),
  allocated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (payment_id, invoice_id)
);

CREATE TABLE finance.refund_requests (
  refund_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES finance.payments(payment_id) ON DELETE RESTRICT,
  invoice_id uuid REFERENCES finance.invoices(invoice_id) ON DELETE RESTRICT,
  requested_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  requested_amount numeric(18,3) NOT NULL CHECK (requested_amount > 0),
  reason_code varchar(50) NOT NULL,
  reason_details text,
  status_code varchar(30) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status_code IN (
      'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING',
      'COMPLETED', 'REJECTED', 'FAILED', 'WITHDRAWN'
    )),
  reviewed_by_party_id uuid REFERENCES core.parties(party_id),
  decision_at timestamptz,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE finance.refunds (
  refund_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_request_id uuid NOT NULL UNIQUE
    REFERENCES finance.refund_requests(refund_request_id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL REFERENCES finance.payments(payment_id) ON DELETE RESTRICT,
  amount numeric(18,3) NOT NULL CHECK (amount > 0),
  currency_code char(3) NOT NULL REFERENCES reference.currencies(currency_code),
  gateway_refund_id varchar(180),
  status_code varchar(20) NOT NULL DEFAULT 'PROCESSING'
    CHECK (status_code IN ('PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  processed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE finance.billing_disputes (
  billing_dispute_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES finance.invoices(invoice_id) ON DELETE RESTRICT,
  raised_by_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  dispute_type_code varchar(50) NOT NULL,
  description text NOT NULL,
  disputed_amount numeric(18,3) CHECK (disputed_amount IS NULL OR disputed_amount > 0),
  status_code varchar(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status_code IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED')),
  resolution_code varchar(50),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE finance.provider_settlements (
  provider_settlement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_party_id uuid NOT NULL REFERENCES core.parties(party_id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_amount numeric(18,3) NOT NULL CHECK (gross_amount >= 0),
  platform_fee_amount numeric(18,3) NOT NULL DEFAULT 0 CHECK (platform_fee_amount >= 0),
  tax_amount numeric(18,3) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  refund_deduction numeric(18,3) NOT NULL DEFAULT 0 CHECK (refund_deduction >= 0),
  net_amount numeric(18,3)
    GENERATED ALWAYS AS (gross_amount - platform_fee_amount - tax_amount - refund_deduction) STORED,
  currency_code char(3) NOT NULL REFERENCES reference.currencies(currency_code),
  status_code varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status_code IN ('DRAFT', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'ON_HOLD')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_provider_settlement_period CHECK (period_end >= period_start),
  CONSTRAINT ck_provider_settlement_nonnegative
    CHECK (gross_amount >= platform_fee_amount + tax_amount + refund_deduction)
);

CREATE OR REPLACE FUNCTION finance.validate_invoice_before_issue()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  line_subtotal numeric(18,3);
  line_discount numeric(18,3);
  line_tax numeric(18,3);
BEGIN
  IF NEW.status_code IN ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'DISPUTED')
     AND OLD.status_code IS DISTINCT FROM NEW.status_code THEN
    SELECT
      COALESCE(round(sum(quantity * unit_price), 3), 0),
      COALESCE(round(sum(discount_amount), 3), 0),
      COALESCE(round(sum(tax_amount), 3), 0)
      INTO line_subtotal, line_discount, line_tax
      FROM finance.invoice_lines
     WHERE invoice_id = NEW.invoice_id;

    IF line_subtotal <> NEW.subtotal_amount
       OR line_discount <> NEW.discount_amount
       OR line_tax <> NEW.tax_amount THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Invoice header totals must equal the sum of invoice lines before issue.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION finance.validate_payment_allocation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payment_total numeric(18,3);
  payment_currency char(3);
  payment_status varchar(30);
  allocated_to_payment numeric(18,3);
  invoice_total numeric(18,3);
  invoice_currency char(3);
  allocated_to_invoice numeric(18,3);
BEGIN
  SELECT amount, currency_code, payment_status_code
    INTO payment_total, payment_currency, payment_status
    FROM finance.payments
   WHERE payment_id = NEW.payment_id;

  SELECT total_amount, currency_code
    INTO invoice_total, invoice_currency
    FROM finance.invoices
   WHERE invoice_id = NEW.invoice_id;

  IF payment_status NOT IN ('CAPTURED', 'PARTIALLY_REFUNDED') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Only captured payments can be allocated.';
  END IF;

  IF payment_currency <> invoice_currency THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Payment and invoice currencies must match.';
  END IF;

  SELECT COALESCE(sum(allocated_amount), 0)
    INTO allocated_to_payment
    FROM finance.payment_allocations
   WHERE payment_id = NEW.payment_id
     AND payment_allocation_id IS DISTINCT FROM NEW.payment_allocation_id;

  SELECT COALESCE(sum(allocated_amount), 0)
    INTO allocated_to_invoice
    FROM finance.payment_allocations
   WHERE invoice_id = NEW.invoice_id
     AND payment_allocation_id IS DISTINCT FROM NEW.payment_allocation_id;

  IF allocated_to_payment + NEW.allocated_amount > payment_total THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Payment allocations cannot exceed the captured payment amount.';
  END IF;

  IF allocated_to_invoice + NEW.allocated_amount > invoice_total THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Payment allocation cannot exceed the invoice balance.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION finance.recalculate_invoice_paid_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_invoice_id uuid;
BEGIN
  affected_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  UPDATE finance.invoices i
     SET paid_amount = COALESCE((
       SELECT sum(pa.allocated_amount)
         FROM finance.payment_allocations pa
         JOIN finance.payments p ON p.payment_id = pa.payment_id
        WHERE pa.invoice_id = affected_invoice_id
          AND p.payment_status_code IN ('CAPTURED', 'PARTIALLY_REFUNDED')
     ), 0)
   WHERE i.invoice_id = affected_invoice_id;

  IF TG_OP = 'UPDATE' AND OLD.invoice_id <> NEW.invoice_id THEN
    UPDATE finance.invoices i
       SET paid_amount = COALESCE((
         SELECT sum(pa.allocated_amount)
           FROM finance.payment_allocations pa
           JOIN finance.payments p ON p.payment_id = pa.payment_id
          WHERE pa.invoice_id = OLD.invoice_id
            AND p.payment_status_code IN ('CAPTURED', 'PARTIALLY_REFUNDED')
       ), 0)
     WHERE i.invoice_id = OLD.invoice_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION finance.validate_refund_request()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payment_total numeric(18,3);
  payment_status varchar(30);
  prior_refunds numeric(18,3);
BEGIN
  SELECT amount, payment_status_code
    INTO payment_total, payment_status
    FROM finance.payments
   WHERE payment_id = NEW.payment_id;

  IF payment_status NOT IN ('CAPTURED', 'PARTIALLY_REFUNDED') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Refunds require a captured payment.';
  END IF;

  SELECT COALESCE(sum(amount), 0)
    INTO prior_refunds
    FROM finance.refunds
   WHERE payment_id = NEW.payment_id
     AND status_code IN ('PROCESSING', 'COMPLETED');

  IF prior_refunds + NEW.requested_amount > payment_total THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Requested refund exceeds the remaining refundable amount.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION finance.validate_refund()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  requested_payment_id uuid;
  approved_amount numeric(18,3);
  payment_currency char(3);
BEGIN
  SELECT rr.payment_id, rr.requested_amount
    INTO requested_payment_id, approved_amount
    FROM finance.refund_requests rr
   WHERE rr.refund_request_id = NEW.refund_request_id;

  SELECT currency_code INTO payment_currency
    FROM finance.payments
   WHERE payment_id = NEW.payment_id;

  IF requested_payment_id <> NEW.payment_id THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Refund and refund request must reference the same payment.';
  END IF;

  IF NEW.amount > approved_amount THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Refund amount cannot exceed the approved request amount.';
  END IF;

  IF NEW.currency_code <> payment_currency THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Refund and payment currencies must match.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE INDEX idx_subscriptions_party_status
  ON finance.subscriptions(subscriber_party_id, status_code);
CREATE INDEX idx_subscriptions_renewal
  ON finance.subscriptions(renewal_date)
  WHERE auto_renew AND status_code IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD');
CREATE INDEX idx_invoices_party_status_due
  ON finance.invoices(bill_to_party_id, status_code, due_date);
CREATE INDEX idx_payments_payer_time
  ON finance.payments(payer_party_id, initiated_at DESC);
CREATE INDEX idx_refund_requests_queue
  ON finance.refund_requests(status_code, created_at);
CREATE INDEX idx_provider_settlements_beneficiary
  ON finance.provider_settlements(beneficiary_party_id, period_end DESC);

CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON finance.subscriptions
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_subscriptions_controlled_status
BEFORE UPDATE OF status_code ON finance.subscriptions
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON finance.invoices
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at_and_version();
CREATE TRIGGER trg_invoices_validate_issue
BEFORE UPDATE OF status_code ON finance.invoices
FOR EACH ROW EXECUTE FUNCTION finance.validate_invoice_before_issue();
CREATE TRIGGER trg_invoices_controlled_status
BEFORE UPDATE OF status_code ON finance.invoices
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change();
CREATE TRIGGER trg_payments_controlled_status
BEFORE UPDATE OF payment_status_code ON finance.payments
FOR EACH ROW EXECUTE FUNCTION core.reject_direct_status_change('payment_status_code');
CREATE TRIGGER trg_payment_allocations_validate
BEFORE INSERT OR UPDATE OF payment_id, invoice_id, allocated_amount
ON finance.payment_allocations
FOR EACH ROW EXECUTE FUNCTION finance.validate_payment_allocation();
CREATE TRIGGER trg_payment_allocations_recalculate_invoice
AFTER INSERT OR UPDATE OR DELETE ON finance.payment_allocations
FOR EACH ROW EXECUTE FUNCTION finance.recalculate_invoice_paid_amount();
CREATE TRIGGER trg_refund_requests_validate
BEFORE INSERT OR UPDATE OF payment_id, requested_amount
ON finance.refund_requests
FOR EACH ROW EXECUTE FUNCTION finance.validate_refund_request();
CREATE TRIGGER trg_refunds_validate
BEFORE INSERT OR UPDATE OF refund_request_id, payment_id, amount, currency_code
ON finance.refunds
FOR EACH ROW EXECUTE FUNCTION finance.validate_refund();

INSERT INTO integration.schema_migrations (migration_name)
VALUES ('0150_billing')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
