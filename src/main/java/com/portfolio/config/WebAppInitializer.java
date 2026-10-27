package com.portfolio.config;

import java.util.Set;

import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.SessionCookieConfig;
import jakarta.servlet.SessionTrackingMode;
import org.springframework.web.servlet.support.AbstractAnnotationConfigDispatcherServletInitializer;

public class WebAppInitializer extends AbstractAnnotationConfigDispatcherServletInitializer {

    @Override
    public void onStartup(ServletContext servletContext) throws ServletException {
        SessionCookieConfig cookie = servletContext.getSessionCookieConfig();
        cookie.setHttpOnly(true);
        cookie.setSecure(isProduction());
        cookie.setAttribute("SameSite", "Lax");
        servletContext.setSessionTimeout(30);
        servletContext.setSessionTrackingModes(Set.of(SessionTrackingMode.COOKIE));
        super.onStartup(servletContext);
    }

    @Override
    protected Class<?>[] getRootConfigClasses() {
        return new Class<?>[] { RootConfig.class };
    }

    @Override
    protected Class<?>[] getServletConfigClasses() {
        return new Class<?>[] { WebConfig.class };
    }

    @Override
    protected String[] getServletMappings() {
        return new String[] { "/" };
    }

    private static boolean isProduction() {
        return "production".equalsIgnoreCase(System.getenv("APP_ENV"));
    }
}
