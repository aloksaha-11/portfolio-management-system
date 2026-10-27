package com.portfolio.api;

import java.util.Map;

import com.portfolio.application.ApiException;
import com.portfolio.application.LoginService;
import com.portfolio.application.UserAccountService;
import com.portfolio.application.UserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserAccountService accounts;
    private final LoginService loginService;
    private final SessionAuthenticationStrategy sessionAuthenticationStrategy;
    private final SecurityContextRepository securityContextRepository;
    private final CsrfTokenRepository csrfTokenRepository;

    public AuthController(
            UserAccountService accounts,
            LoginService loginService,
            SessionAuthenticationStrategy sessionAuthenticationStrategy,
            SecurityContextRepository securityContextRepository,
            CsrfTokenRepository csrfTokenRepository) {
        this.accounts = accounts;
        this.loginService = loginService;
        this.sessionAuthenticationStrategy = sessionAuthenticationStrategy;
        this.securityContextRepository = securityContextRepository;
        this.csrfTokenRepository = csrfTokenRepository;
    }

    @GetMapping("/csrf")
    public Map<String, String> csrf(@RequestAttribute("_csrf") CsrfToken csrfToken) {
        return Map.of("headerName", csrfToken.getHeaderName(), "token", csrfToken.getToken());
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (request == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_request", "Email and password are required.");
        }
        long userId = accounts.register(request.email(), request.password());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("userId", userId, "email", UserAccountService.normalizeEmail(request.email())));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) throws Exception {
        LoginService.LoginResult result = loginService.authenticate(
                request == null ? null : request.email(),
                request == null ? null : request.password(),
                httpRequest.getRemoteAddr());
        if (result.limited()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "login_failed", "message", "Login failed. Please try again later."));
        }
        if (!result.succeeded()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "invalid_credentials", "message", "Email or password is incorrect."));
        }

        Authentication authentication = result.authentication();
        sessionAuthenticationStrategy.onAuthentication(authentication, httpRequest, httpResponse);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, httpRequest, httpResponse);
        csrfTokenRepository.saveToken(null, httpRequest, httpResponse);
        return ResponseEntity.ok(Map.of(
                "userId", ((UserPrincipal) authentication.getPrincipal()).userId(),
                "email", authentication.getName()));
    }

    @GetMapping("/me")
    public Map<String, Object> me(@org.springframework.security.core.annotation.AuthenticationPrincipal UserPrincipal user) {
        if (user == null) {
            throw new AuthenticationServiceException("Authenticated principal is unavailable");
        }
        return Map.of("userId", user.userId(), "email", user.getUsername());
    }

    public record RegisterRequest(String email, String password) {
    }

    public record LoginRequest(String email, String password) {
    }
}
