BEGIN;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM finance.platform_cost_observations) THEN RAISE EXCEPTION 'Package W rollback refused: cost observations already exist'; END IF; END $$;
DROP FUNCTION IF EXISTS finance.evaluate_platform_cost_optimization_gate(uuid);
DROP VIEW IF EXISTS finance.v_platform_finops_budget_status;
DROP TABLE finance.platform_unit_economics;
DROP TABLE finance.platform_cost_observations;
DROP TABLE finance.platform_cost_budgets;
DROP TABLE finance.platform_cost_centers;
COMMIT;
