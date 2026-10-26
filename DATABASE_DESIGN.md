# Database Design: Portfolio MVP

**Status:** Draft for review  
**Database:** MySQL 8.4 LTS with InnoDB  
**Character set:** `utf8mb4`  
**Time convention:** Store and compare timestamps in UTC.

This design translates the current MVP requirements into tables and constraints. It is a design document, not the executable schema. The manually applied `src/main/resources/db/schema.sql` will be prepared after this design is reviewed.

## Relationship overview

```text
users 1 ─── * portfolios 1 ─── * holdings
  │
  └── login_throttle (independent account/IP throttling buckets)
```

## `users`

Stores registered accounts. Email is the login identifier; passwords are stored only as Argon2id hashes.

| Column | Proposed type | Rules |
|---|---|---|
| `user_id` | `BIGINT` | Primary key, auto-increment |
| `email` | `VARCHAR(254)` | Required; trimmed and normalized by the application |
| `password_hash` | `VARCHAR(255)` | Required; Argon2id encoded hash, never a raw password |
| `created_at` | `TIMESTAMP(6)` | Required, UTC |
| `updated_at` | `TIMESTAMP(6)` | Required, UTC |

Constraints and indexes:

- Primary key on `user_id`.
- Unique constraint on normalized `email` so case variants cannot register separate accounts.

## `portfolios`

Stores portfolios owned by one user. The first release supports INR only.

| Column | Proposed type | Rules |
|---|---|---|
| `portfolio_id` | `BIGINT` | Primary key, auto-increment |
| `user_id` | `BIGINT` | Required; foreign key to `users.user_id` |
| `name` | `VARCHAR(100)` | Required; trimmed, non-blank |
| `currency` | `CHAR(3)` | Required; defaults to `INR`, check constraint permits only `INR` |
| `created_at` | `TIMESTAMP(6)` | Required, UTC |
| `updated_at` | `TIMESTAMP(6)` | Required, UTC |

Constraints and indexes:

- Primary key on `portfolio_id`.
- Foreign key from `user_id` to `users.user_id`.
- Index on `(user_id, created_at)` for listing a user's portfolios.
- Portfolio names are not unique per user in this draft; users may create two portfolios with the same name unless that rule is added later.

## `holdings`

Stores the current position for an investment in a portfolio. It does not store a transaction ledger or live market price.

| Column | Proposed type | Rules |
|---|---|---|
| `holding_id` | `BIGINT` | Primary key, auto-increment |
| `portfolio_id` | `BIGINT` | Required; foreign key to `portfolios.portfolio_id` |
| `investment_name` | `VARCHAR(255)` | Required; display form entered by the user |
| `normalized_investment_name` | `VARCHAR(255)` | Required; trim, Unicode NFC normalize, and case-fold in the application |
| `ticker` | `VARCHAR(32)` | Optional descriptive reference |
| `units_owned` | `DECIMAL(24,8)` | Required; greater than zero |
| `average_purchase_price` | `DECIMAL(19,4)` | Required; INR per unit, zero or greater |
| `created_at` | `TIMESTAMP(6)` | Required, UTC |
| `updated_at` | `TIMESTAMP(6)` | Required, UTC |

Constraints and indexes:

- Primary key on `holding_id`.
- Foreign key from `portfolio_id` to `portfolios.portfolio_id` with `ON DELETE RESTRICT`.
- Unique constraint on `(portfolio_id, normalized_investment_name)` to prevent duplicate investment names inside one portfolio.
- Index on `portfolio_id` for loading a portfolio's holdings.
- Check constraints require `units_owned > 0` and `average_purchase_price >= 0`.
- Cost basis is calculated as units multiplied by average purchase price; it is not stored separately, avoiding stale derived values.

The application computes `normalized_investment_name`; MySQL stores it and enforces uniqueness. The display name remains unchanged apart from trimming. Ticker is not part of duplicate identity because it is optional.

## `login_throttle`

Stores persistent account and IP failure buckets so a process restart cannot reset throttling. The same table shape supports both bucket types.

| Column | Proposed type | Rules |
|---|---|---|
| `throttle_id` | `BIGINT` | Primary key, auto-increment |
| `bucket_type` | `ENUM('ACCOUNT','IP')` | Required |
| `bucket_key_hash` | `BINARY(32)` | Required; HMAC-SHA-256 of normalized email or trusted client IP, keyed with an application secret outside MySQL |
| `failure_count` | `INT UNSIGNED` | Required; failures in the current 15-minute window |
| `window_started_at` | `TIMESTAMP(6)` | Required, UTC |
| `delay_until` | `TIMESTAMP(6)` | Optional; next permitted account attempt after exponential delay |
| `blocked_until` | `TIMESTAMP(6)` | Optional; temporary IP block expiry |
| `updated_at` | `TIMESTAMP(6)` | Required, UTC |

Constraints and indexes:

- Primary key on `throttle_id`.
- Unique constraint on `(bucket_type, bucket_key_hash)` so each account or IP has one active bucket.
- Expired inactive bucket rows may be periodically deleted after 30 days.

Behavior encoded by the application around this table:

- Account buckets count failures by normalized email, including unknown emails. From the sixth failed attempt in a 15-minute window, apply a delay starting at one second and doubling on subsequent failures, capped at 30 seconds. Reset the account bucket after a successful login.
- IP buckets count failed attempts within 15 minutes. At 60 failures, set `blocked_until` to 15 minutes after the threshold is reached.
- Use a generic login failure response so callers cannot determine whether an email is registered.
- Resolve client IP from the direct connection unless the request came through a configured trusted proxy; do not trust arbitrary forwarded headers.

## Deletion behavior

- Delete holdings first, then delete their portfolio. The `RESTRICT` foreign key is the final database safeguard if application code attempts the wrong order.
- Deleting a user with portfolios should also be restricted in this MVP until an explicit account-deletion flow is defined.

## Open implementation details

- Use application-side transactions for operations that update portfolio data and related records.
- Verify that MySQL enforces the selected `CHECK` constraints in the deployed MySQL version.
- Select one consistent email normalization rule and use it for both registration uniqueness and login throttling.
- Keep the HMAC secret outside the database and application source code.
