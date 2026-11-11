package com.portfolio.config;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@ComponentScan(basePackages = {"com.portfolio.application", "com.portfolio.persistence"})
@Import({DatabaseConfig.class, SecurityConfig.class})
@EnableScheduling
public class RootConfig {
}
