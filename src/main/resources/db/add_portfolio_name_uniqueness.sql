-- Enforce one portfolio name per user (case and accent insensitive, surrounding
-- spaces ignored). Before applying, check for existing duplicates and rename
-- them so the unique index can be created:
--
-- SELECT user_id, LOWER(TRIM(name)) AS normalized_name, COUNT(*) AS name_count
-- FROM portfolio_management_system.portfolios
-- GROUP BY user_id, LOWER(TRIM(name))
-- HAVING COUNT(*) > 1;

ALTER TABLE portfolio_management_system.portfolios
    ADD COLUMN normalized_name VARCHAR(100)
        CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
        GENERATED ALWAYS AS (LOWER(TRIM(name))) STORED,
    ADD CONSTRAINT uq_portfolios_user_name UNIQUE (user_id, normalized_name);
