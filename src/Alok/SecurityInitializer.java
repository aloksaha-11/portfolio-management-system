/* SecurityInitializer.java usually connects Spring Security to the web application. In a traditional Spring MVC app, it often registers Spring Security’s filter chain with the servlet container, so incoming requests pass through security checks such as authentication and authorization.*/

package com.portfolio.config;

/* This line imports Spring Security’s AbstractSecurityWebApplicationInitializer class so SecurityInitializer.java can refer to it without writing the full package name. */

import org.springframework.security.web.context.AbstractSecurityWebApplicationInitializer;

/* When the servlet container starts the app, that initializer registers Spring Security’s filter chain. The filters then process incoming requests for security concerns such as authentication and authorization.
The import line itself only makes the class available to the source file; the registration happens through the initializer class that extends it. */
public class SecurityInitializer extends AbstractSecurityebApplicationInitializer{
    
}
