<h1>Global Asset Ledger</h1>

<p>
  A high-performance financial asset management platform designed to search, filter, analyze, and manage millions of global asset and transaction records with sub-5ms PostgreSQL queries and 60 FPS UI virtualization.
</p>

<p>
  <img src="https://img.shields.io/badge/Next.js-16.4.6-black?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.3.0-149eca?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql&logoColor=white" alt="PostgreSQL 17" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-0.45.4-C5F74F?logo=drizzle&logoColor=black" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.3.3-06b6d4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Lucide_React-1.75.0-f56565?logo=lucide&logoColor=white" alt="Lucide React" />
</p>

<p>
  <img src="https://img.shields.io/badge/pnpm-10.12.4-f69220?logo=pnpm&logoColor=white" alt="pnpm" />
  <img src="https://img.shields.io/badge/ESLint-10.15.0-4b32c3?logo=eslint&logoColor=white" alt="ESLint" />
  <img src="https://img.shields.io/badge/Prettier-3.10.1-f7b93e?logo=prettier&logoColor=black" alt="Prettier" />
</p>

---

## Step-by-Step Setup Guide

### Step 1: Prerequisites

Ensure the following tools are installed and running on your machine:

1. **[Node.js](https://nodejs.org/)** (v20.12+ recommended)
   ```bash
   node -v
   ```
2. **[pnpm](https://pnpm.io/installation)** (v10+)
   ```bash
   pnpm -v
   ```
3. **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (with Docker Compose, used to run PostgreSQL 17 locally)
   ```bash
   docker --version
   docker compose version
   ```
   > Make sure Docker Desktop is open and running before proceeding to Step 5.

---

### Step 2: Clone the Repository

```bash
git clone https://github.com/roch25/luarc-global-asset-ledger.git
cd luarc-global-asset-ledger
```

---

### Step 3: Install Dependencies

```bash
pnpm install
```

---

### Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and verify your database credentials (you can keep the defaults below or customize `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` as long as `DATABASE_URL` matches):
   ```env
   NEXT_PUBLIC_APP_NAME="Global Asset Ledger"
   NEXT_PUBLIC_APP_ENV="development"

   # Matches docker-compose.yml (bound to 127.0.0.1:5433 to avoid clashing with local 5432 instances)
   POSTGRES_USER=username
   POSTGRES_PASSWORD=password
   POSTGRES_DB=dbname
   POSTGRES_PORT=5433
   DATABASE_URL=postgres://username:password@localhost:5433/dbname
   ```

---

### Step 5: Start the PostgreSQL 17 Container

Start the tuned PostgreSQL 17 Docker container (`gal-postgres`) in the background:

```bash
pnpm db:up
```

Verify the container is healthy and ready to accept connections:

```bash
docker ps --filter "name=gal-postgres"
```

---

### Step 6: Run Database Migrations

Apply the Drizzle SQL migrations (`drizzle/0000` through `drizzle/0005`), which set up the `pg_trgm` extension, core tables, B-tree and GIN trigram indexes, append-only ledger triggers, and dashboard materialized views:

```bash
pnpm db:migrate
```

---

### Step 7: Seed the Database (1M Assets & 2M Transactions)

Populate the database with reference currencies, 250 portfolios, **1,000,000 assets**, and **2,000,000 transactions**, and refresh the materialized views:

```bash
pnpm db:seed
```

> **Note:** Seeding uses native PostgreSQL `generate_series` inside the container and typically finishes in **~45–90 seconds**.
>
> You can also customize seed sizes if desired:
> - `pnpm db:seed --assets=5000000` (seed 5M assets)
> - `pnpm db:seed --transactions=0` (skip transactions)

---

### Step 8: Start the Development Server

```bash
pnpm dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser:
- **`/` (Overview Dashboard):** Sub-2ms portfolio KPIs, asset class allocations, and currency exposure powered by PostgreSQL Materialized Views.
- **`/assets` (Asset Ledger):** Search, filter, and sort 1M holdings via Paginated or Virtual Stream modes (`?view=virtual`) with off-main-thread Web Worker analytics and CSV streaming exports.
- **`/transactions` (Transaction Ledger):** Browse and filter 2M immutable, append-only ledger entries and bidirectional audit reversals.
- **`/reports` (Reports):** Visual analytics preview.
- **`/settings` (Settings):** Configure default reporting currency, page size, number display mode, and default ledger view.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Start the Next.js development server at `http://localhost:3000` |
| `pnpm build` | Create an optimized production build |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint across the codebase |
| `pnpm typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `pnpm format` | Format all project files with Prettier |
| `pnpm format:check` | Check code formatting without modifying files |
| `pnpm db:up` | Start the local PostgreSQL 17 Docker container (`gal-postgres`) |
| `pnpm db:down` | Stop and remove the PostgreSQL Docker container (data volume persists) |
| `pnpm db:generate` | Generate new Drizzle SQL migrations from `src/lib/db/schema.ts` |
| `pnpm db:migrate` | Apply pending Drizzle SQL migrations to PostgreSQL |
| `pnpm db:studio` | Launch Drizzle Studio to inspect database tables in your browser |
| `pnpm db:seed` | Seed 1M assets and 2M transactions into PostgreSQL |

---

## Troubleshooting & Resetting the Database

- **Port `5433` already in use:** Change `POSTGRES_PORT` and the port in `DATABASE_URL` inside `.env.local` (e.g., to `5434`), then re-run `pnpm db:up`.
- **Completely wipe and recreate the database volume from scratch:**
  ```bash
  docker compose --env-file .env.local down -v
  pnpm db:up
  pnpm db:migrate
  pnpm db:seed
  ```

---

## Project Structure

```text
├── docker-compose.yml          # PostgreSQL 17 container tuned for multi-million-row datasets
├── drizzle.config.ts           # Drizzle Kit configuration
├── drizzle/                    # SQL migrations (schema, triggers, materialized views, indexes)
├── scripts/
│   └── seed.ts                 # High-speed in-Postgres seed script (1M assets, 2M transactions)
└── src/
    ├── app/
    │   ├── (dashboard)/        # App Router pages (Overview, Assets, Transactions, Reports, Settings)
    │   ├── api/assets/         # Keyset chunk streaming API & backpressure CSV export stream
    │   ├── components/         # Shared layout (Sidebar) and UI components (CurrencySelector, PageError)
    │   └── config/site.ts      # Navigation & metadata config
    ├── features/
    │   ├── assets/             # Queries, schemas, virtualized & paginated tables, detail modal, Web Worker
    │   ├── dashboard/          # Materialized view rollup queries & OverviewDashboard UI
    │   ├── settings/           # Ledger preferences queries, Server Actions, & SettingsView
    │   └── transactions/       # Append-only transaction queries, filters, & TransactionTable
    └── lib/
        ├── db/                 # Drizzle connection pool (index.ts) & table definitions (schema.ts)
        ├── env.ts              # Lazy Zod server environment validation
        └── format.ts           # Exact scaled BigInt monetary arithmetic & formatting helpers
```

---

## Project Stack

- **Framework:** Next.js 16 (App Router, Server Components, Server Actions)
- **UI Library:** React 19 + Lucide React
- **Language:** TypeScript 5
- **Database:** PostgreSQL 17 (Docker) + Drizzle ORM
- **Validation:** Zod 4
- **Styling:** Tailwind CSS 4
- **Package Manager:** pnpm 10
