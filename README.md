# Financial Calligraphy Backend

Express backend for the commit-first dice mint flow.

## What it does

- Verifies a wallet is committed on-chain before rolling.
- Generates a dice result from `1` to `6` with xoshiro256**.
- Calls the contract `diceMessageHash(wallet, diceResult, nonce)`.
- Signs the hash with `SIGNER_PRIVATE_KEY`.
- Stores generated rolls locally in `data/rolls.json`.
- Can store rolls in Supabase/Postgres using `DATABASE_URL`.
- Returns the same roll for the same wallet attempt so users cannot re-roll for a better result.

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Fill in `.env`:

```env
PORT=3001
NODE_ENV=development
TRUST_PROXY=1
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0xYourDeployedContract
CHAIN_ID=31337
SIGNER_PRIVATE_KEY=0xYourBackendSignerPrivateKey
FRONTEND_ORIGIN=http://localhost:3000
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=120
ROLL_RATE_LIMIT_WINDOW_MS=60000
ROLL_RATE_LIMIT_MAX=10
REQUEST_TIMEOUT_MS=30000
ROLL_STORE=json
DATA_FILE=./data/rolls.json
```

The signer address must match `trustedSigner` in the deployed contract.

`FRONTEND_ORIGIN` is the only browser origin accepted by CORS. In production, set it to your deployed frontend URL, for example:

```env
FRONTEND_ORIGIN=https://your-frontend.vercel.app
```

## Storage

Local JSON storage is fine for local testing:

```env
ROLL_STORE=json
DATA_FILE=./data/rolls.json
```

For Supabase/Postgres:

```env
ROLL_STORE=postgres
DATABASE_URL=postgresql://postgres:password@host:5432/postgres
POSTGRES_MAX_CONNECTIONS=5
POSTGRES_SSL=true
POSTGRES_PREPARE=false
```

On startup the backend creates the `rolls` table and the active-roll uniqueness index automatically.

For higher traffic, use `ROLL_STORE=postgres`. The local JSON store is only intended for development or demos.

If you see `getaddrinfo ENOTFOUND db.xxxxx.supabase.co`, your machine/server cannot resolve that database hostname. Copy the connection string again from Supabase **Project Settings > Database > Connection string**. You can use either the Direct connection URL or Supabase's Pooler URL. If direct DNS still fails, try the Pooler connection string from the same Supabase screen.

## Run

```powershell
npm run dev
```

## Render Keepalive

The GitHub Actions workflow at `.github/workflows/render-keepalive.yml` pings Render every 11 minutes.

It is currently configured to ping:

```text
https://caligraphybe.onrender.com/health
```

## API

### `GET /health`

Cheap liveness endpoint for Render/GitHub keepalive pings. It does not hit the RPC provider.

### `GET /ready`

Readiness endpoint that checks the configured chain connection.

### `POST /roll`

Body:

```json
{
  "wallet": "0x..."
}
```

Response:

```json
{
  "wallet": "0x...",
  "diceResult": 4,
  "nonce": "123456",
  "signature": "0x...",
  "attemptNumber": 1,
  "status": "generated"
}
```

### `PATCH /rolls/:nonce`

Optional helper for the frontend/admin tooling to track submission status.

Body:

```json
{
  "status": "submitted",
  "txHash": "0x..."
}
```
