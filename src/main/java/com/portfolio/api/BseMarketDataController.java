package com.portfolio.api;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

import com.portfolio.application.ApiException;
import com.portfolio.application.BseDailyPrice;
import com.portfolio.persistence.BseDailyPriceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BseMarketDataController {
    private final BseDailyPriceRepository prices;

    public BseMarketDataController(BseDailyPriceRepository prices) {
        this.prices = prices;
    }

    @GetMapping("/api/market-data/bse/latest")
    public List<BseDailyPrice> latest(@RequestParam(name = "keys", required = false) List<String> keys) {
        if (keys == null || keys.isEmpty()) {
            return List.of();
        }
        if (keys.size() > 200) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "too_many_market_data_keys",
                    "Request no more than 200 BSE symbols or security codes at once.");
        }
        List<String> normalized = keys.stream()
                .map(key -> key == null ? "" : key.trim().toUpperCase(Locale.ROOT))
                .distinct()
                .toList();
        if (normalized.stream().anyMatch(key -> key.isBlank() || key.length() > 32)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_market_data_key",
                    "BSE symbols and security codes must contain 1 to 32 characters.");
        }
        return prices.findLatestByKeys(normalized);
    }

    @GetMapping("/api/market-data/bse/status")
    public BseMarketStatus status() {
        return new BseMarketStatus(prices.latestTradeDate(), "BSE end-of-day Bhav Copy");
    }

    public record BseMarketStatus(LocalDate latestTradeDate, String source) {
    }
}
