package com.portfolio.application;

import java.time.Instant;
import java.util.List;

public record PortfolioDetails(
        long portfolioId,
        String name,
        String currency,
        Instant createdAt,
        Instant updatedAt,
        List<Holding> holdings) {
    public PortfolioDetails {
        holdings = List.copyOf(holdings);
    }

    public static PortfolioDetails from(Portfolio portfolio, List<Holding> holdings) {
        return new PortfolioDetails(
                portfolio.portfolioId(), portfolio.name(), portfolio.currency(),
                portfolio.createdAt(), portfolio.updatedAt(), holdings);
    }
}
