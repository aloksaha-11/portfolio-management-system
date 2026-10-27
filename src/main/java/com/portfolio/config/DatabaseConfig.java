package com.portfolio.config;

import javax.sql.DataSource;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.JdbcTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@Configuration
@EnableTransactionManagement
public class DatabaseConfig {

    @Bean(destroyMethod = "close")
    public HikariDataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setPoolName("portfolio-mysql");
        config.setDriverClassName("com.mysql.cj.jdbc.Driver");
        config.setJdbcUrl(requiredEnvironmentVariable("PORTFOLIO_DB_URL"));
        config.setUsername(requiredEnvironmentVariable("PORTFOLIO_DB_USERNAME"));
        config.setPassword(requiredEnvironmentVariable("PORTFOLIO_DB_PASSWORD"));
        config.setMaximumPoolSize(10);
        config.addDataSourceProperty("connectionTimeZone", "+05:30");
        config.addDataSourceProperty("forceConnectionTimeZoneToSession", "true");
        return new HikariDataSource(config);
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    public PlatformTransactionManager transactionManager(DataSource dataSource) {
        return new JdbcTransactionManager(dataSource);
    }

    private static String requiredEnvironmentVariable(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Required environment variable is not set: " + name);
        }
        return value;
    }
}
