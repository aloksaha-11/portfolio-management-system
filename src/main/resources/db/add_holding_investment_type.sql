-- Adds the holding category. Existing rows are initially classified as Equity;
-- update their investment_type values afterward if another category fits.
-- This migration assumes add_holding_owner_duplicate_constraint.sql has been
-- fully applied, including uq_holdings_owner_details.

ALTER TABLE portfolio_management_system.holdings
    ADD COLUMN investment_type VARCHAR(32)
        CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin
        NOT NULL DEFAULT 'Equity' AFTER portfolio_id;

ALTER TABLE portfolio_management_system.holdings
    DROP INDEX uq_holdings_owner_details,
    ADD CONSTRAINT ck_holdings_investment_type CHECK (investment_type IN (
        'Bonds', 'Commodities-Gold', 'Commodities-Silver', 'Equity', 'Intraday', 'Stocks/Shares'
    )),
    ADD CONSTRAINT uq_holdings_owner_details
        UNIQUE (owner_user_id, investment_type, normalized_investment_name, normalized_ticker,
                units_owned, average_purchase_price);
