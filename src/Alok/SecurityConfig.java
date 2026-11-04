/* SecurityConfig.java usually defines the app’s security rules: how users authenticate and which requests they’re allowed to access. */
/* SecurityConfig.java may configure login, logout, password handling, session behavior, and URL access rules. */

import com.portfolio.config;

import com.portfolio.application.UserAccountService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springfranework.security.crypto.password.PasswordEncoder;
import org.springfranework.security.web.SecurityFilterChain;
import org.springframework.security.web.authenticate.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;

@Configuration
@EnabeWebSecurity

public class SecurityConfig {

/* @Bean tells Spring that the annotated method creates an object Spring should manage. */

@Bean

/* Spring calls this method and stores the returned PasswordEncoder in its application context. Other Spring-managed classes can then receive it through dependency injection. */
/* In SecurityConfig.java, @Bean commonly marks security components—such as a password encoder or authentication provider—for Spring to use. */

public PasswordEncoder passwordEncoder() {
    return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
}

@Bean
/* This method builds an AuthenticationManager that Spring Security can use to check a user’s login credentials. */
/* If this method is annotated with @Bean, Spring registers the returned manager so other security components can use it. During login, they pass the submitted credentials to it; it either returns an authenticated result or reports an authentication failure. */

public AuthenticationManager authenticationManager (
/* UserAccountService supplies user details, such as the account record and stored password. */
    UserAccountService userAccountService,
/* PasswordEncoder checks a submitted password against the stored encoded password. */
    PasswordEncoder passwordEncoder) {
/* DaoAuthenticationProvider combines those two pieces to perform username-and-password authentication. */
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userAccountService);
/* ProviderManager wraps the provider and is returned as the AuthenticationManager. */
    provider.setPasswordEncoder(passwordEncoder);
    return new ProviderManager(provider);
    }

@Bean

/* This method creates and returns a SecurityContextRepository that stores the current user’s security context in the HTTP session. */
/* SecurityContextRepository is the interface Spring Security uses to load and save the security context. */

public SecurityContextRepository securityContextRepository() {
/* HttpSessionSecurityContextRepository is an implementation that saves it in the user’s HttpSession. */
    return new HttpSessionSecurityContextRepository();
 }

@Bean
/* This method returns a Spring Security strategy that changes the HTTP session ID when a user successfully authenticates. */
/* If this method is annotated with @Bean, Spring registers the strategy so the security configuration can use it after authentication. */

public SessionAuthenticationStrategy sessionAuthenticationStrategy() {
/* ChangeSessionIdAuthenticationStrategy keeps the existing session but assigns it a new ID. This helps prevent session fixation, where someone might try to reuse a session ID that was set before the user logged in. */

    return new ChangeSessionIdAuthenticationStrategy();
}

@Bean

/* This method is intended to configure where Spring Security stores its CSRF token: in a browser cookie. CSRF tokens help protect requests that change data—such as form submissions—against cross-site request forgery. */

public CsrfTokenRepository csrfTokenRepository() {
/* CookieCsrfTokenRepository.withHttpOnlyFalse() creates a repository that stores the token in a cookie JavaScript can read. This is commonly used when frontend JavaScript needs to send the token back in a request header. */

 CsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
 
 /*setCookiePath("/") makes the cookie available across the site’s URL paths. */

 repository.setCookiePath("/"); 

 repository.setCookieCustomizer(cookie -> cookie
/* sameSite("Lax") limits when browsers send the cookie with cross-site requests, helping reduce CSRF risk. */

    .sameSite("Lax")
/* .secure(...) is intended to make the cookie HTTPS-only when the app runs in production. The shown expression looks malformed; a likely intended form is: */

    .secure("production".equalsIgnoreCase(System.getenv("APP_ENV"))));
/* - return repository gives the configured repository back to Spring. If the method has @Bean, Spring can use it in the security configuration. */

/* - return repository gives the configured repository back to Spring. If the method has @Bean, Spring can use it in the security configuration. */

return repository;
}

@Bean

/* SecurityFilterChain is a Spring Security type that represents the security filters applied to incoming HTTP requests. */
/* That method configures how requests are secured—for example, which URLs require login, how form login and logout work, and whether CSRF protection is enabled. Spring uses the returned filter chain to process requests. */

public SecurityFilterChain securityFilterChain(
    HttpSecurity http,
    SecurityContextRepository securityContextRepository,
    CsrfTokenRepository csrfTokenRepository) throws Exception {
/* /* This configures Spring Security’s HttpSecurity object to use securityContextRepository for saving and loading the current user’s security context.
      Here, context -> ... is a lambda that configures the security-context settings. This setting is part of building the app’s SecurityFilterChain. */
    http
    .securityContext(context -> context.securityContextRepository(securityContextRepository))
/* This configures Spring Security’s session handling. IF_REQUIRED means Spring Security may create an HTTP session when the application needs one, such as to save the security context after login. It won’t create a session automatically for every request. */


    .sessionManagement(session -> session
        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
/* This looks like Spring Security’s fluent configuration for session fixation protection and CSRF, but the pasted code appears corrupted or incomplete. */
/* .sessionFixation(...) configures what happens to the session ID when a user authenticates. A common setting is .changeSessionId(), which replaces the ID to help prevent session fixation. */

        .sessionFixation(fixation -> fixation.ch(csrfTokenRepositoryangeSessionId()))
/* .csrf(...) configures CSRF protection. It likely should call .csrfTokenRepository(csrfTokenRepository) to tell Spring where to store and load CSRF tokens. */

        .csrf(csrf -> csrf.csrfTokenRepository))
/* This config defines which HTTP requests can reach endpoints without being authenticated: */
/* authorizeHttpRequests(authorize -> authorize ...) starts Spring Security’s request authorization rules. The authorize parameter is the rule builder. */

        .authorizeHttpRequests(authorize -> authorize
/* .requestMatchers(HttpMethod.GET, "/api", "/api/health", "/api/auth/csrf") selects GET requests to those three paths. */
/* .permitAll() allows those matched requests without requiring a logged-in user. */
/* These rules only make the routes accessible without logging in; they do not bypass other security checks such as CSRF protection. */
            .requestMatchers(HttpMethod.GET, "/api", "/api/health", "/api/auth/csrf").permitAll()
/* requestMatchers(HttpMethod.POST, "api/auth/register", "/api/auth/logon") selects POST requests to the listed paths. */
/* .permitAll() allows those matched POST requests without authentication. */
            .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/logon").permitAll()
/* .anyRequest().authenticated() means every request that hasn’t matched an earlier rule must come from an authenticated user. */
            .anyRequest().authenticated())
/* .requestCache(cache -> cache.disable()) disables Spring Security’s request cache. By default, when an unauthenticated user requests a protected page, Spring may save that request so it can send the user there after they log in. Disabling the cache is often useful for APIs, which typically return a response instead of redirecting to a saved page. */
            .requestCache(cache -> cache.disable())
/* .exceptionHandling(exceptions -> exceptions ...) configures how Spring Security handles security-related exceptions, such as an unauthenticated request to a protected endpoint. */
            .exceptionHandling(exceptions -> exceptions
/* .authenticationEntryPoint((request, response, exception) -> { ... }) sets the handler Spring calls when authentication is required but missing or invalid. The lambda receives the HTTP request, response, and exception. */
            .authenticationEntryPoint((request, response, exception) -> {
/*response.SetStatus(401); intends to return HTTP 401 Unauthorized. */
            response.setStatus(401);
/* response.setContentType("application/json"); tells the client that the response body is JSON. It sets the Content-Type response header to application/json. */
response.setContentType("application/json");
/* response.getWriter().write("{\"error\":\"authentication_required\"}"); writes this JSON text into the response body: */
/* Together, these lines send a JSON error body. They don’t set the HTTP status; that needs a separate call such as response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);. */

            response.getWriter().write("{\"error\":\"authentication_required\"}");
            })
/* .accessDeniedHandler((request, response, exception) -> ...) configures what Spring Security should do when an authenticated user is not allowed to access a resource. */
/* The lambda receives:
- request: the incoming HTTP request
- response: the HTTP response you can send back
- exception: the access-denied exception describing why access was refused */
            .accessDeniedHandler((request, response, exception) -> {
/* response.setStatus(403); sets the HTTP response status to 403 Forbidden. It tells the client that the server understood the request but refuses access—often because the user is signed in but lacks permission. */
                response.setStatus(403);
/* response.setContentType("application/json"); sets the response’s Content-Type header to application/json. It tells the client to interpret the response body as JSON. */
                response.setContentType("application/json");
/* response.getWriter().write("{\"error\":\"access_denied\"}"); writes this JSON text into the HTTP response body: */
            response.getWriter().write("{\"error\":\"access_denied\"}");
            }))
/* .logout(logout -> logout ...) starts configuring Spring Security’s logout behavior. The logout parameter is a builder for logout settings. */

            .logout(logout -> logout
/* .logoutUrl("/api/auth/logout") sets the URL Spring Security listens to for logout requests. A request to that URL triggers the configured logout process, which typically clears the user’s authentication and invalidates their session. */

                .logoutUrl("/api/auth/logout")
/* .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)) sets what happens after logout succeeds: it returns HTTP 204 No Content, meaning logout succeeded and the response has no body. */
                .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)));
/* return http.build(); finishes configuring the Spring Security HttpSecurity object and returns the resulting SecurityFilterChain bean. */
/* In other words, it applies the security rules you configured above and gives Spring the completed chain to use for incoming HTTP requests. */
                return http.build();
}
}
