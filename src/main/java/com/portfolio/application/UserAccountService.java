package com.portfolio.application;

import java.util.Locale;
import java.util.regex.Pattern;

import com.portfolio.persistence.UserRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAccountService implements UserDetailsService {
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public UserAccountService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public long register(String emailInput, String password) {
        String email = normalizeEmail(emailInput);
        if (email.length() > 254 || !EMAIL_PATTERN.matcher(email).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_email", "Enter a valid email address.");
        }
        if (password == null || password.codePointCount(0, password.length()) < 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_password", "Password must contain at least 8 characters.");
        }
        try {
            return users.create(email, passwordEncoder.encode(password));
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "email_already_registered", "An account with this email already exists.");
        }
    }

    @Override
    public UserPrincipal loadUserByUsername(String email) throws UsernameNotFoundException {
        return users.findByEmail(normalizeEmail(email))
                .map(UserPrincipal::new)
                .orElseThrow(() -> new UsernameNotFoundException("Account not found"));
    }

    public static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
