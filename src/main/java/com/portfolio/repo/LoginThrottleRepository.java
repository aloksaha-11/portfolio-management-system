package com.portfolio.persistence;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class LoginThrottleRepository {
    private final JdbcTemplate jdbc;

    public LoginThrottleRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public ThrottleState lockBucket(String type, byte[] keyHash) {
        jdbc.update("""
                INSERT INTO login_throttle (bucket_type, bucket_key_hash, failure_count, window_started_at)
                VALUES (?, ?, 0, CURRENT_TIMESTAMP(6))
                ON DUPLICATE KEY UPDATE throttle_id = throttle_id
                """, type, keyHash);
        List<ThrottleState> rows = jdbc.query("""
                SELECT failure_count,
                       window_started_at <= CURRENT_TIMESTAMP(6) - INTERVAL 15 MINUTE AS window_expired,
                       delay_until > CURRENT_TIMESTAMP(6) AS delay_active,
                       blocked_until > CURRENT_TIMESTAMP(6) AS block_active
                FROM login_throttle
                WHERE bucket_type = ? AND bucket_key_hash = ?
                FOR UPDATE
                """, (result, row) -> new ThrottleState(
                result.getInt("failure_count"),
                result.getBoolean("window_expired"),
                result.getBoolean("delay_active"),
                result.getBoolean("block_active")), type, keyHash);
        if (rows.isEmpty()) {
            throw new IllegalStateException("Login throttle bucket was not created");
        }
        return rows.getFirst();
    }

    public void recordFailure(String type, byte[] keyHash, ThrottleState previous) {
        boolean expired = previous.windowExpired();
        int nextCount = expired ? 1 : Math.addExact(previous.failureCount(), 1);
        int delaySeconds = "ACCOUNT".equals(type) && nextCount >= 5
                ? Math.min(30, 1 << Math.min(5, nextCount - 5))
                : 0;
        boolean block = "IP".equals(type) && nextCount >= 60;
        jdbc.update("""
                UPDATE login_throttle
                SET failure_count = ?,
                    window_started_at = IF(?, CURRENT_TIMESTAMP(6), window_started_at),
                    delay_until = IF(? > 0, CURRENT_TIMESTAMP(6) + INTERVAL ? SECOND, NULL),
                    blocked_until = IF(?, CURRENT_TIMESTAMP(6) + INTERVAL 15 MINUTE, NULL)
                WHERE bucket_type = ? AND bucket_key_hash = ?
                """, nextCount, expired, delaySeconds, delaySeconds, block, type, keyHash);
    }

    public void resetAccount(String type, byte[] keyHash) {
        jdbc.update("""
                UPDATE login_throttle
                SET failure_count = 0, window_started_at = CURRENT_TIMESTAMP(6), delay_until = NULL
                WHERE bucket_type = ? AND bucket_key_hash = ?
                """, type, keyHash);
    }

    public record ThrottleState(int failureCount, boolean windowExpired, boolean delayActive, boolean blockActive) {
    }
}
