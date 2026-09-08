# Finvayo: Day-Zero-to-Production Delivery Plan

**Status:** Proposed implementation plan  
**Date:** 2026-09-08  
**Product source:** [PRD.md](./PRD.md)  
**Target:** Self-service paid launch on `finvayo.com`

---

## 1. Outcome

Ship a trustworthy, production-ready MVP that lets a freelancer or small service-business owner:

1. Create an account and workspace.
2. Enter current cash, reserves, expected income, and planned expenses.
3. Understand a transparent 90-day projection and safe-to-spend estimate.
4. Test a purchase without changing the live plan.
5. Prepare an overdue-invoice follow-up.
6. Complete a five-minute weekly review.
7. Start, manage, and cancel a paid subscription.
8. Export or delete their data.

The first release is self-service: any eligible visitor can create an account, start a 14-day trial, create a workspace, and subscribe without approval or founder intervention. Initial acquisition remains deliberately small so behavior and support can be observed across the first 20 to 30 users.

---

## 2. Decisions and Assumptions

### 2.1 Cloudflare Plan Assumption

The stated `$5` Cloudflare plan is assumed to be **Workers Paid**. This must be confirmed in the Cloudflare dashboard on day zero because Workers Paid is separate from a zone's Free, Pro, or Business website plan.

As of this document's date, Workers Paid includes enough capacity for the MVP:

- 10 million Worker requests per month
- 30 million CPU milliseconds per month
- Unlimited static-asset requests
- 25 billion D1 row reads and 50 million row writes per month
- 5 GB of included D1 storage
- Seven days of Workers Logs retention
- No Cloudflare bandwidth or D1 egress charge

The expected Cloudflare application cost at initial-launch scale is the existing `$5/month`, provided usage remains within the included quotas. Stripe fees, email delivery, domain registration, and required alerting/error monitoring are separate.

### 2.2 Product Architecture

Use a deliberately small architecture:

```text
Browser
  |
  v
finvayo.com / app.finvayo.com
  |
  v
Cloudflare Worker
  |-- static web assets
  |-- server-rendered pages and API routes
  |-- authentication and authorization
  |-- forecast calculation
  |-- Stripe Checkout, Portal, and webhooks
  |
  +--> Cloudflare D1
  +--> Cloudflare Turnstile verification
  +--> Transactional email provider
  +--> Stripe Billing
```

Use one deployable Worker application rather than separate frontend and API services. This minimizes operations, cross-origin configuration, secrets, and deployment failure modes.

### 2.3 Recommended Product Stack

The implementation phase may choose current compatible versions, but the intended shape is:

- **Runtime and hosting:** Cloudflare Workers with static assets
- **Application:** TypeScript and a Cloudflare-compatible full-stack web framework
- **Database:** Cloudflare D1 with SQL migrations
- **Authentication:** Passwordless email magic links with first-party sessions
- **Bot protection:** Cloudflare Turnstile on authentication and public forms
- **Billing:** Stripe Billing, Stripe-hosted Checkout, and Stripe Customer Portal
- **Transactional email:** An external provider with a Cloudflare Workers-compatible HTTP API
- **Source control:** Private GitHub repository
- **CI/CD:** GitHub Actions and Wrangler
- **Product analytics:** Minimal first-party events stored without financial values or client names
- **Operational errors:** Structured Workers Logs plus external synthetic/error alerting before the first paying customer

Do not add R2, KV, Durable Objects, Queues, Workflows, or an AI provider until a concrete use case requires them.

### 2.4 Domain Layout

- `finvayo.com`: marketing, pricing, privacy, terms, security, and sign-in entry
- `www.finvayo.com`: permanent redirect to `finvayo.com`
- `app.finvayo.com`: authenticated application and billing callbacks
- `staging.finvayo.com`: protected staging environment

The same Worker may route both the apex and `app` hostnames. The application must enforce the canonical hostname for each route to avoid duplicate content and cookie ambiguity.

### 2.5 Release Model

- `main` is always releasable.
- Pull requests run validation and may receive a preview Worker version URL protected by Cloudflare Access; forks and untrusted contributions never receive deployed previews or environment secrets.
- Merging to `main` deploys staging automatically.
- Production deployment is a manual GitHub Actions approval using an immutable, checksummed application bundle produced by CI from the exact tested commit.
- Production D1 migrations run as a separate gated step immediately before application promotion.
- Rollback means promoting the previous Worker version. Database migrations must therefore be backward-compatible.

---

## 3. Core Data and Calculation Decisions

### 3.1 Source of Truth for Cash

The latest user-confirmed cash balance is the authoritative snapshot and the forecast's starting point. A snapshot has a UTC timestamp and a workspace-local effective date. The forecast includes unpaid entries due on or after that local date and excludes completed entries.

Marking an invoice or expense paid records its actual amount, completion time, and status but never changes current cash. Because the saved balance may then be stale, Finvayo marks the forecast provisional and requires a new balance confirmation before showing a new safe-to-spend decision. The weekly review batches status updates and ends with balance confirmation. This avoids both silently mutating cash and double-counting transactions already reflected by the user's bank balance.

The MVP supports one owner and one workspace per verified user. Trial eligibility belongs to the verified user, so deleting and recreating a workspace does not grant another trial.

### 3.2 Money Representation

- Store money as integer minor units, such as cents, never floating-point values.
- Store one ISO 4217 currency code per workspace.
- Support USD, EUR, and GBP workspace currencies at launch and reject mixed-currency entries.
- Make workspace currency immutable after the first cash snapshot or entry; changing it requires deleting all monetary data and explicitly starting a new plan.
- Enforce a maximum absolute entry and aggregate value below JavaScript's safe-integer limit, with both application validation and database checks.
- Perform calculations server-side using deterministic functions.
- Return both the result and the contributing inputs so the UI can explain every number.

### 3.3 Dates and Time

- Store event dates as local calendar dates when time-of-day is irrelevant.
- Store audit timestamps in UTC.
- Store the workspace timezone explicitly.
- A monthly recurrence retains its preferred day; if that day does not exist, use that month's final day. Editing supports this occurrence or this and future occurrences; deleting supports the same choices. Generated occurrences retain history when completed.
- Define the horizon as 90 local calendar dates including the snapshot effective date: `[effective date, effective date + 90 days)`.

### 3.4 Forecast Policy

For each date in the 90-day half-open interval:

1. Start with the latest confirmed cash balance.
2. Apply included inflows on their expected dates.
3. Apply planned outflows on their due dates.
4. Calculate the required tax reserve and minimum buffer.
5. Calculate daily headroom.
6. Record the lowest gross balance, lowest headroom, and first reserve or buffer breach.

Default confidence rules:

- `paid`: historical only; do not project again
- `expected` or `invoiced`: included and clearly labelled projected
- `overdue`: shown separately and excluded from projected balance, risk state, safe-to-spend, and purchase scenarios
- `unlikely`: excluded
- user-excluded item: excluded

Canonical calculation for each date `d`:

```text
gross_cash(d) = confirmed_cash
              + included_inflows_through(d)
              - planned_outflows_through(d)

fixed mode:
tax_reserve(d) = configured_fixed_reserve

percentage mode:
tax_reserve(d) = current_tax_already_reserved
               + sum(included_future_inflow * tax_rate, through(d))

required_cash(d) = minimum_buffer + tax_reserve(d)
headroom(d) = gross_cash(d) - required_cash(d)
safe_to_spend = max(0, minimum(headroom(d) across the horizon))
```

Percentage reserve applies only to included future inflows when they enter the forecast. It does not infer tax from the opening cash snapshot. The user separately enters tax already reserved. Overdue, unlikely, excluded, and paid income adds no future tax reserve.

Risk uses the same named values:

- **At risk:** `gross_cash(d) < 0` on any date.
- **Caution:** gross cash stays non-negative, but `headroom(d) < 0` on any date.
- **Normal:** headroom remains non-negative throughout the horizon.

The calculation returns the limiting date, contributing entries, gross cash, tax reserve, buffer, and headroom. Planned outflows are subtracted exactly once in `gross_cash`; they are not also treated as reserves.

### 3.5 Minimum Data Model

| Entity | Purpose |
|---|---|
| `users` | Identity, verified email, status, timestamps |
| `sessions` | Hashed sessions, expiry, revocation, device metadata |
| `magic_links` | Single-use hashed authentication tokens and expiry |
| `workspaces` | Business, currency, timezone, buffer, tax settings |
| `memberships` | User-to-workspace authorization, initially owner only |
| `cash_snapshots` | Confirmed balance and effective timestamp |
| `cash_entries` | Inflows and outflows, status, amount, date, recurrence, client/category data |
| `follow_ups` | Overdue-invoice follow-up records and completion date |
| `subscriptions` | Local Stripe customer/subscription state and access period |
| `billing_events` | Stripe webhook ID, object timestamps, processing state, attempts, and sanitized error |
| `weekly_reviews` | Review completion and resulting summary |
| `audit_events` | Security and sensitive-data actions without raw financial payloads |
| `product_events` | Privacy-safe activation and retention events |

Every workspace-owned row must carry `workspace_id`; every query must scope by the authorized workspace. Add indexes for workspace, status, and dates used by forecast queries. Forecast inputs carry a revision number; writes use optimistic concurrency, and scenario conversion recalculates or asks for confirmation if that revision changed.

---

## 4. Subscription Design

### 4.1 Initial Offer

- One product: **Finvayo Launch Plan**
- Monthly price: `$9`
- Annual price: `$90`
- Trial: 14 days
- Payment method: not required to start the trial
- Trial starts when the workspace is created
- All MVP features are available during the trial
- No permanent free tier at launch
- Subscription billing currency is USD and is independent of the workspace's planning currency

Create separate Stripe test and live products and prices. Store Stripe price IDs as environment configuration, never hard-code price amounts into access-control logic.

### 4.2 Billing Flow

1. An eligible verified user creates their single Finvayo workspace; Finvayo starts an internal 14-day trial.
2. The app shows trial days remaining and a subscribe action.
3. Subscribe creates a server-side Stripe Checkout Session for monthly or annual pricing. Subscribing ends the internal trial and charges immediately; the exact USD amount, tax treatment, renewal interval, first charge date, cancellation timing, and refund terms are shown before redirecting to Stripe.
4. Stripe Checkout collects payment details and consent.
5. Stripe redirects to `app.finvayo.com/billing/return`.
6. The return page displays “confirming subscription” until a verified webhook updates local state.
7. Finvayo grants paid access based on local state derived from Stripe webhooks, not from URL parameters or the browser redirect.
8. “Manage subscription” creates a short-lived Stripe Customer Portal session.

### 4.3 Access States

| State | Product access |
|---|---|
| `trialing` | Full access until internal trial end |
| `trial_expired`, no subscription | Read-only; subscribe, export, and deletion remain available |
| `incomplete` | Read-only until the first invoice succeeds |
| `incomplete_expired` | Read-only; start a new Checkout flow |
| `active` | Full access |
| `past_due` | Full access during a configurable 7-day grace period with billing notice |
| `unpaid` or grace expired | Read-only; export, billing, and deletion remain available |
| `paused` | Read-only unless current paid-through date remains valid |
| `canceled`, period not ended | Full access through paid-through date |
| `canceled`, period ended | Read-only; export, billing, and deletion remain available |

Do not delete financial records because a subscription lapses. Data deletion is a separate explicit user action.

### 4.4 Webhook Requirements

Handle at minimum:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

For every webhook:

- Verify the Stripe signature against the raw request body.
- Store the event as `received`; atomically apply its local mutation and mark it `completed`, or mark it `failed` and leave it retryable. Only `completed` duplicates receive an immediate acknowledgement.
- Retrieve the authoritative Stripe subscription for every entitlement-affecting event instead of trusting webhook arrival order.
- Store Stripe object timestamps and reject stale projections.
- Log success or failure without storing payment method details.
- Return a successful response only for completed duplicates or successfully processed events.
- Support safe replay from Stripe's dashboard or CLI.
- Run a daily reconciliation of local non-terminal subscriptions against Stripe and alert on drift.

Enforce one Stripe customer and at most one billable subscription per workspace. Checkout creation uses an idempotency key and refuses a new session while a valid pending session or billable subscription exists. Persist `grace_started_at` from the first relevant failed-invoice timestamp; retries and duplicate events never reset it.

Stripe remains the source of truth for payment status; the local subscription row is the authorization projection used by the app.

### 4.5 Taxes, Receipts, Refunds, and Legal Setup

Before live billing:

- Create the Stripe account under the correct legal business or sole-proprietor identity.
- Complete identity and payout verification.
- Confirm the Stripe account can charge the launch plan's USD prices and decide the supported customer countries.
- Configure business name, statement descriptor, support email, receipt emails, and customer portal.
- Determine VAT/sales-tax obligations with a qualified adviser.
- Enable Stripe Tax only if the legal and commercial decision requires it.
- Publish Terms, Privacy Policy, Refund Policy, and contact details.
- Capture affirmative acceptance with timestamp and policy version where legally appropriate.
- Test monthly, annual, failed-payment, cancellation, refund, and webhook-replay paths.

For initial operations, a full discretionary refund cancels renewal but leaves access through the already recorded paid-through date unless law or fraud handling requires immediate suspension. A partial refund does not alter access. A dispute places the workspace in read-only mode pending review. Handle or reconcile refund and dispute events and document any manual override in the audit log.

Initial refund policy recommendation: provide a clear 14-day refund window for the first charge, subject to applicable consumer law, and process refunds manually in Stripe at launch.

---

## 5. Environment Design

| Concern | Local | Staging | Production |
|---|---|---|---|
| URL | local Wrangler URL | `staging.finvayo.com` | `finvayo.com`, `app.finvayo.com` |
| Database | Local D1 emulator | `finvayo-staging` D1 | `finvayo-production` D1 |
| Stripe | Test mode | Test mode | Live mode |
| Email | Captured/test recipient | Staging sending domain or allowlist | Verified production domain |
| Turnstile | Official test keys | Staging widget | Production widget |
| Secrets | Local uncommitted file | Cloudflare staging secrets | Cloudflare production secrets |
| Access | Developer machine | Cloudflare Access allowlist | Public, application auth required |
| Analytics | Disabled or marked local | Separate dataset/environment | Production dataset |

Never use production financial data in local or staging. Seed synthetic scenarios covering normal, caution, at-risk, overdue, recurring, and month-end behavior.

Before creating production D1, decide the launch jurisdictions, privacy roles, and required D1 jurisdiction. D1 jurisdiction is chosen at creation, so production provisioning follows that decision rather than preceding it.

---

## 6. Delivery Phases

The durations below assume one experienced full-time product engineer with periodic design and legal input. They are planning ranges, not commitments.

### Phase 0: Day Zero, Accounts and Safety Baseline

**Duration:** 0.5 to 1 day

#### Actions

- Confirm `finvayo.com` is active in the intended Cloudflare account and nameservers are correct.
- Confirm the account has Workers Paid, not only a paid website-zone plan.
- Enable multi-factor authentication for Cloudflare, GitHub, Stripe, domain registrar, and email provider.
- Store recovery codes in a password manager.
- Create a private GitHub repository with branch protection for `main`.
- Create narrowly scoped Cloudflare API tokens for CI; do not use the global API key.
- Set Cloudflare billing notifications and review available usage alerts.
- Reserve `finvayo` Worker names and create the staging D1 database. Create production D1 only after the launch-jurisdiction and data-residency decision.
- Create Stripe in test mode and choose a transactional email provider.
- Establish a support address such as `support@finvayo.com`.
- Document account ownership and recovery contacts.

#### Exit Criteria

- All critical accounts have MFA and recovery paths.
- The repository exists and no secrets are committed.
- Staging and production resources are clearly separated.
- Workers Paid entitlement is confirmed in the dashboard.

### Phase 1: Product Validation Before Full Build

**Duration:** 3 to 5 days, overlapping later setup where safe

#### Actions

- Recruit 12 to 15 target users using the criteria in the PRD.
- Run problem interviews with recent-behavior questions.
- Build a manual 90-day forecast prototype for five participants.
- Test the language “safe to spend,” the conservative treatment of overdue income, and willingness to complete a weekly review.
- Record the top three decisions participants need to make.
- Confirm at least five likely early users before implementing billing.

#### Exit Criteria

- At least eight participants report recurring cash-timing pain.
- At least five use a manual workaround.
- At least four of five concierge users understand the output without explanation.
- No evidence requires changing the initial customer or core promise.

If these criteria fail, revise the PRD before continuing with the full application.

### Phase 2: Repository and Cloudflare Foundation

**Duration:** 1 to 2 days

#### Actions

- Scaffold the TypeScript full-stack application for Cloudflare Workers.
- Add a Wrangler configuration with explicit `staging` and `production` environments.
- Bind each environment to its own D1 database.
- Configure static assets, compatibility date, CPU limit, and observability.
- Add formatting, linting, type checking, unit tests, and build scripts.
- Add `.env.example` containing names only, never secret values.
- Add migration and seed directories.
- Add structured JSON logging with request/correlation IDs.
- Add a health route that verifies application execution without exposing sensitive internals.
- Create a minimal marketing page and deploy it to staging.

#### Exit Criteria

- A fresh checkout can install, validate, test, and run locally from documented commands.
- Staging deploys from CI and can query only staging D1.
- Production configuration exists but production traffic remains disabled.
- Logs contain environment, release identifier, route, status, duration, and correlation ID.

### Phase 3: Identity, Sessions, and Workspace Isolation

**Duration:** 3 to 4 days

#### Actions

- Implement passwordless sign-up and sign-in by emailed magic link.
- Hash magic-link and session tokens at rest.
- Make links single-use, short-lived, and redirect only to an allowlisted internal path.
- Keep magic-link secrets out of request URLs recorded by Cloudflare: deliver the token in the URL fragment and exchange it through a same-origin POST under a strict CSP, or disable invocation logging for a dedicated verification route. Verify actual production log records before launch.
- Set cookies `Secure`, `HttpOnly`, `SameSite=Lax`, with host-scoped production names.
- Rotate the session identifier on authentication and revoke it on sign-out.
- Add CSRF protection to all state-changing browser requests.
- Add Turnstile to magic-link requests and validate tokens server-side.
- Rate-limit email requests by IP and normalized email without revealing whether an account exists.
- Create workspace onboarding and owner membership.
- Implement centralized authorization that scopes every workspace query.
- Add audit events for login, logout, export, deletion, and billing changes.

#### Exit Criteria

- Authentication tests cover expiry, replay, invalid token, sign-out, and session rotation.
- An automated authorization test proves one workspace cannot read or mutate another.
- Turnstile uses separate non-production and production keys.
- Logs and analytics contain no magic links, session tokens, or full financial payloads.

### Phase 4: Financial Domain and Forecast Engine

**Duration:** 4 to 6 days

#### Actions

- Create migrations for workspaces, cash snapshots, entries, recurrences, and weekly reviews.
- Implement guided setup for currency, timezone, cash, buffer, and tax reserve.
- Implement income and expense create, edit, complete, exclude, and delete actions.
- Implement monthly recurrence and the 90-day expansion rule.
- Build the forecast as a pure deterministic domain function independent of the UI and database.
- Return an explanation object containing the lowest point, breach date, reserves, and limiting entries.
- Implement risk states and conservative overdue-income handling.
- Add a temporary purchase scenario that never persists unless confirmed.
- Add property and boundary tests for money, dates, recurrences, empty data, and negative projections.

#### Exit Criteria

- Unit tests cover all PRD forecast and risk rules.
- The same inputs always return the same projection.
- Monetary arithmetic uses integer minor units end to end.
- No scenario mutates live data before explicit confirmation.
- Product, engineering, and a pilot user can explain the safe-to-spend result from displayed inputs.

### Phase 5: Core Experience and Weekly Loop

**Duration:** 4 to 6 days

#### Actions

- Build the home screen in the PRD's priority order.
- Add a text explanation alongside every chart.
- Implement first-run setup, empty states, validation, and recovery from errors.
- Implement the weekly review and “last reviewed” state.
- Select one deterministic next action based on severity and timing.
- Implement invoice follow-up templates using fixed product copy, not an AI provider.
- Allow editing and copying; never send automatically.
- Add responsive mobile layouts and keyboard support.
- Instrument activation, forecast viewed, weekly review completed, scenario run, and follow-up copied.
- Ensure event payloads contain identifiers and categories only, not amounts, balances, client names, or message text.

#### Exit Criteria

- A new user reaches a useful forecast in under 10 minutes in moderated testing.
- A returning user completes review in under five minutes.
- Core journeys work at small mobile and desktop widths.
- Risk status is understandable without color.
- Keyboard navigation and screen-reader labels cover all core actions.

### Phase 6: Billing and Entitlements

**Duration:** 3 to 4 days

#### Actions

- Create Stripe test product and monthly/annual prices.
- Add the internal 14-day trial at workspace creation.
- Implement server-created Stripe Checkout Sessions.
- Implement the Stripe Customer Portal.
- Implement signature-verified, idempotent webhook processing.
- Add subscription state and paid-through dates to the workspace.
- Enforce entitlements server-side, not only by hiding UI controls.
- Implement the seven-day `past_due` grace period and read-only expired state.
- Keep export, billing management, and account deletion available in read-only state.
- Add trial and billing-status notices without obstructing the core value experience.
- Run Stripe test-clock or equivalent lifecycle tests.

#### Exit Criteria

- Monthly and annual test purchases activate access only after webhook confirmation.
- Duplicate and out-of-order webhooks do not corrupt state.
- Failed payment, cancellation, period end, and reactivation behave as documented.
- No card details enter Finvayo's application or logs.
- Any complimentary access is an explicit audited entitlement with issuer, reason, start/end dates, precedence over billing state, and revocation behavior. It is not required for ordinary registration.

### Phase 7: Privacy, Data Control, and Operational Readiness

**Duration:** 3 to 5 days

#### Actions

- Implement export in a portable machine-readable format and a human-readable summary.
- Implement deletion with a confirmation step, recent-authentication check, and documented delay.
- On deletion, first cancel Stripe auto-renewal, confirm the Stripe result, retain the minimum billing linkage needed for refunds and webhook idempotency, revoke sessions, then delete product data. Test active, past-due, canceled, and webhook-after-deletion cases.
- Define workspace deletion and user-account deletion separately; in the one-workspace launch model, account deletion performs both.
- Create a retention matrix covering product data, client/invoice data, authentication, billing, audit, analytics, inactive workspaces, and backups, including purpose, legal basis, duration, deletion method, and restore-time erasure handling.
- Define Finvayo's controller/processor role, supported jurisdictions, subprocessors, international transfers, data-subject request process, complaint route, and treatment of client data entered by users before collecting real data.
- Publish Privacy Policy, Terms, Refund Policy, cookie disclosure, and security contact.
- Add security headers: CSP, HSTS after hostname validation, frame restrictions, referrer policy, and content-type protection.
- Set `Cache-Control: no-store, private` on authenticated, financial, export, billing, and magic-link responses, including errors; never use the Cache API for those routes.
- Apply request-body size limits, schema validation, and output encoding.
- Configure SPF, DKIM, and DMARC for the sending domain.
- Define RPO and RTO, use D1 Time Travel/bookmarks for non-blocking point-in-time recovery, and test restoration into a non-production database. Use independent SQL exports only in a planned maintenance window if provider-independent retention is required.
- Create runbooks for bad deployment, failed migration, authentication outage, Stripe webhook backlog, email outage, suspected data exposure, and account recovery.
- Create a support workflow and response templates for billing and data requests.
- Configure external synthetic/error alert delivery and test every critical alert before accepting payment.

#### Exit Criteria

- An export can be opened and understood.
- A deletion rehearsal removes product data and revokes access as promised.
- A database restore rehearsal succeeds in a non-production environment.
- Security headers pass inspection without breaking checkout, email links, or the app.
- Legal pages are linked from sign-up, checkout context, and the site footer.

### Phase 8: CI/CD and Production Provisioning

**Duration:** 2 to 3 days

#### Pull Request Pipeline

Run on every pull request:

1. Install from the lockfile.
2. Check formatting and lint rules.
3. Run type checking.
4. Run unit and forecast property tests.
5. Run integration tests against local D1 migrations.
6. Build the Worker.
7. Scan dependencies and repository content for known vulnerabilities and secrets.
8. For trusted branches only, upload a preview Worker version protected by Cloudflare Access and host allowlisting; use synthetic preview data and never production bindings.
9. Run smoke tests against the preview.

Do not expose production secrets to pull requests or preview builds.

#### Staging Pipeline

On merge to `main`:

1. Repeat all validation.
2. Apply pending migrations to staging D1.
3. Deploy to the staging Worker.
4. Run browser smoke tests for login, onboarding, forecast, scenario, and Stripe test Checkout creation.
5. Record the deployed Git commit and Worker version.

#### Production Pipeline

On manually approved release:

1. Confirm staging tests passed against the checksummed bundle that will be promoted; pin runtime and deployment-tool versions.
2. Record a pre-migration D1 Time Travel bookmark and verify the recovery window.
3. Run backward-compatible production migrations.
4. Upload the verified immutable bundle with production bindings without routing traffic to it.
5. Run version-preview smoke tests where bindings permit.
6. Check post-migration invariants, then gradually promote the version or release first to internal test accounts.
7. Run synthetic checks for the landing page, authentication request, app shell, health route, and billing endpoint.
8. Observe errors, latency, authentication, and webhooks for at least 30 minutes.
9. Record the release version and outcome.

#### Migration Rules

- Never combine destructive schema changes with code that still depends on the old schema.
- Use expand-and-contract migrations: add, backfill, switch code, then remove in a later release.
- Do not make rollback depend on reversing a destructive migration.
- Make every migration versioned and reviewable.
- Test migrations from a production-like schema, not only from an empty database.

#### Exit Criteria

- A non-author can approve production through a protected GitHub environment, or the solo-founder exception is documented.
- Production can be rolled back to the previous Worker version in a rehearsal.
- Code rollback, Time Travel recovery decision points, and database restore procedures are tested.
- Secrets exist only in environment-specific secret stores.

### Phase 9: Pre-Launch QA and Self-Service Rollout

**Duration:** 3 to 5 days

#### Actions

- Run end-to-end tests for every release criterion in the PRD.
- Test Safari, Chrome, Firefox, iOS Safari, and Android Chrome at current versions.
- Test keyboard-only operation, text scaling, reduced motion, and screen-reader summaries.
- Test realistic data sets with zero, large, overdue, recurring, month-end, and negative-cash cases.
- Conduct an authorization and webhook threat review.
- Verify analytics events against the privacy rules.
- Open registration to five pilot users first without manually approving individual accounts; observe setup and their first weekly return.
- Resolve calculation, trust, access, and data-loss defects before expanding.
- Increase acquisition gradually until 20 to 30 users have registered through the same self-service flow.
- Enable paid conversion only after live Stripe and legal readiness are complete.
- Create canonical forecast fixtures with exact expected balances, reserves, risk states, and safe-to-spend values for release sign-off.

#### Exit Criteria

- Five users complete a forecast with realistic data.
- No unresolved severity-one or severity-two defects exist.
- Calculation discrepancies have zero known instances.
- Support, incident, backup, and rollback ownership are clear.
- Stripe live-mode purchase, cancellation, failed payment, and refund have been rehearsed with low-value or controlled transactions.

### Phase 10: Production Launch and First 30 Days

**Duration:** Ongoing

#### Launch Day

- Freeze non-essential changes.
- Verify DNS, TLS, canonical redirects, email authentication, and status of external providers.
- Deploy the approved release.
- Complete one real signup, magic-link login, forecast, monthly purchase, portal visit, cancellation, and refund path.
- Watch alerts, logs, Stripe webhook deliveries, and canary error rates continuously during the initial launch window.
- Contact the first cohort directly with onboarding and support expectations.

#### Days 1-7

- Review errors and support every day.
- Check D1 rows read/written, Worker requests, CPU, email delivery, Turnstile outcomes, and webhook failures.
- Interview users who abandon setup.
- Fix calculation, data integrity, and access defects ahead of cosmetic work.
- Confirm every production deployment has a release record and rollback target.

#### Days 8-30

- Measure activation, second weekly review, four-review retention, scenario use, follow-up use, and trial conversion.
- Interview retained users and users who churn or fail to return.
- Compare actual Cloudflare and vendor costs with the budget.
- Review support categories and confusing calculation explanations.
- Decide whether to improve the manual weekly loop, alter positioning, or add the first integration.
- Do not begin public acquisition until repeat weekly behavior is credible.

---

## 7. Security and Privacy Checklist

### Application

- Validate all input on the server with explicit schemas.
- Authorize every operation against `workspace_id`.
- Use parameterized SQL exclusively.
- Apply CSRF protection to state-changing browser requests.
- Escape user-entered client names, references, and message content.
- Rate-limit authentication, export, deletion, and billing session creation.
- Never trust subscription state supplied by the browser.
- Keep webhook endpoints signature-verified and idempotent.
- Apply `Cache-Control: no-store, private` and prohibit Cache API use for personalized and financial responses.

### Secrets

- Store production secrets with Wrangler/Cloudflare secret bindings.
- Keep staging and production Stripe, Turnstile, email, and session secrets separate.
- Rotate exposed or former-team-member credentials immediately.
- Never log authorization headers, cookies, magic links, webhook signatures, or API keys.

### Data

- Collect no bank credentials, card details, or government IDs.
- Store money as minor-unit integers.
- Minimize free-text fields and never include them in analytics.
- Encrypt transport through Cloudflare-managed TLS.
- Define deletion and backup-retention windows in the published policy.
- Restrict D1 and backup access to production operators.

### Cloudflare

- Keep DNS records proxied where appropriate.
- Use Full (strict) TLS behavior for any applicable origin connection; this Worker-native architecture has no separate origin.
- Add Turnstile hostname restrictions.
- Set a Worker CPU limit to reduce denial-of-wallet risk.
- Review security analytics and suspicious traffic before adding broad blocking rules.
- Protect `staging.finvayo.com` with Cloudflare Access.
- Protect Worker preview URLs with Access and host allowlisting, and disable unnecessary `workers.dev` routes.

---

## 8. Observability and Alerts

### Required Signals

- HTTP error rate by route and release
- Worker execution latency and CPU time
- D1 query failures and rows scanned
- Authentication email request and delivery failures
- Magic-link verification failures without logging tokens
- Forecast calculation exceptions
- Stripe webhook failures and oldest unprocessed event
- Checkout and portal session creation failures
- Trial expirations and entitlement transitions
- Backup success and latest tested restore date

### Initial Alert Policy

Alert the founder immediately when:

- Health or login synthetic checks fail repeatedly.
- Error rate exceeds 2% for five minutes.
- Any forecast calculation throws or returns an invariant violation.
- Stripe webhook processing fails repeatedly or remains unresolved for 15 minutes.
- Production migration or backup fails.
- Cloudflare usage unexpectedly accelerates toward paid overage.

Workers Logs retain seven days on Workers Paid, so external synthetic/error alerting is mandatory before accepting payment. Billing failures also create durable, sanitized operational records. Alert destinations and escalation behavior must be tested end to end.

---

## 9. Testing Strategy

### Unit Tests

- Forecast arithmetic and explanation output
- Tax reserve modes
- Risk states and safe-to-spend floor
- Overdue and excluded inflows
- Monthly recurrence and month-end behavior
- Subscription access-state transitions
- Next-action prioritization

### Property and Boundary Tests

- Safe-to-spend is never negative.
- Adding an included expense cannot increase safe-to-spend.
- Removing an included inflow cannot increase safe-to-spend.
- A temporary scenario cannot mutate persisted entries.
- Duplicate webhook events produce one state transition.
- Failed webhook processing remains retryable, and stale events cannot overwrite newer Stripe state.
- Amounts remain exact at supported limits.

### Integration Tests

- D1 migrations from every supported schema version
- Workspace authorization and query scoping
- Session creation, expiry, rotation, and revocation
- Stripe signature verification and webhook ordering
- Export and deletion
- Turnstile server-side validation

### End-to-End Tests

- Sign up through first forecast
- Returning weekly review
- Create, edit, complete, and exclude entries
- Run and convert a purchase scenario
- Prepare and record an invoice follow-up
- Subscribe monthly and annually
- Manage, cancel, fail, and restore a subscription
- Export and delete a workspace
- Delete an actively subscribed account without any later renewal

Automate the stable critical paths. Keep a concise manual release checklist for external-provider and accessibility behavior that automation cannot confidently cover.

---

## 10. Initial Cost Envelope

| Service | Expected launch cost | Notes |
|---|---:|---|
| Cloudflare Workers Paid | `$5/month` | Existing plan if confirmed; included usage should cover initial launch |
| D1 | `$0 incremental` | Expected within Workers Paid inclusion |
| Static assets and bandwidth | `$0 incremental` | Static requests and egress included under current pricing |
| Turnstile | `$0 expected` | Protect authentication and public forms |
| Stripe | Transaction fees | No card data handled by Finvayo; exact rate depends on account/country |
| Transactional email | `$0-$20/month` | Depends on provider and volume |
| Error monitoring | `$0-$30/month` | Required before accepting payment; a free tier may be sufficient |
| Domain | Existing renewal | Keep registrar lock and auto-renew enabled |

Set a practical operating alert at `$20` of unexpected Cloudflare overage and review usage weekly. Avoid treating the included quotas as a substitute for indexed queries and request limits.

---

## 11. Definition of Production-Ready

Finvayo is production-ready for a self-service paid launch only when all of the following are true:

- Product validation gates in the PRD have been met or consciously waived with evidence.
- Users can complete every core journey on desktop and mobile.
- Safe-to-spend is deterministic, tested, and explainable.
- Workspace isolation has automated negative tests.
- Subscription access depends on verified Stripe state.
- Deleting an account prevents future subscription renewal and preserves only disclosed legally required records.
- Data export, deletion, backup, and restore have been rehearsed.
- Staging and production use separate databases, credentials, Stripe modes, and Turnstile widgets.
- Production deploy and rollback have both been rehearsed.
- Security, privacy, refund, and support pages are live.
- Logs and analytics do not expose financial content or authentication secrets.
- Critical operational alerts have been received successfully in an end-to-end test.
- The founder can follow incident runbooks without relying on undocumented memory.
- Five pilot users have completed realistic forecasts without a critical issue.

---

## 12. Deferred Until Evidence Supports It

- Bank and accounting connections
- Automatic reconciliation
- AI-generated financial recommendations
- Automatic invoice email sending
- Team collaboration and role complexity
- Multiple currencies per workspace
- Native mobile applications
- Separate microservices
- Queues and background workflows
- Durable Objects or real-time synchronization
- A data warehouse or broad third-party analytics capture

The first post-MVP investment should remove the largest observed barrier to the weekly review, not expand the feature list by default.

---

## 13. Suggested Milestone Schedule

| Week | Milestone |
|---|---|
| 1 | Account hardening, interviews, concierge test, repository and staging foundation |
| 2 | Authentication, workspace isolation, setup, and data model |
| 3 | Forecast engine, entries, scenarios, and calculation tests |
| 4 | Dashboard, weekly review, follow-up workflow, responsive and accessible UX |
| 5 | Stripe billing, entitlements, privacy controls, backups, and operational runbooks |
| 6 | CI/CD hardening, cross-browser QA, pilot cohort, production rehearsal, self-service launch |

If validation or calculation trust is weak, extend the schedule rather than launching around those problems.

---

## 14. Immediate Next Actions

1. Confirm in Cloudflare that the active `$5` subscription is **Workers Paid**.
2. Complete five customer interviews before locking the forecast language.
3. Create the private GitHub repository and secure all operator accounts with MFA.
4. Select the full-stack framework and transactional email provider within the constraints above.
5. Provision staging D1 and a protected staging hostname; provision production D1 after documenting launch jurisdiction and residency requirements.
6. Implement the forecast engine and its invariant tests before polishing the dashboard.
7. Keep Stripe in test mode until legal pages, lifecycle tests, export, deletion, backup, and rollback are complete.

---

## 15. Reference Documentation

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Turnstile setup](https://developers.cloudflare.com/turnstile/get-started/)
- [Stripe subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions)

Cloudflare limits and pricing change. Recheck the linked official documentation during provisioning and before public launch.
