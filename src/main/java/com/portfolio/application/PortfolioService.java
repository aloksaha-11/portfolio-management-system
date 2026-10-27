package com.portfolio.application;

import java.util.List;

import com.portfolio.persistence.HoldingRepository;
import com.portfolio.persistence.PortfolioRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PortfolioService {
    private final PortfolioRepository portfolios;
    private final HoldingRepository holdings;

    public PortfolioService(PortfolioRepository portfolios, HoldingRepository holdings) {
        this.portfolios = portfolios;
        this.holdings = holdings;
    }

    @Transactional
    public Portfolio create(long userId, String nameInput) {
        String name = nameInput == null ? "" : nameInput.strip();
        if (name.isBlank() || name.codePointCount(0, name.length()) > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_portfolio_name",
                    "Portfolio name must contain 1 to 100 non-whitespace characters.");
        }
        long id = portfolios.create(userId, name);
        return getPortfolio(userId, id);
    }

    @Transactional(readOnly = true)
    public List<Portfolio> list(long userId) {
        return portfolios.findAllByOwner(userId);
    }

    @Transactional(readOnly = true)
    public PortfolioDetails get(long userId, long portfolioId) {
        Portfolio portfolio = getPortfolio(userId, portfolioId);
        return PortfolioDetails.from(portfolio, holdings.findAllByPortfolioAndOwner(portfolioId, userId));
    }

    @Transactional
    public void delete(long userId, long portfolioId) {
        getPortfolio(userId, portfolioId);
        if (portfolios.hasHoldings(portfolioId)) {
            throw new ApiException(HttpStatus.CONFLICT, "portfolio_not_empty",
                    "Delete the portfolio's holdings before deleting the portfolio.");
        }
        try {
            if (portfolios.deleteByIdAndOwner(portfolioId, userId) == 0) {
                throw notFound();
            }
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "portfolio_not_empty",
                    "Delete the portfolio's holdings before deleting the portfolio.");
        }
    }

    public Portfolio requireOwned(long userId, long portfolioId) {
        return getPortfolio(userId, portfolioId);
    }

    private Portfolio getPortfolio(long userId, long portfolioId) {
        return portfolios.findByIdAndOwner(portfolioId, userId).orElseThrow(PortfolioService::notFound);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "portfolio_not_found", "Portfolio was not found.");
    }
}
