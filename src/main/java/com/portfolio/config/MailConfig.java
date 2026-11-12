package com.portfolio.config;

import java.util.Properties;

import com.portfolio.application.MailSettings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class MailConfig {
    private static final Logger logger = LoggerFactory.getLogger(MailConfig.class);

    @Bean
    public JavaMailSender javaMailSender(MailSettings settings) {
        if (!settings.isConfigured()) {
            logger.warn("Password reset email delivery is disabled until SMTP and public URL environment variables are configured");
        }
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        if (settings.host() != null) sender.setHost(settings.host());
        sender.setPort(settings.port());
        if (settings.username() != null) sender.setUsername(settings.username());
        if (settings.password() != null) sender.setPassword(settings.password());
        sender.setDefaultEncoding("UTF-8");

        Properties mail = sender.getJavaMailProperties();
        mail.put("mail.smtp.auth", settings.username() != null ? "true" : "false");
        mail.put("mail.smtp.starttls.enable", Boolean.toString(settings.startTls()));
        mail.put("mail.smtp.starttls.required", Boolean.toString(settings.startTls()));
        mail.put("mail.smtp.ssl.enable", Boolean.toString(settings.ssl()));
        mail.put("mail.smtp.connectiontimeout", "5000");
        mail.put("mail.smtp.timeout", "5000");
        mail.put("mail.smtp.writetimeout", "5000");
        return sender;
    }

    @Bean(name = "passwordResetMailExecutor")
    public TaskExecutor passwordResetMailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("password-reset-mail-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        executor.initialize();
        return executor;
    }
}
