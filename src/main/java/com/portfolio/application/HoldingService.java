package com.portfolio.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.List;
import java.util.Set;

import com.ibm.icu.lang.UCharacter;
import com.portfolio.persistence.HoldingRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HoldingService {
    private static final Set<String> INVESTMENT_TYPES = Set.of(
            "Bonds", "Commodities-Gold", "Commodities-Silver", "Equity", "Intraday", "Stocks/Shares");
    private final HoldingRepository holdings;
    private final PortfolioService portfolios;

    public HoldingService(HoldingRepository holdings, PortfolioService portfolios) {
        this.holdings = holdings;
        this.portfolios = portfolios;
    }

    @Transactional(readOnly = true)
    public List<Holding> list(long userId, long portfolioId) {
        portfolios.requireOwned(userId, portfolioId);
        return holdings.findAllByPortfolioAndOwner(portfolioId, userId);
    }

    @Transactional(readOnly = true)
    public List<SoldHolding> listSold(long userId, long portfolioId) {
        portfolios.requireOwned(userId, portfolioId);
        return holdings.findAllSoldByPortfolioAndOwner(portfolioId, userId);
    }

    @Transactional
    public Holding add(long userId, long portfolioId, HoldingInput input) {
        portfolios.requireOwned(userId, portfolioId);
        HoldingFields fields = validate(input);
        if (holdings.existsWithSameDetails(userId, fields.investmentType(), fields.normalizedName(), fields.ticker(),
                fields.units(), fields.averagePurchasePrice(), null)) {
            throw duplicateInvestment();
        }
        try {
            long id = holdings.create(userId, portfolioId, fields.investmentType(), fields.name(), fields.normalizedName(), fields.ticker(),
                    fields.units(), fields.averagePurchasePrice());
            return holdings.findByIdAndOwner(id, userId).orElseThrow(IllegalStateException::new);
        } catch (DuplicateKeyException exception) {
            throw duplicateInvestment();
        }
    }

    @Transactional
    public Holding update(long userId, long holdingId, HoldingInput input) {
        if (holdings.findByIdAndOwner(holdingId, userId).isEmpty()) {
            throw holdingNotFound();
        }
        HoldingFields fields = validate(input);
        if (holdings.existsWithSameDetails(userId, fields.investmentType(), fields.normalizedName(), fields.ticker(),
                fields.units(), fields.averagePurchasePrice(), holdingId)) {
            throw duplicateInvestment();
        }
        try {
            holdings.updateByIdAndOwner(holdingId, userId, fields.investmentType(), fields.name(), fields.normalizedName(), fields.ticker(),
                    fields.units(), fields.averagePurchasePrice());
            return holdings.findByIdAndOwner(holdingId, userId).orElseThrow(HoldingService::holdingNotFound);
        } catch (DuplicateKeyException exception) {
            throw duplicateInvestment();
        }
    }

    @Transactional
    public void delete(long userId, long holdingId) {
        if (holdings.deleteByIdAndOwner(holdingId, userId) == 0) {
            throw holdingNotFound();
        }
    }

    @Transactional
    public void sell(long userId, long holdingId) {
        if (holdings.moveToSoldByIdAndOwner(holdingId, userId) == 0) {
            throw holdingNotFound();
        }
    }

    private static HoldingFields validate(HoldingInput input) {
        if (input == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_holding", "Holding fields are required.");
        }
        String investmentType = input.investmentType() == null ? "" : input.investmentType().strip();
        if (!INVESTMENT_TYPES.contains(investmentType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_investment_type",
                    "Select a valid investment type.");
        }
        String name = input.companyName() == null ? "" : input.companyName().strip();
        if (name.isBlank() || name.codePointCount(0, name.length()) > 255) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_investment_name",
                    "Investment name must contain 1 to 255 non-whitespace characters.");
        }
        name = Normalizer.normalize(name, Normalizer.Form.NFC);
        String normalized = Normalizer.normalize(UCharacter.foldCase(name, true), Normalizer.Form.NFC);
        if (normalized.codePointCount(0, normalized.length()) > 512) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "investment_name_too_long",
                    "Normalized investment name exceeds 512 characters.");
        }
        String ticker = input.ticker() == null ? null : input.ticker().strip();
        if (ticker != null && ticker.isEmpty()) {
            ticker = null;
        }
        if (ticker != null && ticker.codePointCount(0, ticker.length()) > 32) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ticker_too_long", "Ticker/reference code must be at most 32 characters.");
        }
        BigDecimal units = decimal(input.unitsOwned(), 24, 8, "units_owned");
        BigDecimal averagePrice = decimal(input.averagePurchasePrice(), 19, 4, "average_purchase_price");
        if (units.signum() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_units", "Units owned must be greater than zero.");
        }
        if (averagePrice.signum() < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_price", "Average purchase price must be zero or greater.");
        }
        return new HoldingFields(investmentType, name, normalized, ticker, units, averagePrice);
    }

    private static BigDecimal decimal(BigDecimal value, int precision, int scale, String field) {
        if (value == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "missing_" + field, field + " is required.");
        }
        try {
            BigDecimal scaled = value.setScale(scale, RoundingMode.UNNECESSARY);
            if (scaled.precision() > precision) {
                throw new ArithmeticException("precision exceeds column capacity");
            }
            return scaled;
        } catch (ArithmeticException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_" + field,
                    field + " exceeds the supported decimal precision.");
        }
    }

    private static ApiException duplicateInvestment() {
        return new ApiException(HttpStatus.CONFLICT, "duplicate_investment",
                "A record with the same details already exists for the same holdings. Please add different details.");
    }

    private static ApiException holdingNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "holding_not_found", "Holding was not found.");
    }

    public record HoldingInput(
            String investmentType,
            String companyName,
            String ticker,
            BigDecimal unitsOwned,
            BigDecimal averagePurchasePrice) {
    }

    private record HoldingFields(
            String investmentType,
            String name,
            String normalizedName,
            String ticker,
            BigDecimal units,
            BigDecimal averagePurchasePrice) {
    }
}
