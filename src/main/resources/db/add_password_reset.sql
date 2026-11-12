-- Apply once to an existing portfolio_management_system database before deploying
-- the password reset feature.
ALTER TABLE portfolio_management_system.users
    ADD COLUMN session_version BIGINT NOT NULL DEFAULT 0;

CREATE TABLE portfolio_management_system.password_reset_tokens (
    user_id BIGINT NOT NULL,
    token_hash BINARY(32) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_password_reset_tokens PRIMARY KEY (user_id),
    CONSTRAINT uq_password_reset_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_password_reset_tokens_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    INDEX ix_password_reset_tokens_expiry (expires_at)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_bin;
