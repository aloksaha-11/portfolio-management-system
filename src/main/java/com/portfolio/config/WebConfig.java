/* Declares that this Java file belongs to the com.portfolio.config package. Packages organize related classes and help avoid naming conflicts. */

package com.portfolio.config;

/* Makes Java’s List type available by its short name. A List is an ordered collection. This import is used only if the rest of the file refers to List. */

import java.util.List;

/* Imports Spring’s @ComponentScan annotation. It tells Spring to search specified packages for components such as classes annotated with @Controller, @Service, or @Repository. */

import org.springframework.context.annotation.ComponentScan;

/* Imports Spring’s @Configuration annotation, which marks a class aPs a source of Spring configuration. */

import org.springframework.context.annotation.Configuration;

/* Imports @EnableWebMvc, which enables Spring MVC configuration, including its request-handling infrastructure. */

import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;

/* Imports the WebMvcConfigurer interface. A configuration class can implement it to customize parts of Spring MVC. */

import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/* Imports the interface for components that tell Spring MVC how to create arguments for controller method parameters. For example, a resolver can supply a value for a custom controller parameter. */

import org.springframework.web.method.support.HandlerMethodArgumentResolver;

/* Imports Spring Security’s resolver for controller parameters annotated with @AuthenticationPrincipal. It lets a controller receive the current authenticated principal as a method argument.
These lines only declare the package and make types available by short name. They do not configure Spring by themselves; annotations and code elsewhere in the file determine how the imports are used. */

import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

@Configuration
@EnableWebMvc

/* @ComponentScan tells Spring to search packages for classes that should become Spring-managed beans. These commonly include classes annotated with @Component, @Service, @Repository, or @Controller.
- basePackages lists where Spring should search.
- "com.portfolio.common" is the first package to scan.
- "com.portfolio.api" is the second package to scan.
- The braces create an array of package names.
Spring also scans subpackages under each listed package. This annotation is typically placed on a configuration class. */

@ComponentScan(basePackages = {"com.portfolio.common", "com.portfolio.api"})

/* This code customizes Spring MVC so controller methods can receive the authenticated user as a method argument.
   WebConfig implements WebMvcConfigurer lets this class customize Spring MVC configuration. */
/* Added a responsive Folio sign-in page and connected it to the existing Spring MVC app. Visiting / now serves the page, which fetches a CSRF token and submits credentials to /api/auth/login, with feedback for invalid credentials and rate limits.
The page is in [login.html](D:/Users/Admin/portfolio-management-system/src/main/resources/static/login.html), with its styling and behavior in assets/login.css and assets/login.js */

   /* This adds a simple route in Spring MVC for the site’s root URL */
public class WebConfig implements WebMvcConfigurer {
    /* @Override means Java checks that this method matches a method declared in a parent class or interface. Here, WebMvcConfigurer declares the addResourceHandlers hook that this method implements. */
    @Override
    /* addViewControllers(...) registers URL routes that don’t need a Java controller method. */
    /* registry.addViewController("/") matches requests to /. */
    /* .setViewName("forward:/login.html") forwards that request internally to login.html */
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/index.html");
    }

    @Override
    /* This tells Spring MVC where to find the login page and its static assets, such as CSS and JavaScript. */
    /* addResourceHandlers(...) is a Spring MVC configuration hook for serving static files. */
    /* addResourceHandler("/login.html", "/assets/**") sets the URL patterns Spring should handle */
    /* /login.html matches the login page. */
    /* /assets/** matches files under /assets/, such as /assets/login.css */
    /* addResourceLocations(...) tells Spring to look for those files inside the app’s classpath resources:- classpath:/static/ points to src/main/resources/static/.
     classpath:/static/assets/ points to its assets subfolder. */
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/index.html", "/login.html", "/signup.html", "/dashboard.html",
                        "/forgot-password.html", "/reset-password.html")
                .addResourceLocations("classpath:/static/");
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/");
    }

    @Override
/* addArgumentResolvers(...) is a Spring MVC hook for registering custom handlers that resolve controller method parameters. */
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {

/* AuthenticationPrincipalArgumentResolver handles parameters annotated with @AuthenticationPrincipal. It gets the current principal from Spring Security’s authentication context. 
   resolvers.add(...) registers that handler with Spring MVC. */
        resolvers.add(new AuthenticationPrincipalArgumentResolver());
    }

    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
        for (HttpMessageConverter<?> converter : converters) {
            if (converter instanceof MappingJackson2HttpMessageConverter jacksonConverter) {
                ObjectMapper mapper = jacksonConverter.getObjectMapper();
                mapper.registerModule(new JavaTimeModule());
                mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
            }
        }
    }
}
