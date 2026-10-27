package com.portfolio.api;

import java.util.List;
import com.portfolio.application.Portfolio;
import com.portfolio.application.PortfolioDetails;
import com.portfolio.application.PortfolioService;
import com.portfolio.application.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/portfolios")
public class PortfolioController {
    private final PortfolioService portfolios;

    public PortfolioController(PortfolioService portfolios) {
        this.portfolios = portfolios;
    }

    @GetMapping
    public List<Portfolio> list(@AuthenticationPrincipal UserPrincipal user) {
        return portfolios.list(user.userId());
    }

    @PostMapping
    public ResponseEntity<Portfolio> create(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody CreatePortfolioRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(portfolios.create(
                user.userId(), request == null ? null : request.name()));
    }

    @GetMapping("/{portfolioId}")
    public PortfolioDetails get(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable long portfolioId) {
        return portfolios.get(user.userId(), portfolioId);
    }

    @DeleteMapping("/{portfolioId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable long portfolioId) {
        portfolios.delete(user.userId(), portfolioId);
        return ResponseEntity.noContent().build();
    }

    public record CreatePortfolioRequest(String name) {
    }
}
