package com.portfolio.api;

import java.util.List;

import com.portfolio.application.InvestmentPlanService;
import com.portfolio.application.InvestmentPlanService.PlanInput;
import com.portfolio.application.InvestmentPlanService.PlanResult;
import com.portfolio.application.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InvestmentPlanController {
    private final InvestmentPlanService plans;

    public InvestmentPlanController(InvestmentPlanService plans) {
        this.plans = plans;
    }

    /** Creates a plan, computes the suggested split and saves it. */
    @PostMapping("/api/plans")
    public ResponseEntity<PlanResult> create(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody PlanInput request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(plans.create(user.userId(), request));
    }

    /** The signed-in user's 10 most recent plans, newest first. */
    @GetMapping("/api/plans")
    public List<PlanResult> recent(@AuthenticationPrincipal UserPrincipal user) {
        return plans.recent(user.userId());
    }
}
