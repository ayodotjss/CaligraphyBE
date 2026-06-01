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
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0xYourDeployedContract
CHAIN_ID=31337
SIGNER_PRIVATE_KEY=0xYourBackendSignerPrivateKey
FRONTEND_ORIGIN=http://localhost:3000
ROLL_STORE=json
DATA_FILE=./data/rolls.json
```

The signer address must match `trustedSigner` in the deployed contract.

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
```

On startup the backend creates the `rolls` table and the active-roll uniqueness index automatically.

## Run

```powershell
npm run dev
```

## Render Keepalive

The GitHub Actions workflow at `.github/workflows/render-keepalive.yml` pings Render every 11 minutes.

In GitHub, set this repository variable or secret:

```text
RENDER_PING_URL=https://your-render-service.onrender.com/health
```

## API

### `GET /health`

Returns backend and chain status.

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
