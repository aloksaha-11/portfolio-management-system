/* RootConfig.java is a Spring configuration class that assembles parts of your application’s configuration.
- @Configuration tells Spring that this class provides configuration.
- @ComponentScan(basePackages = {"com.portfolio.application", "com.portfolio.persistence"}) tells Spring to search those packages for annotated components, such as @Service and @Repository, and register them as beans.
- @Import({DatabaseConfig.class, SecurityConfig.class}) tells Spring to load the configuration in DatabaseConfig and SecurityConfig too.
- The empty RootConfig class acts as the central place where those configurations are brought together. */

package com.portfolio.config;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@ComponentScan(basePackages = {"com.portfolio.application", "com.portfolio.persistence"})
@Import({DatabaseConfig.class, SecurityConfig.class})

public class RootConfig {
    
}
