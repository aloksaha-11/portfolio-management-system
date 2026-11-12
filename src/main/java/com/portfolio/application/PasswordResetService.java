package com.portfolio.application;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.OptionalLong;
import java.util.regex.Pattern;

import com.portfolio.persistence.LoginThrottleRepository;
import com.portfolio.persistence.LoginThrottleRepository.ThrottleState;
import com.portfolio.persistence.PasswordResetTokenRepository;
import com.portfolio.persistence.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class PasswordResetService {
    private static final int ACCOUNT_REQUEST_LIMIT = 3;
    private static final int IP_REQUEST_LIMIT = 20;
    private static final Pattern TOKEN_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{43}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final LoginThrottleRepository throttles;
    private final ThrottleKeyService throttleKeys;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetMailService mail;
    private final MailSettings mailSettings;

    public PasswordResetService(
            UserRepository users,
            PasswordResetTokenRepository tokens,
            LoginThrottleRepository throttles,
            ThrottleKeyService throttleKeys,
            PasswordEncoder passwordEncoder,
            PasswordResetMailService mail,
            MailSettings mailSettings) {
        this.users = users;
        this.tokens = tokens;
        this.throttles = throttles;
        this.throttleKeys = throttleKeys;
        this.passwordEncoder = passwordEncoder;
        this.mail = mail;
        this.mailSettings = mailSettings;
    }

    @Transactional
    public void requestReset(String emailInput, String remoteAddress) {
        String email = UserAccountService.normalizeEmail(emailInput);
        byte[] accountKey = throttleKeys.hash("PASSWORD_RESET_ACCOUNT\0" + bounded(email, 254));
        byte[] ipKey = throttleKeys.hash("PASSWORD_RESET_IP\0" + bounded(remoteAddress, 128));

        ThrottleState accountState = throttles.lockBucket("ACCOUNT", accountKey);
        ThrottleState ipState = throttles.lockBucket("IP", ipKey);
        boolean accountAllowed = throttles.recordAttempt("ACCOUNT", accountKey, accountState, ACCOUNT_REQUEST_LIMIT);
        boolean ipAllowed = throttles.recordAttempt("IP", ipKey, ipState, IP_REQUEST_LIMIT);
        if (!accountAllowed || !ipAllowed || email.length() > 254 || !mailSettings.isConfigured()) {
            return;
        }

        users.findByEmail(email).ifPresent(user -> {
            byte[] randomToken = new byte[32];
            RANDOM.nextBytes(randomToken);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(randomToken);
            byte[] tokenHash = sha256(token.getBytes(StandardCharsets.US_ASCII));
            tokens.replaceForUser(user.userId(), tokenHash);
            String resetLink = mailSettings.resetLink(token);
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        mail.queueResetEmail(user.email(), resetLink);
                    }
                });
            } else {
                mail.queueResetEmail(user.email(), resetLink);
            }
        });
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        if (newPassword == null || newPassword.codePointCount(0, newPassword.length()) < 8
                || newPassword.codePointCount(0, newPassword.length()) > 128) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_password",
                    "Password must contain between 8 and 128 characters.");
        }
        if (token == null || !TOKEN_PATTERN.matcher(token).matches()) {
            throw invalidToken();
        }

        byte[] tokenHash = sha256(token.getBytes(StandardCharsets.US_ASCII));
        OptionalLong userId = tokens.findUserIdForValidToken(tokenHash);
        if (userId.isEmpty()) {
            throw invalidToken();
        }

        int updated = users.updatePasswordHashAndRevokeSessions(
                userId.getAsLong(), passwordEncoder.encode(newPassword));
        if (updated != 1 || tokens.deleteByTokenHash(tokenHash) != 1) {
            throw invalidToken();
        }
    }

    private static byte[] sha256(byte[] value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private static String bounded(String value, int maxLength) {
        if (value == null) return "";
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private static ApiException invalidToken() {
        return new ApiException(HttpStatus.BAD_REQUEST, "invalid_or_expired_reset_token",
                "This password reset link is invalid or has expired. Request a new link.");
    }
}
