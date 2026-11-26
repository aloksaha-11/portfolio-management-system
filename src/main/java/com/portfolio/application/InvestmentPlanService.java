package com.portfolio.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.ibm.icu.text.NumberFormat;
import com.ibm.icu.util.ULocale;
import com.portfolio.persistence.BseDailyPriceRepository;
import com.portfolio.persistence.BseDailyPriceRepository.DailyChange;
import com.portfolio.persistence.InvestmentPlanRepository;
import com.portfolio.persistence.InvestmentPlanRepository.StoredPlan;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Create your own plan": suggests how to split a new investment budget across
 * Shares, Bonds, Commodities-Gold, Commodities-Silver and Mutual Funds.
 *
 * <p>This is a transparent rule-based engine, not AI:
 * <ol>
 *   <li>The user's risk appetite selects a target mix (TARGETS below).</li>
 *   <li>If the BSE Sensex fell on each of the last 3 trading days, 5 points move from
 *       Shares to Bonds (+3) and Commodities-Gold (+2) as a defensive tilt.</li>
 *   <li>The budget is spent where the user is furthest below the target mix, in
 *       proportion to each shortfall. Nothing is sold: classes already above target
 *       get nothing.</li>
 * </ol>
 * Each result also carries the assumed yearly return per class (ASSUMED_RETURN_PERCENT), which
 * the plan page uses to show an illustrative estimate of the value after N years.
 */
@Service
public class InvestmentPlanService {
    public static final List<String> RISK_PROFILES = List.of("CONSERVATIVE", "MODERATE", "AGGRESSIVE");

    /** Target mix in percent, order: shares, bonds, gold, silver, mutual funds. */
    private static final Map<String, int[]> TARGETS = Map.of(
            "CONSERVATIVE", new int[] {10, 45, 15, 5, 25},
            "MODERATE", new int[] {30, 20, 15, 5, 30},
            "AGGRESSIVE", new int[] {45, 10, 10, 5, 30});

    /**
     * Assumed average yearly return in percent, order: shares, bonds, gold, silver, mutual funds.
     * Rough long-run figures for India, used only for the illustrative "estimated value after N
     * years" projection on the plan page. They are assumptions, not predictions, and play no
     * part in how the budget is split.
     */
    private static final AssetAmounts ASSUMED_RETURN_PERCENT = new AssetAmounts(
            new BigDecimal("12"), new BigDecimal("7"), new BigDecimal("8"), new BigDecimal("8"), new BigDecimal("10"));

    /** Sensex-tracking ETFs in the BSE Bhav Copy, most liquid first (same list as the Dashboard badge). */
    private static final List<String> SENSEX_TRACKERS = List.of("SENSEXBEES", "SBISENSEX", "HDFCSENSEX", "SENSEXBETA");
    private static final int TREND_DAYS = 3;
    private static final int RECENT_PLAN_LIMIT = 10;
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("1000000000000"); // ₹1 lakh crore
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final InvestmentPlanRepository plans;
    private final BseDailyPriceRepository prices;

    public InvestmentPlanService(InvestmentPlanRepository plans, BseDailyPriceRepository prices) {
        this.plans = plans;
        this.prices = prices;
    }

    public record PlanInput(String riskProfile, AssetAmounts current, BigDecimal budget) {
    }

    public record PlanResult(
            long planId,
            String riskProfile,
            BigDecimal budget,
            AssetAmounts current,
            AssetAmounts suggested,
            AssetAmounts targetPercent,
            AssetAmounts currentPercent,
            AssetAmounts resultingPercent,
            AssetAmounts assumedReturnPercent,
            String marketSignal,
            List<String> reasons,
            Instant createdAt) {
    }

    @Transactional
    public PlanResult create(long userId, PlanInput input) {
        if (input == null) {
            throw invalid("Enter your current investments and your budget.");
        }
        String risk = input.riskProfile() == null ? "MODERATE" : input.riskProfile().strip().toUpperCase(Locale.ROOT);
        if (!RISK_PROFILES.contains(risk)) {
            throw invalid("Choose a risk appetite: Conservative, Moderate or Aggressive.");
        }
        BigDecimal[] current = new BigDecimal[5];
        BigDecimal[] given = input.current() == null ? new BigDecimal[5] : input.current().toArray();
        for (int i = 0; i < 5; i++) {
            current[i] = validAmount(given[i] == null ? BigDecimal.ZERO : given[i],
                    AssetAmounts.LABELS.get(i) + " amount");
        }
        BigDecimal budget = validAmount(input.budget(), "Budget");
        if (budget.signum() <= 0) {
            throw invalid("Enter a budget greater than ₹0.");
        }

        String signal = marketSignal();
        int[] target = targetFor(risk, signal);
        BigDecimal[] suggested = allocate(current, budget, target);
        List<String> reasons = explain(risk, signal, current, budget, target, suggested);

        long planId = plans.create(userId, risk, AssetAmounts.of(current), budget,
                AssetAmounts.of(suggested), signal, reasons);
        return toResult(plans.findByIdAndUser(planId, userId));
    }

    @Transactional(readOnly = true)
    public List<PlanResult> recent(long userId) {
        return plans.findRecentByUser(userId, RECENT_PLAN_LIMIT).stream().map(this::toResult).toList();
    }

    private PlanResult toResult(StoredPlan plan) {
        BigDecimal[] current = plan.current().toArray();
        BigDecimal[] suggested = plan.suggested().toArray();
        BigDecimal[] after = new BigDecimal[5];
        for (int i = 0; i < 5; i++) {
            after[i] = current[i].add(suggested[i]);
        }
        int[] target = targetFor(plan.riskProfile(), plan.marketSignal());
        BigDecimal[] targetPct = new BigDecimal[5];
        for (int i = 0; i < 5; i++) {
            targetPct[i] = BigDecimal.valueOf(target[i]);
        }
        return new PlanResult(plan.planId(), plan.riskProfile(), plan.budget(), plan.current(), plan.suggested(),
                AssetAmounts.of(targetPct), AssetAmounts.of(percentages(current)),
                AssetAmounts.of(percentages(after)), ASSUMED_RETURN_PERCENT,
                plan.marketSignal(), plan.reasons(), plan.createdAt());
    }

    /** DOWNTREND if a Sensex ETF fell on each of the last 3 trading days; UNKNOWN without enough data. */
    private String marketSignal() {
        for (String symbol : SENSEX_TRACKERS) {
            List<DailyChange> changes = prices.findRecentChanges(symbol, TREND_DAYS);
            if (changes.size() == TREND_DAYS) {
                boolean fellEveryDay = changes.stream()
                        .allMatch(change -> change.closePrice().compareTo(change.previousClose()) < 0);
                return fellEveryDay ? "DOWNTREND" : "NORMAL";
            }
        }
        return "UNKNOWN";
    }

    private static int[] targetFor(String risk, String signal) {
        int[] target = TARGETS.get(risk).clone();
        if ("DOWNTREND".equals(signal)) {
            int moved = Math.min(5, target[0]);
            target[0] -= moved;
            target[1] += moved - 2;
            target[2] += 2;
        }
        return target;
    }

    /** Splits the budget in proportion to how far each class is below its target share. */
    private static BigDecimal[] allocate(BigDecimal[] current, BigDecimal budget, int[] target) {
        BigDecimal totalAfter = sum(current).add(budget);
        BigDecimal[] gaps = new BigDecimal[5];
        for (int i = 0; i < 5; i++) {
            BigDecimal desired = totalAfter.multiply(BigDecimal.valueOf(target[i])).divide(HUNDRED, 10, RoundingMode.HALF_EVEN);
            gaps[i] = desired.subtract(current[i]).max(BigDecimal.ZERO);
        }
        BigDecimal gapTotal = sum(gaps);
        BigDecimal[] raw = new BigDecimal[5];
        for (int i = 0; i < 5; i++) {
            // gapTotal >= budget > 0 always (the shortfalls add up to at least the new money)
            raw[i] = gapTotal.signum() > 0
                    ? budget.multiply(gaps[i]).divide(gapTotal, 10, RoundingMode.HALF_EVEN)
                    : budget.multiply(BigDecimal.valueOf(target[i])).divide(HUNDRED, 10, RoundingMode.HALF_EVEN);
        }
        // Round to paise; give any rounding remainder to the largest share so the total equals the budget
        BigDecimal[] rounded = new BigDecimal[5];
        int largest = 0;
        for (int i = 0; i < 5; i++) {
            rounded[i] = raw[i].setScale(2, RoundingMode.DOWN);
            if (raw[i].compareTo(raw[largest]) > 0) {
                largest = i;
            }
        }
        rounded[largest] = rounded[largest].add(budget.setScale(2, RoundingMode.DOWN).subtract(sum(rounded)));
        return rounded;
    }

    private static List<String> explain(String risk, String signal, BigDecimal[] current, BigDecimal budget,
                                        int[] target, BigDecimal[] suggested) {
        List<String> reasons = new ArrayList<>();
        int[] base = TARGETS.get(risk);
        reasons.add("Your risk appetite is " + titleCase(risk) + ", so the target mix is " + mix(base) + ".");
        switch (signal) {
            case "DOWNTREND" -> reasons.add("The BSE Sensex fell on each of the last 3 trading days, so 5% of the "
                    + "target moved from Shares to Bonds (+3%) and Commodities-Gold (+2%) to lower risk. "
                    + "Adjusted target: " + mix(target) + ".");
            case "NORMAL" -> reasons.add("The BSE Sensex has not fallen 3 trading days in a row, so no defensive "
                    + "adjustment was made.");
            default -> reasons.add("There is not enough recent BSE data to check the Sensex trend, so no market "
                    + "adjustment was made.");
        }
        BigDecimal total = sum(current);
        BigDecimal[] currentPct = percentages(current);
        if (total.signum() == 0) {
            reasons.add("You have no investments recorded yet, so the budget of " + rupees(budget)
                    + " is split by the target mix.");
        } else {
            reasons.add("The budget of " + rupees(budget) + " goes first to the asset classes that are furthest "
                    + "below their target share. Nothing is sold.");
        }
        for (int i = 0; i < 5; i++) {
            String label = AssetAmounts.LABELS.get(i);
            if (suggested[i].signum() > 0) {
                reasons.add(label + ": invest " + rupees(suggested[i])
                        + (total.signum() == 0 ? "" : " (now " + percent(currentPct[i]) + " of your money, target "
                        + target[i] + "%)") + ".");
            } else if (total.signum() > 0) {
                reasons.add(label + ": nothing new, because it is already at or above its target ("
                        + percent(currentPct[i]) + " now, target " + target[i] + "%).");
            }
        }
        BigDecimal[] after = new BigDecimal[5];
        for (int i = 0; i < 5; i++) {
            after[i] = current[i].add(suggested[i]);
        }
        BigDecimal[] afterPct = percentages(after);
        StringBuilder result = new StringBuilder("After investing, your mix will be ");
        for (int i = 0; i < 5; i++) {
            result.append(i == 0 ? "" : i == 4 ? " and " : ", ")
                    .append(AssetAmounts.LABELS.get(i)).append(' ').append(percent(afterPct[i]));
        }
        reasons.add(result.append('.').toString());
        return reasons;
    }

    private static BigDecimal[] percentages(BigDecimal[] values) {
        BigDecimal total = sum(values);
        BigDecimal[] result = new BigDecimal[5];
        for (int i = 0; i < 5; i++) {
            result[i] = total.signum() == 0 ? BigDecimal.ZERO
                    : values[i].multiply(HUNDRED).divide(total, 1, RoundingMode.HALF_EVEN);
        }
        return result;
    }

    private static BigDecimal sum(BigDecimal[] values) {
        BigDecimal total = BigDecimal.ZERO;
        for (BigDecimal value : values) {
            total = total.add(value);
        }
        return total;
    }

    private static BigDecimal validAmount(BigDecimal value, String field) {
        if (value == null) {
            throw invalid(field + " is required.");
        }
        if (value.signum() < 0) {
            throw invalid(field + " cannot be negative.");
        }
        if (value.compareTo(MAX_AMOUNT) > 0) {
            throw invalid(field + " is too large.");
        }
        return value.setScale(2, RoundingMode.HALF_EVEN);
    }

    private static String mix(int[] target) {
        StringBuilder text = new StringBuilder();
        for (int i = 0; i < 5; i++) {
            text.append(i == 0 ? "" : i == 4 ? " and " : ", ")
                    .append(AssetAmounts.LABELS.get(i)).append(' ').append(target[i]).append('%');
        }
        return text.toString();
    }

    private static String rupees(BigDecimal amount) {
        // ICU gives Indian digit grouping (₹1,00,000.00), matching the rest of the app
        return NumberFormat.getCurrencyInstance(new ULocale("en_IN")).format(amount);
    }

    private static String percent(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString() + "%";
    }

    private static String titleCase(String value) {
        return value.charAt(0) + value.substring(1).toLowerCase(Locale.ROOT);
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "invalid_plan", message);
    }
}
