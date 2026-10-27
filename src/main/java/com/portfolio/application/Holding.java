package com.portfolio.application;

import java.math.BigDecimal;
import java.time.Instant;

public record Holding(
        long holdingId,
        long portfolioId,
        String investmentName,
        String ticker,
        BigDecimal unitsOwned,
        BigDecimal averagePurchasePrice,
        BigDecimal costBasis,
        Instant createdAt,
        Instant updatedAt) {
}
