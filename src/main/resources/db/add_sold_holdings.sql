-- Apply once to an existing portfolio_management_system database.
CREATE TABLE portfolio_management_system.sold_holdings (
    sold_holding_id BIGINT NOT NULL AUTO_INCREMENT,
    original_holding_id BIGINT NOT NULL,
    owner_user_id BIGINT NOT NULL,
    portfolio_id BIGINT NOT NULL,
    investment_type VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    investment_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    ticker VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    units_owned DECIMAL(24,8) NOT NULL,
    average_purchase_price DECIMAL(19,4) NOT NULL,
    added_at TIMESTAMP(6) NOT NULL,
    sold_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_sold_holdings PRIMARY KEY (sold_holding_id),
    CONSTRAINT uq_sold_holdings_original UNIQUE (original_holding_id),
    CONSTRAINT fk_sold_holdings_portfolio_owner
        FOREIGN KEY (portfolio_id, owner_user_id) REFERENCES portfolio_management_system.portfolios (portfolio_id, user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    INDEX ix_sold_holdings_owner_portfolio_date (owner_user_id, portfolio_id, sold_at)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_bin;
