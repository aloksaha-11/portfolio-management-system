package com.portfolio.persistence;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;

import com.portfolio.application.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {
    private static final RowMapper<UserAccount> USER_MAPPER = (result, row) -> new UserAccount(
            result.getLong("user_id"), result.getString("email"), result.getString("password_hash"),
            result.getLong("session_version"));

    private final JdbcTemplate jdbc;

    public UserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<UserAccount> findByEmail(String email) {
        List<UserAccount> users = jdbc.query(
                "SELECT user_id, email, password_hash, session_version FROM users WHERE email = ?",
                USER_MAPPER,
                email);
        return users.stream().findFirst();
    }

    public long sessionVersion(long userId) {
        List<Long> versions = jdbc.query("SELECT session_version FROM users WHERE user_id = ?",
                (result, row) -> result.getLong("session_version"), userId);
        return versions.isEmpty() ? -1 : versions.getFirst();
    }

    public int updatePasswordHashAndRevokeSessions(long userId, String passwordHash) {
        return jdbc.update("UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE user_id = ?",
                passwordHash, userId);
    }

    public long create(String email, String passwordHash) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            statement.setString(1, email);
            statement.setString(2, passwordHash);
            return statement;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("MySQL did not return a user identifier");
        }
        return key.longValue();
    }
}
