# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

LoyalityBot (Sarafano.io) is a Telegram Mini App loyalty/cashback platform with three roles: Clients, Partners, and Ambassadors. The active stack is **Cloudflare Workers** (JS/ESM) + **React/Vite frontend** + **Supabase** backend. Legacy Python files at the root (`bot.py`, `admin_bot.py`, `client_handler.py`) are deprecated — do not modify them.

### Services

| Service | Directory | Run command | Port |
|---------|-----------|-------------|------|
| Frontend (React/Vite) | `frontend/` | `npm run dev` | 3000 |
| Partner Bot Worker | `cloudflare/workers/partner-webhook/` | `wrangler dev --local` | 8787 |
| Client Bot Worker | `cloudflare/workers/client-webhook/` | `wrangler dev --local` | 8788 |
| Admin Bot Worker | `cloudflare/workers/admin-webhook/` | `wrangler dev --local` | 8789 |
| API Worker | `cloudflare/workers/api/` | `wrangler dev --local` | 8787 |
| Exchange Rates Cron | `cloudflare/workers/exchange-rates-cron/` | `wrangler dev --local` | 8787 |

### Gotchas

- **Frontend `.env` required**: The frontend needs `frontend/.env` with at minimum `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to start. See `frontend/.env.example` for the full list. Without this file, the app crashes on load with "Missing Supabase credentials".
- **Workers run without Cloudflare auth in local mode**: Use `wrangler dev --local` to run workers locally without needing Cloudflare account credentials. Secrets (Supabase URL/key, bot tokens) won't be available in local mode unless set via `--var` flags.
- **No ESLint config**: The frontend `package.json` does not include a `lint` script or ESLint config. Use `npm run build` as the primary code quality check (Vite/TypeScript compilation).
- **Python venv**: Python tests use a venv at `/workspace/venv`. Activate with `source /workspace/venv/bin/activate`. The `python3.12-venv` system package must be installed first (`sudo apt-get install python3.12-venv`).

### Testing

- **Python tests**: `source /workspace/venv/bin/activate && pytest tests/ -v` (690/727 pass; 32 failures are pre-existing — they reference removed legacy Python files or hit production Cloudflare URLs)
- **Frontend build check**: `cd frontend && npm run build` (serves as the lint/type-check)
- **Frontend dev server**: `cd frontend && npm run dev` (port 3000)

### Architecture rules (from `.cursor/rules/`)

- Deploy only on Cloudflare. Never suggest Render, Fly.io, Vercel, Netlify.
- Do not read/modify legacy Python bot files (`bot.py`, `admin_bot.py`, `client_handler.py`).
- Three distinct roles: Client, Partner, Ambassador — never mix them. See `docs/ROLES_DEFINITION.md`.
