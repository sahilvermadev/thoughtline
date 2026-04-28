# AGENTS.md

Turborepo monorepo with pnpm workspaces.

## Structure

- `apps/web` — Next.js 15 (React 19) app. Entry: `src/app/layout.tsx` / `page.tsx`.
- `packages/shared` — Shared TypeScript types/schemas. Built with `tsc`. Entry: `src/index.ts`.
- `packages/contracts` — Hardhat Solidity project. Contract: `contracts/ThoughtLineAgent.sol`.

## Commands

Install and run everything via pnpm from root:

```bash
pnpm install          # pnpm 10.33.0 (packageManager field enforces this)
pnpm dev              # Start Next.js dev server (turbo dev)
pnpm build            # Build all packages (turbo build)
pnpm lint             # Lint all packages (turbo lint)
pnpm test             # Run all tests (turbo test)
```

Run a single web test:
```bash
pnpm --filter web vitest run src/lib/path/to/test.ts
```

Database (Drizzle):
```bash
pnpm db:generate      # Generate migrations (drizzle-kit generate)
pnpm db:migrate       # Run migrations (drizzle-kit migrate)
pnpm db:studio        # Drizzle Studio
```

Contracts:
```bash
pnpm --filter contracts build      # Compile Solidity (hardhat compile)
pnpm --filter contracts test       # Run Hardhat tests
pnpm --filter contracts exec hardhat deploy --network 0g-testnet
```

## Build Order

Turbo tasks:
- `build` depends on `^build` (upstream packages first).
- `lint` and `test` depend on `^build`.
- `dev` is persistent and uncached.

## Key Config

- **TypeScript**: `tsconfig.base.json` sets `module: ESNext`, `moduleResolution: bundler`, `strict: true`.
- **Next.js**: `transpilePackages: ["@thoughtline/shared"]` in `next.config.ts`.
- **Vitest** (web): `globals: true`, alias `@` → `./src`.
- **Hardhat**: Solidity 0.8.28, `evmVersion: cancun`, network `0g-testnet` (RPC: `https://evmrpc-testnet.0g.ai`).
- **Drizzle**: Schema at `apps/web/src/lib/db/schema.ts`, output dir `apps/web/drizzle`.

## Environment Variables

Copy `apps/web/.env.example` to `.env.local`. Required:
- `DATABASE_URL` — PostgreSQL connection string.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — WalletConnect project ID.
- `NEXT_PUBLIC_CHAIN_ID` — defaults to 16600 in example.
- `OG_STORAGE_ENDPOINT`, `OG_PRIVATE_KEY` — 0G Storage.
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — LLM providers.

## Conventions

- **LLM abstraction**: Never import a provider directly. Use `createProvider()` from `apps/web/src/lib/llm/provider.ts`.
- **Structured extraction**: Use `extractStructured()` from `apps/web/src/lib/llm/extract-structured.ts` for LLM→JSON→Zod pipelines (handles retry on bad JSON).
- **Storage abstraction**: Never call 0G SDK directly. Use `createStorage()` from `apps/web/src/lib/storage/index.ts`. Use `"memory"` adapter for dev/test, `"0g"` for production.
- **Breeding is always async**: Trigger via job queue, never synchronously in API routes.
- **On-chain data is minimal**: Only metadata URI and parent token IDs live on-chain; full agent data lives on 0G Storage.
- **Contract access control**: `onlyMinter` on `ThoughtLineAgent.sol`. Deployer is auto-authorized; use `setMinter()` to add more.

## Related Docs

- `CLAUDE.md` — Full architecture, key flows, and design rationale.
