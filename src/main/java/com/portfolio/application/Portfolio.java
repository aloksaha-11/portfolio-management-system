package com.portfolio.application;

import java.time.Instant;

public record Portfolio(long portfolioId, String name, String currency, Instant createdAt, Instant updatedAt) {
}
