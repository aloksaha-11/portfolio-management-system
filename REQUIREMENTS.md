# MVP Requirements: Portfolio and Holdings

**Status:** Draft with initial decisions incorporated  
**Scope:** A user creates a portfolio, records investments in it, and views the current holdings.

## Goal

Let a user keep a simple record of what they own in each investment portfolio. The application organizes positions and uses the latest available BSE end-of-day close to estimate market value; it does not provide investment advice or intraday prices.

## Confirmed decisions

- Account registration and authentication are part of the first milestone.
- INR is the only supported currency in the initial release. Portfolios use INR; users do not choose a currency when creating one.
- Holdings are maintained directly as current positions. Buy/sell transaction history is outside this first flow.
- The relational database is MySQL. Migration tooling is not required for this milestone; schema setup will be handled without migrations.
- A portfolio may be deleted only after its holdings have been deleted.

## Selected implementation defaults

- Use email address as the account identifier. Trim it, normalize it to lowercase, and enforce uniqueness in MySQL.
- Use Spring Security with Spring Framework for authentication and authorization, without Spring Boot. Passwords must be at least 8 characters and are stored with Argon2id and a unique salt; never store plain-text passwords.
- Use server-side HTTP sessions with session ID rotation after login, `HttpOnly` and `Secure` cookies in production, `SameSite=Lax`, idle expiry, and CSRF protection for state-changing requests.
- Use MySQL 8.4 LTS with InnoDB tables, foreign keys, primary keys, and unique constraints.
- Keep an initial schema script at `src/main/resources/db/schema.sql`; an operator applies it manually. The application does not run migrations or modify the schema automatically.
- Use the trimmed, Unicode-normalized, case-insensitive investment name as the duplicate identity within a portfolio. The optional ticker/reference code is descriptive metadata. Store the normalized identity in a dedicated column and enforce a unique constraint on `(portfolio_id, normalized_investment_name)` in addition to each row's primary key.
- Enforce portfolio deletion order in both the application and MySQL: delete holdings first and use a restrictive foreign key so a portfolio with holdings cannot be deleted.
- Throttle login failures using both a per-account counter and a per-IP burst limit. Do not permanently lock accounts.

Investment names and optional ticker/reference codes are entered by the user. There is no external instrument catalogue or market-data integration in this milestone.

## User and access

- A user can register an account, sign in, and sign out.
- A signed-in user can create and view their portfolios.
- A user cannot view or change another user's portfolios or holdings.
- Passwords must be stored using a one-way password hashing algorithm; plain-text passwords must never be stored.
- Portfolio and holding operations are available only to an authenticated owner.
- Registration uses an email address and password. The system rejects malformed or already-registered email addresses with a useful validation error.
- Authentication uses Spring Security configured for the existing Spring MVC application; no Spring Boot dependency is introduced.
- Registration rejects passwords shorter than 8 characters.
- BSE end-of-day equity closing prices are imported from the exchange's final daily Bhav Copy and stored for historical lookup. No broker account or paid real-time feed is required for this daily data.
- Passwords are hashed with Argon2id and a unique salt. Passwords are never logged or returned by the API.
- Authenticated browser sessions use server-side sessions. Login rotates the session ID; logout invalidates the session. State-changing requests require CSRF protection.
- Count failed logins by normalized email, including attempts for email addresses that are not registered, so the response does not reveal whether an account exists. After 5 failures for an email within 15 minutes, increase the wait before each further attempt exponentially from 1 second, capped at 30 seconds. A successful login resets that email's failure counter.
- Temporarily block an IP address for 15 minutes after 60 failed login attempts from that address within 15 minutes. Apply this limit using only the direct client address or forwarding headers from explicitly trusted proxies.
- Store throttling counters in MySQL so an application restart does not clear them. Return the same generic login failure message for unknown email and incorrect password; do not log passwords.

## Functional requirements

### 1. Create a portfolio

- The user can create a portfolio with a required name. Its currency is INR.
- The name is trimmed and must contain at least one non-whitespace character.
- The system assigns a unique identifier and records creation time.
- The newly created portfolio starts with no holdings.
- The user can see a clear validation error if required fields are missing or invalid.

### 2. Add an investment holding

- The user can add a holding to one of their portfolios with:
  - required investment name;
  - optional ticker or reference code;
  - required units owned, greater than zero;
  - required average purchase price per unit, zero or greater, in the portfolio's base currency.
- The system records the holding under the selected portfolio and assigns it a unique identifier.
- The user can add more than one holding to a portfolio.
- Every holding has a primary key, and a MySQL unique constraint on `(portfolio_id, normalized_investment_name)` rejects duplicate investments within a portfolio. The application trims, Unicode-normalizes, and case-folds the name before storing the identity. The ticker/reference code remains optional metadata and does not define identity.
- Adding an investment already held in the portfolio is rejected with a useful error; the user can edit the existing holding instead.
- A holding cannot be added to a portfolio the user does not own.

### 3. View portfolio holdings

- The user can view a list of their portfolios.
- The user can open a portfolio and see its name, INR currency, and holdings.
- Each holding displays its investment name, ticker/reference code when present, units owned, average purchase price, and cost basis.
- Cost basis is calculated as units owned multiplied by average purchase price and displayed in INR.
- An empty portfolio displays a helpful message and an action to add the first holding.
- The API returns a stable, documented response shape and appropriate HTTP status codes for success, invalid input, missing resources, and unauthenticated/unauthorized access.

### 4. Import and display BSE end-of-day prices

- Import the final BSE equity Bhav Copy after market close on weekdays, retry once later in the evening, and attempt to catch up after application startup.
- Keep one daily row per BSE security code and series; re-importing a date updates existing rows instead of duplicating them.
- Match holdings to prices by the optional ticker field, which accepts a BSE ticker symbol or BSE security code.
- Show the latest available BSE close, its trade date, and the resulting estimated market value (`units_owned × close_price`) in the dashboard.
- Preserve cost basis separately. A holding with no matching BSE symbol/code must show that its price is unavailable rather than substituting a different instrument.
- Market prices are shared exchange data. They are not owned by a portfolio or account.

## Data and validation rules

- Monetary values use decimal arithmetic, never binary floating-point arithmetic.
- Units and prices must not be negative; units must be greater than zero.
- Currency values use the ISO 4217 code `INR`.
- Portfolio and holding identifiers are unique and are not derived from user-provided names.
- Portfolio and holding records include creation and last-updated timestamps.
- A portfolio can be deleted only after its holdings have been deleted. The application must reject portfolio deletion while holdings remain, and the MySQL foreign key must also prevent it.

## Acceptance criteria

1. A registered, authenticated user can create a named INR portfolio and then find it in their portfolio list.
2. A portfolio cannot be created with a blank name.
3. A user can add a valid holding and see it when opening that portfolio.
4. The displayed cost basis equals units multiplied by average purchase price, rounded according to INR's minor-unit precision.
5. An empty portfolio is distinguishable from a loading or error state and offers an add-holding action.
6. Invalid units, invalid prices, unauthenticated access, and attempts to access another user's data are rejected with appropriate errors.
7. Restarting the application does not lose saved portfolios or holdings.
8. A portfolio cannot be deleted while it still has holdings; deleting its holdings first allows the portfolio to be deleted.

## Out of scope for this milestone

- Intraday/live prices, automated BSE symbol discovery, or foreign-exchange conversion.
- Buy/sell transaction ledger, realized/unrealized gains, dividends, or tax reporting.
- Investment recommendations, trading, brokerage connections, or performance comparisons.
- Shared portfolios, multiple user roles, or organization-level access.
- Import/export and notifications.

## Notes before implementation

- Password recovery uses a one-time, expiring email link, stores only a token hash, avoids revealing whether an account exists, and invalidates previous sessions after a successful reset.
- The initial throttling thresholds are reviewed and approved for the MVP. Keep the per-account delay and temporary IP limit configurable so they can be tuned after deployment.
