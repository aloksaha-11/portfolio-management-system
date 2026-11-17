package com.portfolio.persistence;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.Instant;
import java.util.List;

import com.portfolio.application.AssetAmounts;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class InvestmentPlanRepository {

    /** A stored plan exactly as saved. Reasons are kept one per line. */
    public record StoredPlan(
            long planId,
            String riskProfile,
            AssetAmounts current,
            BigDecimal budget,
            AssetAmounts suggested,
            String marketSignal,
            List<String> reasons,
            Instant createdAt) {
    }

    private static final RowMapper<StoredPlan> PLAN_MAPPER = (result, row) -> new StoredPlan(
            result.getLong("plan_id"),
            result.getString("risk_profile"),
            new AssetAmounts(
                    result.getBigDecimal("current_shares"),
                    result.getBigDecimal("current_bonds"),
                    result.getBigDecimal("current_gold"),
                    result.getBigDecimal("current_silver"),
                    result.getBigDecimal("current_mutual_funds")),
            result.getBigDecimal("budget"),
            new AssetAmounts(
                    result.getBigDecimal("suggested_shares"),
                    result.getBigDecimal("suggested_bonds"),
                    result.getBigDecimal("suggested_gold"),
                    result.getBigDecimal("suggested_silver"),
                    result.getBigDecimal("suggested_mutual_funds")),
            result.getString("market_signal"),
            List.of(result.getString("reasons").split("\n")),
            result.getTimestamp("created_at").toInstant());

    private final JdbcTemplate jdbc;

    public InvestmentPlanRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long create(long userId, String riskProfile, AssetAmounts current, BigDecimal budget,
                       AssetAmounts suggested, String marketSignal, List<String> reasons) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("""
                    INSERT INTO investment_plans (
                        user_id, risk_profile,
                        current_shares, current_bonds, current_gold, current_silver, current_mutual_funds,
                        budget,
                        suggested_shares, suggested_bonds, suggested_gold, suggested_silver, suggested_mutual_funds,
                        market_signal, reasons
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            int index = 1;
            statement.setLong(index++, userId);
            statement.setString(index++, riskProfile);
            for (BigDecimal value : current.toArray()) {
                statement.setBigDecimal(index++, value);
            }
            statement.setBigDecimal(index++, budget);
            for (BigDecimal value : suggested.toArray()) {
                statement.setBigDecimal(index++, value);
            }
            statement.setString(index++, marketSignal);
            statement.setString(index, String.join("\n", reasons));
            return statement;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("MySQL did not return a plan identifier");
        }
        return key.longValue();
    }

    public StoredPlan findByIdAndUser(long planId, long userId) {
        return jdbc.queryForObject(
                "SELECT * FROM investment_plans WHERE plan_id = ? AND user_id = ?",
                PLAN_MAPPER, planId, userId);
    }

    public List<StoredPlan> findRecentByUser(long userId, int limit) {
        return jdbc.query("""
                SELECT * FROM investment_plans
                WHERE user_id = ?
                ORDER BY created_at DESC, plan_id DESC
                LIMIT ?
                """, PLAN_MAPPER, userId, limit);
    }
}
