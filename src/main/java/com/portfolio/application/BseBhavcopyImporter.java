package com.portfolio.application;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.portfolio.persistence.BseDailyPriceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class BseBhavcopyImporter {
    private static final Logger logger = LoggerFactory.getLogger(BseBhavcopyImporter.class);
    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.BASIC_ISO_DATE;
    private static final int MAX_LOOKBACK_DAYS = 7;
    private static final String BSE_FILE_URL =
            "https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_%s_F_0000.csv";

    private final BseDailyPriceRepository prices;
    private final HttpClient http;

    public BseBhavcopyImporter(BseDailyPriceRepository prices) {
        this.prices = prices;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    @Scheduled(cron = "0 15 18,19 * * MON-FRI", zone = "Asia/Kolkata")
    public void importAfterMarketClose() {
        importLatestAvailable();
    }

    @Scheduled(initialDelay = 15_000, fixedDelay = 86_400_000)
    public void catchUpAfterStartup() {
        importLatestAvailable();
        backfillRecentCompanyNames();
    }

    private void backfillRecentCompanyNames() {
        LocalDate fromDate = LocalDate.now(INDIA_ZONE).minusDays(MAX_LOOKBACK_DAYS);
        for (LocalDate date : prices.findTradeDatesMissingCompanyNames(fromDate)) {
            try {
                HttpResponse<String> response = download(date);
                if (response.statusCode() != 200) {
                    logger.warn("Could not backfill BSE company names for {}: HTTP {}", date, response.statusCode());
                    continue;
                }
                List<BseDailyPrice> rows = parse(response.body(), date);
                int stored = prices.upsertAll(rows);
                logger.info("Backfilled company names in {} BSE rows for {}", stored, date);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                logger.warn("BSE company-name backfill was interrupted", exception);
                return;
            } catch (IOException | RuntimeException exception) {
                logger.warn("Could not backfill BSE company names for {}", date, exception);
            }
        }
    }

    public synchronized void importLatestAvailable() {
        LocalDate start = LocalDate.now(INDIA_ZONE);
        for (int offset = 0; offset <= MAX_LOOKBACK_DAYS; offset++) {
            LocalDate date = start.minusDays(offset);
            try {
                HttpResponse<String> response = download(date);
                if (response.statusCode() == 404) {
                    continue;
                }
                if (response.statusCode() != 200) {
                    logger.warn("BSE EOD download returned HTTP {} for {}", response.statusCode(), date);
                    return;
                }
                List<BseDailyPrice> rows = parse(response.body(), date);
                if (rows.isEmpty()) {
                    logger.warn("BSE EOD file for {} contained no equity prices", date);
                    return;
                }
                int stored = prices.upsertAll(rows);
                logger.info("Imported {} BSE end-of-day prices for {}", stored, date);
                return;
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                logger.warn("BSE EOD import was interrupted", exception);
                return;
            } catch (IOException | RuntimeException exception) {
                logger.warn("Could not import BSE EOD prices for {}", date, exception);
                return;
            }
        }
        logger.info("No BSE equity Bhav Copy was available for the last {} days", MAX_LOOKBACK_DAYS + 1);
    }

    private HttpResponse<String> download(LocalDate date) throws IOException, InterruptedException {
        String url = BSE_FILE_URL.formatted(FILE_DATE.format(date));
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(45))
                .header("Accept", "text/csv,application/octet-stream,*/*")
                .header("User-Agent", "PortfolioManagementSystem/1.0")
                .header("Referer", "https://www.bseindia.com/markets/MarketInfo/BhavCopy.aspx")
                .GET()
                .build();
        return http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private static List<BseDailyPrice> parse(String csv, LocalDate requestedDate) {
        String[] lines = csv.replace("\uFEFF", "").split("\\R");
        if (lines.length < 2) {
            throw new IllegalArgumentException("BSE Bhav Copy is empty or malformed");
        }
        List<String> headers = splitCsvLine(lines[0]);
        Map<String, Integer> columns = new HashMap<>();
        for (int index = 0; index < headers.size(); index++) {
            columns.put(headers.get(index).trim(), index);
        }
        int tradeDateColumn = requiredColumn(columns, "TradDt");
        int securityCodeColumn = requiredColumn(columns, "FinInstrmId");
        int isinColumn = requiredColumn(columns, "ISIN");
        int symbolColumn = requiredColumn(columns, "TckrSymb");
        int companyNameColumn = columns.getOrDefault("FinInstrmNm", -1);
        int seriesColumn = requiredColumn(columns, "SctySrs");
        int openColumn = requiredColumn(columns, "OpnPric");
        int highColumn = requiredColumn(columns, "HghPric");
        int lowColumn = requiredColumn(columns, "LwPric");
        int closeColumn = requiredColumn(columns, "ClsPric");
        int previousCloseColumn = requiredColumn(columns, "PrvsClsgPric");
        int volumeColumn = requiredColumn(columns, "TtlTradgVol");

        List<BseDailyPrice> result = new ArrayList<>();
        for (int lineNumber = 1; lineNumber < lines.length; lineNumber++) {
            String line = lines[lineNumber].trim();
            if (line.isEmpty()) {
                continue;
            }
            List<String> values = splitCsvLine(line);
            if (values.size() < headers.size()) {
                throw new IllegalArgumentException("Malformed BSE Bhav Copy row " + (lineNumber + 1));
            }
            LocalDate tradeDate = LocalDate.parse(value(values, tradeDateColumn));
            if (!requestedDate.equals(tradeDate)) {
                throw new IllegalArgumentException("BSE file date does not match its filename date");
            }
            String securityCode = value(values, securityCodeColumn);
            String series = value(values, seriesColumn).toUpperCase(Locale.ROOT);
            BigDecimal close = decimal(values, closeColumn);
            if (securityCode.isBlank() || series.isBlank() || close == null || close.signum() <= 0) {
                continue;
            }
            String symbol = value(values, symbolColumn).toUpperCase(Locale.ROOT);
            String companyName = companyNameColumn < 0 ? null : nullable(value(values, companyNameColumn));
            result.add(new BseDailyPrice(
                    securityCode,
                    nullable(value(values, isinColumn)),
                    symbol.isBlank() ? null : symbol,
                    companyName,
                    series,
                    tradeDate,
                    decimal(values, openColumn),
                    decimal(values, highColumn),
                    decimal(values, lowColumn),
                    close,
                    decimal(values, previousCloseColumn),
                    integer(values, volumeColumn)));
        }
        return result;
    }

    private static int requiredColumn(Map<String, Integer> columns, String name) {
        Integer column = columns.get(name);
        if (column == null) {
            throw new IllegalArgumentException("BSE Bhav Copy is missing the " + name + " column");
        }
        return column;
    }

    private static String value(List<String> values, int column) {
        return values.get(column).trim();
    }

    private static BigDecimal decimal(List<String> values, int column) {
        String raw = value(values, column);
        return raw.isEmpty() ? null : new BigDecimal(raw);
    }

    private static Long integer(List<String> values, int column) {
        String raw = value(values, column);
        return raw.isEmpty() ? null : Long.parseLong(raw);
    }

    private static String nullable(String value) {
        return value.isBlank() ? null : value;
    }

    private static List<String> splitCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder value = new StringBuilder();
        boolean quoted = false;
        for (int index = 0; index < line.length(); index++) {
            char character = line.charAt(index);
            if (character == '"') {
                if (quoted && index + 1 < line.length() && line.charAt(index + 1) == '"') {
                    value.append('"');
                    index++;
                } else {
                    quoted = !quoted;
                }
            } else if (character == ',' && !quoted) {
                values.add(value.toString());
                value.setLength(0);
            } else {
                value.append(character);
            }
        }
        values.add(value.toString());
        if (quoted) {
            throw new IllegalArgumentException("BSE Bhav Copy contains an unterminated CSV field");
        }
        return values;
    }
}
