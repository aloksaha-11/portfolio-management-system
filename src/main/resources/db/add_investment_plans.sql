-- Apply once to an existing portfolio_management_system database before deploying
-- the "Create your own plan" feature. Stores each plan a user creates: what they
-- already hold per asset class, the budget to invest, and the suggested split.
CREATE TABLE IF NOT EXISTS portfolio_management_system.investment_plans (
    plan_id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    risk_profile VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    current_shares DECIMAL(19,2) NOT NULL,
    current_bonds DECIMAL(19,2) NOT NULL,
    current_gold DECIMAL(19,2) NOT NULL,
    current_silver DECIMAL(19,2) NOT NULL,
    current_mutual_funds DECIMAL(19,2) NOT NULL,
    budget DECIMAL(19,2) NOT NULL,
    suggested_shares DECIMAL(19,2) NOT NULL,
    suggested_bonds DECIMAL(19,2) NOT NULL,
    suggested_gold DECIMAL(19,2) NOT NULL,
    suggested_silver DECIMAL(19,2) NOT NULL,
    suggested_mutual_funds DECIMAL(19,2) NOT NULL,
    market_signal VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reasons TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_investment_plans PRIMARY KEY (plan_id),
    CONSTRAINT fk_investment_plans_user
        FOREIGN KEY (user_id) REFERENCES portfolio_management_system.users (user_id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_investment_plans_risk CHECK (risk_profile IN ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE')),
    CONSTRAINT ck_investment_plans_signal CHECK (market_signal IN ('DOWNTREND', 'NORMAL', 'UNKNOWN')),
    CONSTRAINT ck_investment_plans_budget_positive CHECK (budget > 0),
    CONSTRAINT ck_investment_plans_amounts_nonnegative CHECK (
        current_shares >= 0 AND current_bonds >= 0 AND current_gold >= 0
        AND current_silver >= 0 AND current_mutual_funds >= 0
        AND suggested_shares >= 0 AND suggested_bonds >= 0 AND suggested_gold >= 0
        AND suggested_silver >= 0 AND suggested_mutual_funds >= 0),
    INDEX ix_investment_plans_user_created (user_id, created_at)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_bin;
