package com.portfolio.api;

import java.util.List;
import com.portfolio.application.Holding;
import com.portfolio.application.HoldingService;
import com.portfolio.application.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HoldingController {
    private final HoldingService holdings;

    public HoldingController(HoldingService holdings) {
        this.holdings = holdings;
    }

    @GetMapping("/api/portfolios/{portfolioId}/holdings")
    public List<Holding> list(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable long portfolioId) {
        return holdings.list(user.userId(), portfolioId);
    }

    @PostMapping("/api/portfolios/{portfolioId}/holdings")
    public ResponseEntity<Holding> add(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable long portfolioId,
            @RequestBody HoldingService.HoldingInput request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(holdings.add(user.userId(), portfolioId, request));
    }

    @PutMapping("/api/holdings/{holdingId}")
    public Holding update(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable long holdingId,
            @RequestBody HoldingService.HoldingInput request) {
        return holdings.update(user.userId(), holdingId, request);
    }

    @DeleteMapping("/api/holdings/{holdingId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable long holdingId) {
        holdings.delete(user.userId(), holdingId);
        return ResponseEntity.noContent().build();
    }
}
