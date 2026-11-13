package com.portfolio.application;

import java.math.BigDecimal;
import java.time.Instant;

public record SoldHolding(
        long soldHoldingId,
        long originalHoldingId,
        long portfolioId,
        String investmentType,
        String investmentName,
        String ticker,
        BigDecimal unitsOwned,
        BigDecimal averagePurchasePrice,
        BigDecimal costBasis,
        Instant addedAt,
        Instant soldAt) {
}
