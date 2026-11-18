# Global Asset Ledger

A high-performance financial asset ledger designed to search, filter, sort, analyze, and manage datasets simulating millions of records, while supporting complex financial data operations with near-instant responsiveness through optimized data processing, efficient rendering, and a scalable architecture.

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation)

### Installation

Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/roch25/luarc-global-asset-ledger
```

```
cd luarc-global-asset-ledger
```

Install dependencies:

```bash
pnpm install
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

| Command                  | Description                  |
| ------------------------ | ---------------------------- |
| `pnpm dev`               | Start the development server |
| `pnpm build`             | Create a production build    |
| `pnpm start`             | Run the production server    |
| `pnpm lint`              | Run ESLint                   |
| `pnpm exec tsc --noEmit` | Check TypeScript types       |
| `pnpm format`            | Format project files         |
| `pnpm format:check`      | Check code formatting        |

## Project Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
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

The project structure will evolve as application features and shared components are introduced.

## Development Guidelines

- Use TypeScript for application code.
- Prefer reusable, modular components.
- Prioritize performance and scalability.
- Keep server-side and client-side responsibilities clearly separated.
- Maintain consistent formatting and code quality.
- Avoid unnecessary dependencies.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [pnpm Documentation](https://pnpm.io/)
