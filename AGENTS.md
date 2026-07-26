<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Product: PoultryTech, a single Next.js 16 (App Router) + Prisma + PostgreSQL web app. Auth is NextAuth v5 credentials. Standard commands live in `README.md` / `package.json` scripts.

Services (both required to test end-to-end):
- PostgreSQL 16 — provided in cloud by a locally-installed apt cluster (not Docker). Start it before running the app with `sudo pg_ctlcluster 16 main start`. DB `poultry_app` / role `poultry` (password `poultry`) already exist and match the `docker-compose.yml` defaults.
- Next.js dev server — `npm run dev` (port 3000). Log in with seed creds `tech@poultry.local` / `password123`.

Non-obvious caveats:
- `.env` is git-ignored and there is no `.env.example`. It must exist with `DATABASE_URL="postgresql://poultry:poultry@localhost:5432/poultry_app?schema=public"` and an `AUTH_SECRET` (NextAuth refuses to sign sessions without it). The update script recreates `.env` if missing.
- After a fresh DB or schema change, run `npm run db:setup` (`prisma db push` + seed) to get schema + seed login/data. This is not in the update script (it mutates the DB) — run it manually when needed.
- `npm run lint` currently reports pre-existing errors in app code (e.g. `MortalityEntryForm.tsx`); these are not environment issues.

