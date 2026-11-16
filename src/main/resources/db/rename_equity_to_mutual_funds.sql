-- Renames the 'Equity' investment type to 'Mutual Funds'.
-- Apply once to an existing portfolio_management_system database, after
-- add_holding_investment_type.sql and add_sold_holdings.sql, before deploying
-- the build that uses 'Mutual Funds'. Requires MySQL 8.0.19+ (DROP CHECK).
-- Note: MySQL commits each ALTER TABLE immediately, so run the whole script
-- in one go.

ALTER TABLE portfolio_management_system.holdings
    DROP CHECK ck_holdings_investment_type;

UPDATE portfolio_management_system.holdings
SET investment_type = 'Mutual Funds'
WHERE investment_type = 'Equity';

UPDATE portfolio_management_system.sold_holdings
SET investment_type = 'Mutual Funds'
WHERE investment_type = 'Equity';

ALTER TABLE portfolio_management_system.holdings
    ALTER COLUMN investment_type DROP DEFAULT,
    ADD CONSTRAINT ck_holdings_investment_type CHECK (investment_type IN (
        'Bonds', 'Commodities-Gold', 'Commodities-Silver', 'Mutual Funds', 'Stocks/Shares'
    ));
