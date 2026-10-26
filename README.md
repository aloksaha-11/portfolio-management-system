# Portfolio Management System

A Java 21 web application using the Spring Framework (Spring MVC), packaged as a WAR for deployment to a Jakarta Servlet 6.1 compatible container. The source tree is organized around the planned user, investment, portfolio, and recommendation domains.

## Requirements

- JDK 21
- Maven 3.9+
- A Jakarta Servlet 6.1 compatible container, such as Apache Tomcat 11

## Build and deploy

```bash
mvn package
```

Deploy `target/portfolio-management-system.war` to your servlet container. The API responds at `/portfolio-management-system/api`; health is available at `/portfolio-management-system/api/health`.

## Current foundation

- Spring MVC with Java based servlet initialization and configuration
- JSON responses through Jackson
- API info and health endpoints

Persistence, authentication, and portfolio workflows are left for the first product requirements so their data model and business rules can be designed together.
