# AGENTS.md

Turborepo monorepo with pnpm workspaces.

## Product Source of Truth

- `docs/PRD.md` supersedes older architecture notes for the hackathon V1.
- The V1 target is an end-to-end ThoughtLine tracer bullet: wallet connect, genesis-from-text, encrypted private worldview on 0G Storage, public profile with `SkillPackage[]` on 0G Storage, ERC-7857-style iNFT minting on 0G Galileo, owner unlock, paid/authorized skill invocation, paid/authorized breeding, and self-breeding via SSE.
- Treat stale references to ERC-721-only contracts, SIWE, Postgres-backed chat/history, async job queues, or pre-seeded agents as out of date unless `docs/PRD.md` is explicitly updated.

## Structure

- `apps/web` — Next.js 15 (React 19) app. Entry: `src/app/layout.tsx` / `page.tsx`.
- `packages/shared` — Shared TypeScript types/schemas. Built with `tsc`. Entry: `src/index.ts`.
- `packages/contracts` — Hardhat Solidity project. Contract target: minimal ERC-7857-style `ThoughtLineAgent.sol` with lineage and a stub TEE verifier.

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

Database (Drizzle, scaffolding only for V1; not on the demo critical path):
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
- **Hardhat**: Solidity 0.8.28, `evmVersion: cancun`, network `0g-testnet` / 0G Galileo (chain ID 16602, RPC: `https://evmrpc-testnet.0g.ai`).
- **Drizzle**: Schema at `apps/web/src/lib/db/schema.ts`, output dir `apps/web/drizzle`.

## Environment Variables

Copy `apps/web/.env.example` to `.env.local`. V1 demo-critical variables:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — WalletConnect project ID.
- `NEXT_PUBLIC_CHAIN_ID` — 16602 for 0G Galileo.
- `NEXT_PUBLIC_CONTRACT_ADDRESS` — deployed ThoughtLine contract.
- `OG_STORAGE_ENDPOINT`, `OG_PRIVATE_KEY` — 0G Storage.
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — LLM providers.

Scaffolding / non-critical for V1:
- `DATABASE_URL` — PostgreSQL connection string for Drizzle-backed future paths.

## Conventions

- **LLM abstraction**: Never import a provider directly. Use `createProvider()` from `apps/web/src/lib/llm/provider.ts`.
- **Structured extraction**: Use `extractStructured()` from `apps/web/src/lib/llm/extract-structured.ts` for LLM→JSON→Zod pipelines (handles retry on bad JSON).
- **Storage abstraction**: Never call 0G SDK directly. Use `createStorage()` from `apps/web/src/lib/storage/index.ts`. Use `"memory"` adapter for dev/test, `"0g"` for production.
- **No direct provider SDK imports in business logic**: 0G Storage and 0G Compute must stay behind the storage and LLM provider interfaces.
- **No SIWE in V1**: Use RainbowKit/wagmi wallet connect and per-action signatures for owner unlock.
- **No async job queue in V1**: Genesis and breeding stream progress with Server-Sent Events from Next.js API routes.
- **No Postgres on the V1 critical path**: Recover demo state from chain plus 0G Storage. Drizzle remains scaffolding.
- **Genesis is user-created only**: No pre-seeded parents in contract or app code.
- **Genome split**: Public profile is plaintext (`name`, `description`, `skills`, `generation`, `parentIds`); private worldview is encrypted (`values`, `heuristics`, `blindspots`, `decisionStyle`, `freeform`).
- **Owner unlock**: Derive an AES-GCM key from a deterministic wallet signature. Keep decrypted worldviews in browser memory only.
- **Skill packages**: Public capabilities are project-native `SkillPackage[]` entries with `SKILL.md`-style markdown, source provenance, and parent skill ids. They are discoverable by everyone. Owners can invoke via local unlock; non-owners need on-chain usage authorization and runtime-side execution that does not reveal the private worldview.
- **Usage vs breeding authorization**: Usage authorization permits skill invocation. Breeding authorization permits using the agent as a parent. Owners can set separate fees for each; paying one fee must not grant the other permission.
- **Breeding pipeline**: Use LLM synthesis for the private worldview and child skill packages. The child may inherit, adapt, synthesize, or drop parent skills based on fit with the child agent. The pipeline returns mint transaction prep; the user signs the mint transaction.
- **On-chain data is minimal but verifiable**: Store public/private storage pointers, lineage pointers, and the private ciphertext `dataHash` that judges can verify against bytes fetched from 0G Storage.
- **Contract target**: Minimal ERC-7857-style iNFT contract with lineage and a stub `TEEVerifier`. V1 is honest about the verifier being a hackathon stub, not a real enclave.

## Related Docs

- `docs/PRD.md` — Authoritative V1 product, scope, schema, API, and testing decisions.
- `CLAUDE.md` — Claude Code working summary aligned to the PRD.
