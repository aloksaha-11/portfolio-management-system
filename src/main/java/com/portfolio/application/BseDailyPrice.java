package com.portfolio.application;

import java.math.BigDecimal;
import java.time.LocalDate;

public record BseDailyPrice(
        String securityCode,
        String isin,
        String symbol,
        String series,
        LocalDate tradeDate,
        BigDecimal openPrice,
        BigDecimal highPrice,
        BigDecimal lowPrice,
        BigDecimal closePrice,
        BigDecimal previousClose,
        Long volume) {
}
