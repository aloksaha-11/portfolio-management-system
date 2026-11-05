import com.portfolio.config;
/* Imports the standard Java interface for a source of database connections. */
import javax.sql.DataSource;
/* Imports HikariCP’s configuration class, used to set connection-pool options. */
import com.zaxxer.hikari.HikariConfig;
/* Imports HikariCP’s DataSource implementation, which manages a pool of database connections. */
import com.zaxxer.hikari.HikariDataSource;
/* Imports @Bean, which marks a method whose return value Spring should register as a bean. */
import org.springframework.context.annotation.Bean;
/* Imports @Configuration, which marks a class as a source of Spring bean definitions. */
import org.springframework.context.annotation.Configuration;
/* Imports Spring’s helper for running SQL and mapping query results using JDBC. */
import org.springframework.jdbc.core.JdbcTemplate;
/* Imports Spring’s transaction manager for JDBC connections. */
import org.springframework.jdbc.datasource.JdbcTransactionManager;
/* Imports the common Spring interface for transaction managers. */
import org.springframework.transaction.PlatformTransactionManager;
/* - Imports @EnableTransactionManagement, which enables Spring’s annotation-based transaction support, such as @Transactional, when applied to a configuration class. */
import org.springframework.transaction.annotation.EnableTransactionManagement;

@Configuration
@EnableTransactionManagement
public class DatabaseConfig {
/* @Bean(destroyMethod = "close") tells Spring to register the object returned by this method as a bean. When the Spring context shuts down, it calls that object’s close() method to release its resources. */
    @Bean(destroyMethod = "close")
/* public HikariDataSource dataSource() { declares a method that creates and returns a HikariCP database connection pool. */
    public HikariDataSource dataSource() {
/* HikariConfig config = new HikariConfig(); creates a configuration object for the pool. */
        HikariConfig config = new HikariConfig();
/* config.setPoolName("portfolio-mysql") gives the pool a name, which can help identify it in logs and monitoring. This line needs a semicolon at the end. */
        config.setPoolName("portfolio-mysql");
/* config.setDriverClassName("com.mysql.cj.jdbc.Driver"); specifies the MySQL JDBC driver class. */
        config.setDriverClassName("com.mysql.cj.jdbc.Driver");
/* config.setJdbcUrl(...) sets the database connection URL. Here it calls requiredEnvironmentVariable(...) to get the value of PORTFOLIO_TO_DB_URL */    
        config.setJdbcUrl(requiredEnvironmentVariable("PORTFOLIO_TO_DB_URL"));
/* config.setUserName(...) sets the database username from PORTFOLIO_TO_DB_USERNAME. */
        config.setUsername(requiredEnvironmentVariable("PORTFOLIO_TO_DB_USERNAME"));
/* config.setPassword(...) sets the password from PORTFOLIO_TO_DB_PASSWORD */
        config.setPassword(requiredEnvironmentVariable("PORTFOLIO_TO_DB_PASSWORD"));
/* config.setMaximumPoolSize(10); allows the pool to hold up to 10 connections. */
        config.setMaximumPoolSize(10);
/* config.addDataSourceProperty("connectionTimeZone", "+05:30"); passes a timezone setting to the MySQL driver for connections. */
        config.addDataSourceProperty("connectionTimeZone", "+05:30");
/* return new HikariDataSource(config); creates and returns the configured connection pool.  */
        return new HikariDataSource(config);
    }

/* @Bean tells Spring to register the object returned by this method in its application context. */
/* JdbcTransactionManager is the JDBC-specific implementation. */    
@Bean
/* public JdbcTemplate jdbcTemplate(DataSource dataSource) defines a bean-producing method. Spring supplies a DataSource bean as the method argument. */
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {
/* return new JdbcTemplate(dataSource); creates and returns a JdbcTemplate connected to that data source. Other Spring components can then use the JdbcTemplate bean to run SQL queries and updates without handling low-level JDBC connection management themselves. */
        return new JdbcTemplate(dataSource);
    }

    @Bean
/* public PlatformTransactionManager transactionManager(DataSource dataSource) defines the bean method. Spring supplies the application’s DataSource, which provides database connections. */
/* PlatformTransactionManager is the general Spring interface */ 
public PlatformTransactionManager transactionManager(DataSource dataSource) {
/* return new JdbcTransactionManager(dataSource); creates a transaction manager that coordinates transactions using that data source. Spring can use it for operations such as methods annotated with @Transactional, committing changes on success and rolling them back when a qualifying exception occurs. */
        return new JdbcTransactionManager(dataSource);
    }
/* This helper method reads an environment variable and fails early if it is missing or blank */
/* private static String requiredEnvironmentVariable(String name) declares a private helper that takes an environment variable’s name and returns its value as a String. static means it belongs to the class, so it can be called without creating a DatabaseConfig object. */
private static String requiredEnvironmentVariable (String name) {
/* String value = System.getenv(name); intends to read the variable named by name. */
        String value = System.getenv(name);
/* if (value == null || value.isBlank()) checks whether the variable is missing (null) or contains only whitespace. */
        if (value == null || value.isBlank()) {
/* throw new IllegalStateException(...) stops execution with a clear message if the required variable isn’t set. */
            throw new IllegalStateException("Required environment variable is not set: " + name);
        }
/* return value; returns the environment variable’s value when it is present. */        
        return value;
        }
    }