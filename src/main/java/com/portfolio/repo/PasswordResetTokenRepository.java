package com.portfolio.persistence;

import java.util.List;
import java.util.OptionalLong;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PasswordResetTokenRepository {
    private final JdbcTemplate jdbc;

    public PasswordResetTokenRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void replaceForUser(long userId, byte[] tokenHash) {
        jdbc.update("DELETE FROM password_reset_tokens WHERE user_id = ?", userId);
        jdbc.update("""
                INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                VALUES (?, ?, CURRENT_TIMESTAMP(6) + INTERVAL 30 MINUTE)
                """, userId, tokenHash);
    }

    public OptionalLong findUserIdForValidToken(byte[] tokenHash) {
        List<Long> userIds = jdbc.query("""
                SELECT user_id FROM password_reset_tokens
                WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP(6)
                FOR UPDATE
                """, (result, row) -> result.getLong("user_id"), tokenHash);
        return userIds.isEmpty() ? OptionalLong.empty() : OptionalLong.of(userIds.getFirst());
    }

    public int deleteByTokenHash(byte[] tokenHash) {
        return jdbc.update("DELETE FROM password_reset_tokens WHERE token_hash = ?", tokenHash);
    }
}
