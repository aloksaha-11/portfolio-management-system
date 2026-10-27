package com.portfolio.application;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Service;

@Service
public class ThrottleKeyService {
    private final byte[] secret;

    public ThrottleKeyService() {
        String configured = System.getenv("PORTFOLIO_THROTTLE_HMAC_KEY");
        if (configured == null || configured.isBlank()) {
            throw new IllegalStateException("Required environment variable is not set: PORTFOLIO_THROTTLE_HMAC_KEY");
        }
        this.secret = configured.getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException("PORTFOLIO_THROTTLE_HMAC_KEY must contain at least 32 UTF-8 bytes");
        }
    }

    public byte[] hash(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("HMAC-SHA-256 is not available", exception);
        }
    }
}
