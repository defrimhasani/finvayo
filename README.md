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

## Validation

```sh
npm run check
```

This runs strict TypeScript checks, Worker integration tests, and a Wrangler production dry run.

## Deployment

Authenticate once, then deploy with Wrangler:

```sh
npx wrangler login
npm run deploy
```

The deployment applies pending production D1 migrations, deploys the `finvayo` Worker, and attaches the route at `https://finvayo.com`.

## Product Documentation

- [MVP product requirements](./PRD.md)
- [Day-zero-to-production plan](./DELIVERY_PLAN.md)
