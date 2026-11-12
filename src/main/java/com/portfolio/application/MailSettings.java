package com.portfolio.application;

import java.net.URI;

import org.springframework.stereotype.Component;

@Component
public class MailSettings {
    private final String host = env("PORTFOLIO_MAIL_HOST");
    private final int port = integerEnv("PORTFOLIO_MAIL_PORT", 587);
    private final String username = env("PORTFOLIO_MAIL_USERNAME");
    private final String password = env("PORTFOLIO_MAIL_PASSWORD");
    private final String from = env("PORTFOLIO_MAIL_FROM");
    private final String publicBaseUrl = env("PORTFOLIO_PUBLIC_BASE_URL");
    private final boolean startTls = booleanEnv("PORTFOLIO_MAIL_STARTTLS", true);
    private final boolean ssl = booleanEnv("PORTFOLIO_MAIL_SSL", false);

    public String host() { return host; }
    public int port() { return port; }
    public String username() { return username; }
    public String password() { return password; }
    public String from() { return from; }
    public boolean startTls() { return startTls; }
    public boolean ssl() { return ssl; }

    public boolean isConfigured() {
        return host != null && !host.isBlank()
                && port > 0 && port <= 65535
                && from != null && !from.isBlank()
                && publicBaseUrlIsValid()
                && (username == null || username.isBlank()) == (password == null || password.isBlank())
                && (startTls || ssl)
                && !(startTls && ssl)
                && (!"production".equalsIgnoreCase(env("APP_ENV"))
                    || publicBaseUrl.regionMatches(true, 0, "https://", 0, 8));
    }

    public String resetLink(String token) {
        String base = publicBaseUrl.endsWith("/")
                ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1)
                : publicBaseUrl;
        return base + "/reset-password.html#token=" + token;
    }

    private boolean publicBaseUrlIsValid() {
        if (publicBaseUrl == null || publicBaseUrl.isBlank()) return false;
        try {
            URI uri = URI.create(publicBaseUrl);
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null
                    && uri.getQuery() == null && uri.getFragment() == null;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private static String env(String name) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static int integerEnv(String name, int defaultValue) {
        try {
            return Integer.parseInt(env(name));
        } catch (RuntimeException exception) {
            return defaultValue;
        }
    }

    private static boolean booleanEnv(String name, boolean defaultValue) {
        String value = env(name);
        return value == null ? defaultValue : Boolean.parseBoolean(value);
    }
}
