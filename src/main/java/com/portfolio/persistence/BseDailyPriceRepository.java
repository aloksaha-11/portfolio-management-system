package com.portfolio.persistence;

import java.sql.Date;
import java.util.List;

import com.portfolio.application.BseDailyPrice;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class BseDailyPriceRepository {
    private static final String INSERT_SQL = """
            INSERT INTO bse_daily_prices (
                trade_date, security_code, isin, bse_symbol, company_name, series,
                open_price, high_price, low_price, close_price, previous_close, volume
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            AS incoming
            ON DUPLICATE KEY UPDATE
                isin = incoming.isin,
                bse_symbol = incoming.bse_symbol,
                company_name = COALESCE(incoming.company_name, bse_daily_prices.company_name),
                open_price = incoming.open_price,
                high_price = incoming.high_price,
                low_price = incoming.low_price,
                close_price = incoming.close_price,
                previous_close = incoming.previous_close,
                volume = incoming.volume,
                imported_at = CURRENT_TIMESTAMP(6)
            """;

    private static final String LATEST_FOR_KEYS_SQL = """
            WITH matched_prices AS (
                SELECT p.*,
                       ROW_NUMBER() OVER (
                           PARTITION BY p.security_code, p.series
                           ORDER BY p.trade_date DESC
                       ) AS price_rank
                FROM bse_daily_prices p
                WHERE (p.bse_symbol IN (%s) OR p.security_code IN (%s))
                  AND p.trade_date = (SELECT MAX(trade_date) FROM bse_daily_prices)
            )
            SELECT security_code, isin, bse_symbol, company_name, series, trade_date,
                   open_price, high_price, low_price, close_price, previous_close, volume
            FROM matched_prices
            WHERE price_rank = 1
            ORDER BY (series = 'EQ') DESC, bse_symbol ASC
            """;

    private static final String FOR_TRADE_DATE_SQL = """
            SELECT security_code, isin, bse_symbol, company_name, series, trade_date,
                   open_price, high_price, low_price, close_price, previous_close, volume
            FROM bse_daily_prices
            WHERE trade_date = ?
            ORDER BY (series = 'EQ') DESC, bse_symbol ASC, security_code ASC
            """;

    private final JdbcTemplate jdbc;

    public BseDailyPriceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public int upsertAll(List<BseDailyPrice> prices) {
        if (prices.isEmpty()) {
            return 0;
        }
        int[][] results = jdbc.batchUpdate(INSERT_SQL, prices, 500, (statement, price) -> {
            statement.setDate(1, Date.valueOf(price.tradeDate()));
            statement.setString(2, price.securityCode());
            statement.setString(3, price.isin());
            statement.setString(4, price.symbol());
            statement.setString(5, price.companyName());
            statement.setString(6, price.series());
            statement.setBigDecimal(7, price.openPrice());
            statement.setBigDecimal(8, price.highPrice());
            statement.setBigDecimal(9, price.lowPrice());
            statement.setBigDecimal(10, price.closePrice());
            statement.setBigDecimal(11, price.previousClose());
            if (price.volume() == null) {
                statement.setNull(12, java.sql.Types.BIGINT);
            } else {
                statement.setLong(12, price.volume());
            }
        });
        int changed = 0;
        for (int[] batch : results) {
            for (int count : batch) {
                if (count > 0 || count == java.sql.Statement.SUCCESS_NO_INFO) {
                    changed++;
                }
            }
        }
        return changed;
    }

    public List<BseDailyPrice> findLatestByKeys(List<String> keys) {
        if (keys.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(", ", java.util.Collections.nCopies(keys.size(), "?"));
        String sql = LATEST_FOR_KEYS_SQL.formatted(placeholders, placeholders);
        Object[] params = new Object[keys.size() * 2];
        for (int i = 0; i < keys.size(); i++) {
            params[i] = keys.get(i);
            params[i + keys.size()] = keys.get(i);
        }
        return jdbc.query(sql, (result, row) -> new BseDailyPrice(
                result.getString("security_code"),
                result.getString("isin"),
                result.getString("bse_symbol"),
                result.getString("company_name"),
                result.getString("series"),
                result.getDate("trade_date").toLocalDate(),
                result.getBigDecimal("open_price"),
                result.getBigDecimal("high_price"),
                result.getBigDecimal("low_price"),
                result.getBigDecimal("close_price"),
                result.getBigDecimal("previous_close"),
                (Long) result.getObject("volume")), params);
    }

    public List<BseDailyPrice> findByTradeDate(java.time.LocalDate tradeDate) {
        return jdbc.query(FOR_TRADE_DATE_SQL, (result, row) -> new BseDailyPrice(
                result.getString("security_code"),
                result.getString("isin"),
                result.getString("bse_symbol"),
                result.getString("company_name"),
                result.getString("series"),
                result.getDate("trade_date").toLocalDate(),
                result.getBigDecimal("open_price"),
                result.getBigDecimal("high_price"),
                result.getBigDecimal("low_price"),
                result.getBigDecimal("close_price"),
                result.getBigDecimal("previous_close"),
                (Long) result.getObject("volume")), Date.valueOf(tradeDate));
    }

    public List<String> findAllSymbols() {
        return jdbc.queryForList("""
                SELECT DISTINCT bse_symbol
                FROM bse_daily_prices
                WHERE bse_symbol IS NOT NULL AND TRIM(bse_symbol) <> ''
                ORDER BY bse_symbol
                """, String.class);
    }

    public List<java.time.LocalDate> findTradeDatesMissingCompanyNames(java.time.LocalDate fromDate) {
        return jdbc.query("""
                SELECT DISTINCT trade_date
                FROM bse_daily_prices
                WHERE trade_date >= ? AND company_name IS NULL
                ORDER BY trade_date
                """, (result, row) -> result.getDate(1).toLocalDate(), Date.valueOf(fromDate));
    }

    public java.time.LocalDate latestTradeDate() {
        return jdbc.queryForObject("SELECT MAX(trade_date) FROM bse_daily_prices", (result, row) -> {
            Date date = result.getDate(1);
            return date == null ? null : date.toLocalDate();
        });
    }

    public List<java.time.LocalDate> findDistinctTradeDates() {
        return jdbc.query("""
                SELECT DISTINCT trade_date
                FROM bse_daily_prices
                ORDER BY trade_date DESC
                """, (result, row) -> result.getDate(1).toLocalDate());
    }
}
