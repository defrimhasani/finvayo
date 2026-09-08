# Finvayo

Finvayo is a cash-flow decision tool for freelancers and small service businesses. This repository currently contains the product documentation and the first Cloudflare deployment baseline.

## Requirements

- Node.js 22 or later
- npm
- A Cloudflare account authenticated through Wrangler

## Local Development

```sh
npm install
npm run dev
```

Initialize the local D1 database, then run the site:

```sh
npx wrangler d1 migrations apply DB --local
npm run dev
```

The local site runs at `http://localhost:8787`. The deployment health endpoint is available at `/health`.

### Stripe Test Mode

Finvayo uses Stripe-hosted Checkout, so card details never pass through or persist in the Worker. Create a Stripe test-mode product with monthly and annual recurring prices, copy `.dev.vars.example` to `.dev.vars`, and set the four test values. Prefer a restricted `rk_test_` key with only the Stripe permissions the integration requires.

For deployed environments, configure them without committing values:

```sh
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put STRIPE_MONTHLY_PRICE_ID
npx wrangler secret put STRIPE_ANNUAL_PRICE_ID
```

Configure the Stripe test webhook endpoint as `https://finvayo.com/api/stripe/webhook` and subscribe it to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`. Use Stripe's test card `4242 4242 4242 4242` in Checkout with any future expiry and any CVC.

Workspace payments and expenses are planning records stored in D1 as integer minor units. Stripe subscription records contain Stripe identifiers and status only; Finvayo never stores payment-card data.

## Validation

```sh
npm run check
```

This runs strict TypeScript checks, Worker integration tests, and a Wrangler production dry run.

## Deployment

Password reset and onboarding messages use a Cloudflare Email Service binding named `EMAIL`. Before deployment, onboard `finvayo.com` in Cloudflare Email Service and verify `hello@finvayo.com` as an allowed sender.

Authenticate once, then deploy with Wrangler:

```sh
npx wrangler login
npm run deploy
```

The deployment applies pending production D1 migrations, deploys the `finvayo` Worker, and attaches the route at `https://finvayo.com`.

## Product Documentation

- [MVP product requirements](./PRD.md)
- [Day-zero-to-production plan](./DELIVERY_PLAN.md)
