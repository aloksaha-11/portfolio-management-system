-- Portfolio Management System MVP schema
-- Target: MySQL 8.4 LTS, InnoDB. Apply manually to the selected database.
-- Use IST (+05:30) for this schema-creation session and its TIMESTAMP defaults.
SET time_zone = '+05:30';

commit;

SET PERSIST time_zone = '+05:30';

SET GLOBAL time_zone = '+05:30';

CREATE TABLE portfolio_management_system.users (
    user_id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_users PRIMARY KEY (user_id),
    CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_bin;

CREATE TABLE portfolio_management_system.portfolios (
    portfolio_id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'INR',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_portfolios PRIMARY KEY (portfolio_id),
    CONSTRAINT fk_portfolios_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_portfolios_name_nonblank CHECK (CHAR_LENGTH(TRIM(name)) > 0),
    CONSTRAINT ck_portfolios_currency_inr CHECK (currency = 'INR'),
    INDEX ix_portfolios_user_created (user_id, created_at)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_bin;

CREATE TABLE portfolio_management_system.holdings (
    holding_id BIGINT NOT NULL AUTO_INCREMENT,
    portfolio_id BIGINT NOT NULL,
    investment_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    normalized_investment_name VARCHAR(512)
        CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    ticker VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
    units_owned DECIMAL(24,8) NOT NULL,
    average_purchase_price DECIMAL(19,4) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_holdings PRIMARY KEY (holding_id),
    CONSTRAINT uq_holdings_portfolio_normalized_name
        UNIQUE (portfolio_id, normalized_investment_name),
    CONSTRAINT fk_holdings_portfolio
        FOREIGN KEY (portfolio_id) REFERENCES portfolios (portfolio_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_holdings_units_positive CHECK (units_owned > 0),
    CONSTRAINT ck_holdings_purchase_price_nonnegative CHECK (average_purchase_price >= 0)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_bin;

CREATE TABLE portfolio_management_system.login_throttle (
    throttle_id BIGINT NOT NULL AUTO_INCREMENT,
    bucket_type ENUM('ACCOUNT', 'IP') NOT NULL,
    bucket_key_hash BINARY(32) NOT NULL,
    failure_count INT UNSIGNED NOT NULL DEFAULT 0,
    window_started_at TIMESTAMP(6) NOT NULL,
    delay_until TIMESTAMP(6) NULL,
    blocked_until TIMESTAMP(6) NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_login_throttle PRIMARY KEY (throttle_id),
    CONSTRAINT uq_login_throttle_bucket UNIQUE (bucket_type, bucket_key_hash),
    INDEX ix_login_throttle_cleanup (bucket_type, updated_at)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_bin;
