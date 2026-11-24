<h1 >Global Asset Ledger</h1>

<p >   A high-performance financial asset management platform designed to search, filter, analyze, and manage millions of global asset records. </p>

<p >   <img src="https://img.shields.io/badge/Next.js-16.4.6-black?logo=next.js&logoColor=white" alt="Next.js" />   <img src="https://img.shields.io/badge/React-19.3.0-149eca?logo=react&logoColor=white" alt="React" />   <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />   <img src="https://img.shields.io/badge/Tailwind_CSS-4.3.3-06b6d4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />   <img src="https://img.shields.io/badge/Lucide_React-1.75.0-f56565?logo=lucide&logoColor=white" alt="Lucide React" /> </p>

<p >   <img src="https://img.shields.io/badge/pnpm-10.12.4-f69220?logo=pnpm&logoColor=white" alt="pnpm" />   <img src="https://img.shields.io/badge/ESLint-10.15.0-4b32c3?logo=eslint&logoColor=white" alt="ESLint" />   <img src="https://img.shields.io/badge/Prettier-3.10.1-f7b93e?logo=prettier&logoColor=black" alt="Prettier" />   <img src="https://img.shields.io/badge/Status-In_Development-yellow" alt="Project Status" /> </p>

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v20.12+ recommended)
- [pnpm](https://pnpm.io/installation) (v10+)
- [Docker](https://www.docker.com/products/docker-desktop/) (with Docker Compose, for running PostgreSQL 17 locally)

### Installation

1. Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/roch25/luarc-global-asset-ledger
cd luarc-global-asset-ledger
```

2. Install dependencies:

```bash
pnpm install
```

3. Configure environment variables:

Copy `.env.example` to `.env.local` and set your local database credentials:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_APP_NAME="Global Asset Ledger"
NEXT_PUBLIC_APP_ENV="development"

# Matches docker-compose.yml (loopback port 5433)
POSTGRES_USER=username
POSTGRES_PASSWORD=password
POSTGRES_DB=dbname
POSTGRES_PORT=5433
DATABASE_URL=postgres://username:password@localhost:5433/dbname
```

4. Start the PostgreSQL container, apply migrations, and seed the database:

```bash
# Start PostgreSQL 17 in Docker (bound to 127.0.0.1:5433)
pnpm db:up

# Apply Drizzle schema migrations
pnpm db:migrate

# Seed reference data, 1M assets, and 2M transactions
pnpm db:seed
```

### Development

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The application automatically updates as you edit files in the `src` directory.

### Other Package Managers

pnpm is the recommended package manager for this project. You can also use:

**npm**

```bash
npm install
```

```
npm run dev
```

**Yarn**

```bash
yarn install
```

```
yarn dev
```

**Bun**

```bash
bun install
```

```
bun run dev
```

Use one package manager consistently to avoid lockfile conflicts.

## Available Scripts

| Command                  | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `pnpm dev`               | Start the development server                             |
| `pnpm build`             | Create a production build                                |
| `pnpm start`             | Run the production server                                |
| `pnpm lint`              | Run ESLint                                               |
| `pnpm typecheck`         | Check TypeScript types (`tsc --noEmit`)                  |
| `pnpm format`            | Format project files                                     |
| `pnpm format:check`      | Check code formatting                                    |
| `pnpm db:up`             | Start the local PostgreSQL Docker container              |
| `pnpm db:down`           | Stop and remove the local PostgreSQL Docker container    |
| `pnpm db:generate`       | Generate Drizzle SQL migrations from `src/lib/db/schema` |
| `pnpm db:migrate`        | Apply pending Drizzle database migrations                |
| `pnpm db:studio`         | Open Drizzle Studio to inspect database tables           |
| `pnpm db:seed`           | Seed 1M assets and 2M transactions into the database     |

## Project Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL 17 (Docker) + Drizzle ORM
- **Validation:** Zod
- **Styling:** Tailwind CSS
- **Package Manager:** pnpm

## Project Structure

```text
src/
└── app/
    ├── favicon.ico
    ├── globals.css
    ├── layout.tsx
    └── page.tsx

public/
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [pnpm Documentation](https://pnpm.io/)
