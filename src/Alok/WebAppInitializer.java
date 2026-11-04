/* WebAppInitializer.java is typically the entry point for a Spring web application that runs without a web.xml file. It tells the servlet container how to start the app and which Spring configuration classes to load. */

package com.portfolio.config;

import java.util.Set;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.SessionCookieConfig;
import jakarta.servlet.SessionTrackingMode;
import org.springframework.web.servlet.support.AbstractAnnotationConfigDispatcherServletInitializer;
public class WebAppInitializer extends AbstractAnnotationConfigDispatcherServletInitializer {
    /* @Override says this method replaces a method declared in a parent class. Java checks that the method signature matches. */
    @Override
    /*Declares the onStartup method. The servlet container calls it when the application starts. ServletContext represents the web application’s shared configuration and environment. The method may throw ServletException if startup configuration fails. */
    public void onStartup(ServletContext servletContext) throws ServletException {
        /*Gets the configuration for the cookie used to identify an HTTP session, usually named JSESSIONID. */
        SessionCookieConfig cookie = servletContext.getSessionCookieConfig();
        /*Intended to mark the session cookie as HttpOnly, which prevents browser JavaScript from reading it. This can reduce the impact of some cross-site scripting attacks. */        cookie.setHttpOnly(httpOnly:true);
        cookie.setHttpOnly(true);
        /* Marks the cookie as Secure when isProduction() returns true. A Secure cookie is sent only over HTTPS. This assumes isProduction() correctly identifies the production environment. */
        cookie.setSecure(isProduction());
        /* Sets the cookie’s SameSite attribute to Lax. This generally limits the cookie from being sent on cross-site requests, while still allowing it in some top-level navigation cases. Support for setting this attribute through setAttribute depends on the Servlet API version and container. */
        cookie.setAttribute("SameSite", "Lax");
        /* Sets the session timeout to 30 minutes of inactivity. */
        servletContext.setSessionTimeout(30);
        /* Configures sessions to be tracked using cookies only. This avoids putting the session ID in URLs. */
        servletContext.setSessionTrackingModes(Set.of(SessionTrackingMode.COOKIE));
        /* Calls the parent class’s startup method so it can perform its own initialization. In an initializer that extends Spring’s AbstractAnnotationConfigDispatcherServletInitializer, this typically registers the Spring application context and DispatcherServlet. */
        super.onStartup(servletContext);
    }
    
    /* @Override says this method replaces a method declared in a parent class. Java checks that the method signature matches. */
    @Override
    /* protected means the method is available to its class, subclasses, and other classes in the same package. */
    /* Class<?>[] is an array of Class objects. ? means the array can hold classes of any type. */
    /* getRootConfigClasses() is the method name. In Spring’s AbstractAnnotationConfigDispatcherServletInitializer, it tells Spring which configuration classes to use for the root application context. */
    protected class<?>[] getRootConfigClasses() {
    /* creates and returns an array containing the RootConfig class. Spring uses that class to load the root context configuration, commonly for services, repositories, and other shared beans. */
    return new Class<?>[] { RootConfig.class };
    }
    
    /* @Override tells Java this method implements or replaces a method from a parent class. The compiler checks that its signature matches. */
    @Override
    /* protected controls visibility: the method is accessible within this class, its subclasses, and classes in the same package. */
    /* Class<?>[] means the method returns an array of class references; ? allows classes of any type. */
    /* getServletConfigClasses() is a Spring initializer method. It tells Spring which configuration classes to use for the DispatcherServlet’s application context, which typically contains web-related beans such as controllers and view resolvers. */
    protected class<?>[] getServletConfigClasses() {
        return new Class <?>[] { WebConfig.class };
    
    }

    @Override
    /* String[] is an array of strings, so the method can return one or more URL patterns. */
    /* getServletMappings() tells Spring which URL patterns should be handled by the DispatcherServlet */
    /* - new String[] { "/" } returns an array containing the pattern /. This maps the DispatcherServlet to the application’s root path, so it handles requests that don’t match a more specific servlet mapping. Inside Spring MVC, it can then route requests to the appropriate controller. */
    protected String[] getServletMappings() {
        return new String[] { "/" };
    }
    
    /* private means this method can be called only from within its class. */
    /* static means it belongs to the class itself, so it can be called without creating an object. */
    /* boolean is the return type: the method returns either true or false. */
    /* isProduction() is the method name. It checks whether the application is configured to run in production. */

    private static boolean isProduction() {
    /* System.getenv("APP_ENV") reads the operating-system environment variable named APP_ENV. For example, it might contain production, development, or test. */
    /* "production".equalsIgnoreCase(...) compares that value with "production", ignoring uppercase and lowercase differences. It returns true for values such as production or PRODUCTION. If APP_ENV is missing, System.getenv returns null; calling equalsIgnoreCase this way is safe because the string on the left is not null. */
    /* The return sends that comparison result back to the caller. */
    return "production".equalsIgnoreCase(System.getenv(:"APP_ENV"));
    }
}