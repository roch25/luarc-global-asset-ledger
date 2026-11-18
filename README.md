<h1 >Global Asset Ledger</h1>

<p >   A high-performance financial asset management platform designed to search, filter, analyze, and manage millions of global asset records. </p>

<p >   <img src="https://img.shields.io/badge/Next.js-16.4.6-black?logo=next.js&logoColor=white" alt="Next.js" />   <img src="https://img.shields.io/badge/React-19.3.0-149eca?logo=react&logoColor=white" alt="React" />   <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />   <img src="https://img.shields.io/badge/Tailwind_CSS-4.3.3-06b6d4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />   <img src="https://img.shields.io/badge/Lucide_React-1.75.0-f56565?logo=lucide&logoColor=white" alt="Lucide React" /> </p>

<p >   <img src="https://img.shields.io/badge/pnpm-10.12.4-f69220?logo=pnpm&logoColor=white" alt="pnpm" />   <img src="https://img.shields.io/badge/ESLint-10.15.0-4b32c3?logo=eslint&logoColor=white" alt="ESLint" />   <img src="https://img.shields.io/badge/Prettier-3.10.1-f7b93e?logo=prettier&logoColor=black" alt="Prettier" />   <img src="https://img.shields.io/badge/Status-In_Development-yellow" alt="Project Status" /> </p>

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
