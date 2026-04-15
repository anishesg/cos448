# Linq (iMessage) integration

## Service module

Runtime API calls go through **`webapp/src/lib/linq-service.ts`** (`LinqService`, `getLinqService()`, `readLinqEnv()`).  
`webapp/src/lib/linq.ts` re-exports the same surface for older imports.

## Environment (local)

Add these to **`webapp/.env.local`** (Next.js loads env from the `webapp/` directory when you run `npm run dev` there):

| Variable | Required | Description |
|----------|----------|-------------|
| `LINQ_API_TOKEN` | yes | Bearer token from the Linq dashboard |
| `LINQ_FROM_NUMBER` | yes | Your Linq virtual number, E.164, e.g. `+12052402169` |
| `LINQ_DEFAULT_TO_NUMBER` | no | Default recipient for quick tests |
| `LINQ_API_BASE_URL` | no | Default `https://api.linqapp.com/api/partner/v3` |

## Production / SST

Add the same variables to your deploy target (SST `environment` on `Nextjs`, Vercel project env, etc.).  
If you prefer SST Secrets, add a `new sst.Secret("LinqApiToken")` and map it to `LINQ_API_TOKEN` in `sst.config.ts` once every stage has the secret set.

## API routes (session required)

- `GET /api/linq/phones` — lists phone numbers on the partner account (sanity-checks the token).
- `POST /api/linq/chats` — sends a text; JSON body optional:

```json
{
  "from": "+12052402169",
  "to": ["+19178075017"],
  "message": "Hello World"
}
```

Omit `from` / `to` to use env defaults; omit `message` for a short default test string.

## Smoke test (CLI)

From repo root (loads `../.env`):

```bash
cd webapp && set -a && source ../.env && set +a && npx tsx scripts/linq-smoke.ts
```

## Do not commit secrets

Never commit tokens or phone numbers. Keep them only in `.env.local` (gitignored under `webapp/.env*`).
