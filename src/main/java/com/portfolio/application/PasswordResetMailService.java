package com.portfolio.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskExecutor;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSender;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.stereotype.Service;

@Service
public class PasswordResetMailService {
    private static final Logger logger = LoggerFactory.getLogger(PasswordResetMailService.class);
    private final MailSender sender;
    private final TaskExecutor executor;
    private final MailSettings settings;

    public PasswordResetMailService(
            MailSender sender,
            @org.springframework.beans.factory.annotation.Qualifier("passwordResetMailExecutor") TaskExecutor executor,
            MailSettings settings) {
        this.sender = sender;
        this.executor = executor;
        this.settings = settings;
    }

    public void queueResetEmail(String email, String resetLink) {
        if (!settings.isConfigured()) {
            logger.warn("Password reset email is not configured; set the PORTFOLIO_MAIL_* and PORTFOLIO_PUBLIC_BASE_URL environment variables");
            return;
        }
        try {
            executor.execute(() -> send(email, resetLink));
        } catch (RuntimeException exception) {
            logger.warn("Could not queue password reset email ({})", exception.getClass().getSimpleName());
        }
    }

    private void send(String email, String resetLink) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(settings.from());
        message.setTo(email);
        message.setSubject("Reset your Folio password");
        message.setText("A password reset was requested for your Folio account.\n\n"
                + "Use this one-time link within 30 minutes to choose a new password:\n"
                + resetLink + "\n\n"
                + "If you did not request this, you can ignore this email. Your password will not change.");
        try {
            sender.send(message);
        } catch (MailException exception) {
            logger.warn("Could not send password reset email ({})", exception.getClass().getSimpleName());
        }
    }
}
