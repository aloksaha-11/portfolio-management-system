/* WebConfig.java customizes Spring MVC behavior. In your file, it registers AuthenticationPrincipalArgumentResolver, which lets Spring supply the currently authenticated user to controller parameters annotated with @AuthenticationPrincipal. */

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

/* Imports the WebMvcConfigurer interface. A configuration class can implement it to customize parts of Spring MVC. */

import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/* Imports the interface for components that tell Spring MVC how to create arguments for controller method parameters. For example, a resolver can supply a value for a custom controller parameter. */

import org.springframework.web.method.support.HandlerMethodArgumentResolver;

/* Imports Spring Security’s resolver for controller parameters annotated with @AuthenticationPrincipal. It lets a controller receive the current authenticated principal as a method argument.
These lines only declare the package and make types available by short name. They do not configure Spring by themselves; annotations and code elsewhere in the file determine how the imports are used. */

import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;

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
public class WebConfig implements WebMvcConfigurer {
    @Override
/* addArgumentResolvers(...) is a Spring MVC hook for registering custom handlers that resolve controller method parameters. */
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {

/* AuthenticationPrincipalArgumentResolver handles parameters annotated with @AuthenticationPrincipal. It gets the current principal from Spring Security’s authentication context. 
   resolvers.add(...) registers that handler with Spring MVC. */
        resolvers.add(new AuthenticationPrincipalArgumentResolver());
    }
}
