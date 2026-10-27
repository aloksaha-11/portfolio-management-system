package com.portfolio.application;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.portfolio.persistence.LoginThrottleRepository;
import com.portfolio.persistence.LoginThrottleRepository.ThrottleState;

@Service
public class LoginService {
    private static final String ACCOUNT = "ACCOUNT";
    private static final String IP = "IP";

    private final AuthenticationManager authenticationManager;
    private final LoginThrottleRepository throttles;
    private final ThrottleKeyService throttleKeys;

    public LoginService(
            AuthenticationManager authenticationManager,
            LoginThrottleRepository throttles,
            ThrottleKeyService throttleKeys) {
        this.authenticationManager = authenticationManager;
        this.throttles = throttles;
        this.throttleKeys = throttleKeys;
    }

    @Transactional
    public LoginResult authenticate(String emailInput, String password, String remoteAddress) {
        String email = UserAccountService.normalizeEmail(emailInput);
        byte[] accountKey = throttleKeys.hash(ACCOUNT + "\0" + email);
        byte[] ipKey = throttleKeys.hash(IP + "\0" + remoteAddress);

        ThrottleState accountState = throttles.lockBucket(ACCOUNT, accountKey);
        ThrottleState ipState = throttles.lockBucket(IP, ipKey);
        if (ipState.blockActive() || (!accountState.windowExpired() && accountState.delayActive())) {
            return LoginResult.limited();
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(email, password == null ? "" : password));
            throttles.resetAccount(ACCOUNT, accountKey);
            return LoginResult.authenticated(authentication);
        } catch (AuthenticationException exception) {
            throttles.recordFailure(ACCOUNT, accountKey, accountState);
            throttles.recordFailure(IP, ipKey, ipState);
            return LoginResult.failed();
        }
    }

    public record LoginResult(Authentication authentication, boolean limited) {
        public static LoginResult authenticated(Authentication authentication) {
            return new LoginResult(authentication, false);
        }

        public static LoginResult failed() {
            return new LoginResult(null, false);
        }

        public static LoginResult limited() {
            return new LoginResult(null, true);
        }

        public boolean succeeded() {
            return authentication != null;
        }
    }
}
