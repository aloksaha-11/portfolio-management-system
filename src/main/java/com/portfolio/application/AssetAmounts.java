package com.portfolio.application;

import java.math.BigDecimal;
import java.util.List;

/**
 * One value per asset class used by "Create your own plan". Holds rupee amounts or
 * percentages, depending on context. Order everywhere: shares, bonds, gold, silver,
 * mutual funds.
 */
public record AssetAmounts(
        BigDecimal shares,
        BigDecimal bonds,
        BigDecimal gold,
        BigDecimal silver,
        BigDecimal mutualFunds) {

    public static final List<String> LABELS = List.of(
            "Shares", "Bonds", "Commodities-Gold", "Commodities-Silver", "Mutual Funds");

    public static AssetAmounts of(BigDecimal[] values) {
        return new AssetAmounts(values[0], values[1], values[2], values[3], values[4]);
    }

    public BigDecimal[] toArray() {
        return new BigDecimal[] {shares, bonds, gold, silver, mutualFunds};
    }
}
