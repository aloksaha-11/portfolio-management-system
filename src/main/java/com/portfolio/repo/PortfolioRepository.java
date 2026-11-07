package com.portfolio.persistence;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

import com.portfolio.application.Portfolio;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class PortfolioRepository {
    private static final RowMapper<Portfolio> PORTFOLIO_MAPPER = (result, row) -> new Portfolio(
            result.getLong("portfolio_id"),
            result.getString("name"),
            result.getString("currency"),
            result.getTimestamp("created_at").toInstant(),
            result.getTimestamp("updated_at").toInstant());

    private final JdbcTemplate jdbc;

    public PortfolioRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long create(long userId, String name) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO portfolios (user_id, name, currency) VALUES (?, ?, 'INR')",
                    Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, userId);
            statement.setString(2, name);
            return statement;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("MySQL did not return a portfolio identifier");
        }
        return key.longValue();
    }

    public List<Portfolio> findAllByOwner(long userId) {
        return jdbc.query("""
                SELECT portfolio_id, name, currency, created_at, updated_at
                FROM portfolios WHERE user_id = ?
                ORDER BY created_at, portfolio_id
                """, PORTFOLIO_MAPPER, userId);
    }

    public Optional<Portfolio> findByIdAndOwner(long portfolioId, long userId) {
        List<Portfolio> results = jdbc.query("""
                SELECT portfolio_id, name, currency, created_at, updated_at
                FROM portfolios WHERE portfolio_id = ? AND user_id = ?
                """, PORTFOLIO_MAPPER, portfolioId, userId);
        return results.stream().findFirst();
    }

    public int deleteByIdAndOwner(long portfolioId, long userId) {
        return jdbc.update("DELETE FROM portfolios WHERE portfolio_id = ? AND user_id = ?", portfolioId, userId);
    }

    public boolean hasHoldings(long portfolioId) {
        Boolean exists = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM holdings WHERE portfolio_id = ?)", Boolean.class, portfolioId);
        return Boolean.TRUE.equals(exists);
    }
}
