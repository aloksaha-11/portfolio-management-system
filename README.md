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

## MySQL connection

The MySQL service is available at `localhost:3306`. Apply `src/main/resources/db/schema.sql` manually to the target database before using persistence. Configure the application process with these environment variables; keep the password out of source control:

- `PORTFOLIO_DB_URL`, in the form `jdbc:mysql://localhost:3306/{database_name}`; replace `{database_name}` with the actual MySQL database/schema name
- `PORTFOLIO_DB_USERNAME`, set to `root` for this MySQL account
- `PORTFOLIO_DB_PASSWORD`
- `PORTFOLIO_THROTTLE_HMAC_KEY`, a stable random secret of at least 32 bytes used to hash account and client IP throttle keys
- `APP_ENV=production` in production deployments to mark session and CSRF cookies `Secure`

Set the MySQL server default time zone to IST (`+05:30`) so new MySQL sessions inherit it. For a persistent server setting, run `SET PERSIST time_zone = '+05:30';` as a MySQL administrator, or add `default-time-zone=+05:30` under `[mysqld]` in the MySQL option file (`my.ini` on Windows) and restart MySQL. `SET GLOBAL time_zone = '+05:30';` changes the running server until restart. These global settings apply to new sessions; reconnect existing clients after changing them.

The schema script sets its own session time zone to IST, and the JDBC connection pool also sets every application connection's session time zone to IST (`+05:30`). MySQL `TIMESTAMP` columns are returned and displayed according to the session time zone. The application does not create or migrate tables automatically. Do not commit database passwords or the HMAC key.

## API workflows

All request and response bodies use JSON. Obtain a CSRF token with `GET /api/auth/csrf`, then send the returned token in its named header (normally `X-XSRF-TOKEN`) for every `POST`, `PUT`, and `DELETE` request. The matching `XSRF-TOKEN` cookie must also be sent.

- `POST /api/auth/register` — body: `{"email":"...","password":"..."}`; returns `201` with the account ID and normalized email.
- `POST /api/auth/login` — same body shape; establishes the server-side session and rotates its ID.
- `POST /api/auth/logout` — invalidates the session.
- `GET /api/auth/me` — returns the signed-in account.
- `GET /api/portfolios`, `POST /api/portfolios`, `GET /api/portfolios/{id}`, `DELETE /api/portfolios/{id}` — owner-scoped portfolio operations.
- `GET /api/portfolios/{id}/holdings`, `POST /api/portfolios/{id}/holdings`, `PUT /api/holdings/{id}`, `DELETE /api/holdings/{id}` — owner-scoped current-position operations.

The login limiter uses the direct servlet client address. Forwarded IP headers are not trusted.

## Current foundation

- Spring MVC with Java based servlet initialization and configuration
- JSON responses through Jackson
- API info and health endpoints
- MySQL JDBC connection pool, `JdbcTemplate`, and transaction manager
- Spring Security session authentication, CSRF protection, Argon2id password hashing, and MySQL-backed login throttling
- Owner-scoped portfolio and holding repositories and API workflows

The first authenticated portfolio and holdings workflows are implemented against the manually created schema.
