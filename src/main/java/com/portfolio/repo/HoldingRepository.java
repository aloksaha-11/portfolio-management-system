package com.portfolio.persistence;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;

import com.portfolio.application.Holding;
import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class HoldingRepository {
    private static final RowMapper<Holding> HOLDING_MAPPER = (result, row) -> {
        BigDecimal units = result.getBigDecimal("units_owned");
        BigDecimal price = result.getBigDecimal("average_purchase_price");
        return new Holding(
                result.getLong("holding_id"),
                result.getLong("portfolio_id"),
                result.getString("investment_name"),
                result.getString("ticker"),
                units,
                price,
                units.multiply(price).setScale(2, RoundingMode.HALF_UP),
                result.getTimestamp("created_at").toInstant(),
                result.getTimestamp("updated_at").toInstant());
    };

    private final JdbcTemplate jdbc;

    public HoldingRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long create(long portfolioId, String name, String normalizedName, String ticker,
            BigDecimal units, BigDecimal averagePrice) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("""
                    INSERT INTO holdings
                        (portfolio_id, investment_name, normalized_investment_name, ticker,
                         units_owned, average_purchase_price)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, portfolioId);
            statement.setString(2, name);
            statement.setString(3, normalizedName);
            statement.setString(4, ticker);
            statement.setBigDecimal(5, units);
            statement.setBigDecimal(6, averagePrice);
            return statement;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("MySQL did not return a holding identifier");
        }
        return key.longValue();
    }

    public List<Holding> findAllByPortfolioAndOwner(long portfolioId, long userId) {
        return jdbc.query("""
                SELECT h.holding_id, h.portfolio_id, h.investment_name, h.ticker,
                       h.units_owned, h.average_purchase_price, h.created_at, h.updated_at
                FROM holdings h
                JOIN portfolios p ON p.portfolio_id = h.portfolio_id
                WHERE h.portfolio_id = ? AND p.user_id = ?
                ORDER BY h.holding_id
                """, HOLDING_MAPPER, portfolioId, userId);
    }

    public Optional<Holding> findByIdAndOwner(long holdingId, long userId) {
        List<Holding> results = jdbc.query("""
                SELECT h.holding_id, h.portfolio_id, h.investment_name, h.ticker,
                       h.units_owned, h.average_purchase_price, h.created_at, h.updated_at
                FROM holdings h
                JOIN portfolios p ON p.portfolio_id = h.portfolio_id
                WHERE h.holding_id = ? AND p.user_id = ?
                """, HOLDING_MAPPER, holdingId, userId);
        return results.stream().findFirst();
    }

    public int updateByIdAndOwner(long holdingId, long userId, String name, String normalizedName,
            String ticker, BigDecimal units, BigDecimal averagePrice) {
        return jdbc.update("""
                UPDATE holdings h
                JOIN portfolios p ON p.portfolio_id = h.portfolio_id
                SET h.investment_name = ?, h.normalized_investment_name = ?, h.ticker = ?,
                    h.units_owned = ?, h.average_purchase_price = ?
                WHERE h.holding_id = ? AND p.user_id = ?
                """, name, normalizedName, ticker, units, averagePrice, holdingId, userId);
    }

    public int deleteByIdAndOwner(long holdingId, long userId) {
        return jdbc.update("""
                DELETE h FROM holdings h
                JOIN portfolios p ON p.portfolio_id = h.portfolio_id
                WHERE h.holding_id = ? AND p.user_id = ?
                """, holdingId, userId);
    }
}
