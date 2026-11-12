-- This migration rejects identical holdings belonging to the same user,
-- even when they are in different portfolios. A duplicate means equal
-- normalized investment name, ticker (case-insensitive; NULL equals blank),
-- units, and average purchase price.
--
-- Find duplicates first. Resolve any returned groups before running the ALTER:
-- SELECT p.user_id, h.normalized_investment_name,
--        LOWER(COALESCE(h.ticker, '')) COLLATE utf8mb4_0900_ai_ci AS normalized_ticker,
--        h.units_owned, h.average_purchase_price, COUNT(*) AS holding_count
-- FROM portfolio_management_system.holdings h
-- JOIN portfolio_management_system.portfolios p ON p.portfolio_id = h.portfolio_id
-- GROUP BY p.user_id, h.normalized_investment_name,
--          LOWER(COALESCE(h.ticker, '')) COLLATE utf8mb4_0900_ai_ci,
--          h.units_owned, h.average_purchase_price
-- HAVING COUNT(*) > 1;

ALTER TABLE portfolio_management_system.portfolios
    ADD CONSTRAINT uq_portfolios_id_user UNIQUE (portfolio_id, user_id);

ALTER TABLE portfolio_management_system.holdings
    ADD COLUMN owner_user_id BIGINT NULL AFTER holding_id;

UPDATE portfolio_management_system.holdings h
JOIN portfolio_management_system.portfolios p ON p.portfolio_id = h.portfolio_id
SET h.owner_user_id = p.user_id
WHERE h.holding_id > 0;

ALTER TABLE portfolio_management_system.holdings
    MODIFY COLUMN owner_user_id BIGINT NOT NULL,
    ADD COLUMN normalized_ticker VARCHAR(32)
        CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
        GENERATED ALWAYS AS (LOWER(COALESCE(ticker, ''))) STORED,
    ADD CONSTRAINT uq_holdings_owner_details
        UNIQUE (owner_user_id, normalized_investment_name, normalized_ticker,
                units_owned, average_purchase_price),
    ADD CONSTRAINT fk_holdings_owner_portfolio
        FOREIGN KEY (portfolio_id, owner_user_id)
        REFERENCES portfolio_management_system.portfolios (portfolio_id, user_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT;
