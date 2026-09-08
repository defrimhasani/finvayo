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

The first deployment creates the `finvayo` Worker. Custom-domain routing is configured after the initial `workers.dev` deployment is verified.

## Product Documentation

- [MVP product requirements](./PRD.md)
- [Day-zero-to-production plan](./DELIVERY_PLAN.md)
