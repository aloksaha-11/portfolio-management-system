-- Apply once to an existing portfolio_management_system database before deploying
-- the BSE end-of-day market-data feature.
CREATE TABLE IF NOT EXISTS portfolio_management_system.bse_daily_prices (
    trade_date DATE NOT NULL,
    security_code VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    isin CHAR(12) CHARACTER SET ascii COLLATE ascii_bin NULL,
    bse_symbol VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    company_name VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
    series VARCHAR(4) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    open_price DECIMAL(19,6) NULL,
    high_price DECIMAL(19,6) NULL,
    low_price DECIMAL(19,6) NULL,
    close_price DECIMAL(19,6) NOT NULL,
    previous_close DECIMAL(19,6) NULL,
    volume BIGINT NULL,
    imported_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_bse_daily_prices PRIMARY KEY (trade_date, security_code, series),
    CONSTRAINT ck_bse_daily_prices_close_positive CHECK (close_price > 0),
    INDEX ix_bse_daily_prices_code_date (security_code, trade_date),
    INDEX ix_bse_daily_prices_symbol_date (bse_symbol, trade_date)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_bin;
