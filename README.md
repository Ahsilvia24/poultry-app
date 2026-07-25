# PoultryTech — Poultry Farm Management

Mobile-friendly Next.js app for poultry service technicians to manage broiler farms, houses, flocks, daily mortality, feed, litter events, visits, and issues.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Prisma ORM
- Auth.js (NextAuth v5) email/password credentials
- Recharts, jsPDF for reports

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ **or** Docker

### Option A — Homebrew PostgreSQL (this machine)

```bash
brew services start postgresql@16
createdb poultry_app
```

### Option B — Docker Compose

```bash
docker compose up -d
```

Default Docker connection string:

```
postgresql://poultry:poultry@localhost:5432/poultry_app?schema=public
```

## Setup

```bash
cd poultry-app
cp .env.example .env
# Edit DATABASE_URL and AUTH_SECRET in .env

npm install
npm run db:setup    # prisma db push + seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed login

| Field    | Value                |
|----------|----------------------|
| Email    | `tech@poultry.local` |
| Password | `password123`        |

Seed data includes 2 farms (4 and 8 houses), active flocks with 14+ days of mortality, 3 prior flocks per farm, feed, litter, visits, and issues.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:seed` | Reseed sample data |
| `npm run db:setup` | Push schema + seed |
| `npm run db:generate` | Generate Prisma client |

## Features

1. **Farms & houses** — CRUD with soft archive; ventilation CFM/sq ft estimates
2. **Flocks** — One active flock per farm; house-level placement via `HouseFlock`
3. **Daily mortality** — Mobile batch entry, upsert by house+date, 7-day & cumulative calcs
4. **Dashboard** — Active farms, missing mortality, issues, catches, follow-ups, status badges
5. **Operations** — Feed deliveries, litter events, farm visits, farm issues
6. **History** — Compare current flock vs previous flocks
7. **Reports** — Charts, filters, CSV & PDF export
8. **Settings** — Custom mortality thresholds (not hard-coded)

Mortality warnings are informational only and do **not** provide veterinary diagnoses.

## Project structure

```
poultry-app/
  docker-compose.yml
  prisma/schema.prisma
  prisma/seed.ts
  src/
    app/(auth)/          # login, register
    app/(dashboard)/     # dashboard, farms, mortality, reports, …
    app/actions/         # server actions
    components/
    lib/                 # auth, prisma, mortality/feed/ventilation calcs, exports
    types/
```

## Security notes

- Passwords hashed with bcrypt
- Farm data scoped to the signed-in user
- Server-side ownership checks on mutations
- Soft archive for farms (no hard delete of historical records)

## Future-ready

Schema includes `User.role` for multi-technician / admin / grower / vet expansion. Media uploads, offline mode, alerts, and maps are intentionally deferred.
