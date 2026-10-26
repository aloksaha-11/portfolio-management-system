package com.portfolio.common;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ApiInfoController {

    @GetMapping
    public Map<String, String> apiInfo() {
        return Map.of(
                "name", "Portfolio Management API",
                "status", "ready",
                "health", "/api/health"
        );
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
