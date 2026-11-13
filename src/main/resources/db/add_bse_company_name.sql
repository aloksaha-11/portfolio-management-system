-- Apply once to an existing portfolio_management_system database.
ALTER TABLE portfolio_management_system.bse_daily_prices
    ADD COLUMN company_name VARCHAR(200)
        CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL
        AFTER bse_symbol;
