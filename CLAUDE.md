# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: ThoughtLine

Breed AI advisor agents into personalized decision systems with inherited reasoning and verifiable lineage on 0G. Each agent has a structured worldview (values, heuristics, blindspots, decision style) plus freeform persona text. Users create genesis agents, breed pairs into children via LLM synthesis, chat with advisors, and mint agents as iNFTs on 0G chain.

## Architecture

Turborepo monorepo with pnpm workspaces:
- `apps/web` — Next.js frontend + API routes
- `packages/contracts` — Hardhat Solidity contracts (ERC-721 iNFT with lineage)
- `packages/shared` — Shared TypeScript types, schemas, constants

### Stack
- **Runtime**: TypeScript + Node.js
- **Frontend**: Next.js, RainbowKit + wagmi + viem, SIWE (Sign-In With Ethereum) auth
- **Database**: PostgreSQL + Drizzle ORM (agent metadata cache, chat history, breeding jobs)
- **LLM**: Provider-agnostic abstraction via OpenRouter (supports Claude, GPT, Llama, etc.)
- **Async jobs**: Inngest or Trigger.dev for breeding pipeline
- **Contracts**: Hardhat, Solidity, deployed to 0G Galileo Testnet (chain ID 16602)
- **Storage**: Adapter-based (`StorageProvider` interface in shared). Memory adapter for dev/test, 0G Storage adapter for production. SDK: `@0gfoundation/0g-ts-sdk`
- **Deployment**: Vercel (web app), serverless job runner (Inngest/Trigger.dev)

### Data Split
- **On-chain (0G Newton)**: ERC-721 token with metadata URI + parent token IDs (lineage)
- **0G Storage**: Full agent worldview (structured fields + freeform persona)
- **PostgreSQL**: User sessions, agent metadata cache, chat history, breeding job state

### Key Flows
- **Genesis creation**: LLM-assisted interview or import-from-text → LLM extracts structured worldview → store on 0G → mint iNFT
- **Breeding**: User selects two owned agents → Inngest job: LLM synthesizes child worldview → upload to 0G Storage → mint child iNFT with parent references
- **Chat**: Worldview fetched from cache/0G → injected as system prompt → streamed LLM response → messages persisted to Postgres

## Build Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm build                # Build all packages (turbo)
pnpm dev                  # Dev server (apps/web)
pnpm lint                 # Lint all packages
pnpm test                 # Run tests across all packages
pnpm db:generate          # Generate Drizzle migrations
pnpm db:migrate           # Run Drizzle migrations
pnpm db:studio            # Open Drizzle Studio

# Contracts
cd packages/contracts
npx hardhat compile        # Compile Solidity contracts
npx hardhat test           # Run contract tests
npx hardhat deploy --network 0g-testnet  # Deploy to 0G Newton
```

## Conventions

- Agent worldview schema is hybrid: structured fields (typed, composable) + freeform text (expressive)
- LLM provider abstraction: never import a specific provider directly in business logic; use `createProvider()` from `apps/web/src/lib/llm/provider.ts`
- Structured LLM extraction: use `extractStructured(llm, messages, zodSchema)` from `apps/web/src/lib/llm/extract-structured.ts` for any LLM→JSON→validate pipeline. It handles retry-on-bad-JSON automatically.
- Storage provider abstraction: never call 0G SDK directly in business logic; use `createStorage()` from `apps/web/src/lib/storage/index.ts`. Use `"memory"` adapter for dev/test, `"0g"` for production
- Agent creation: use `createAgentFromText()` for genesis from text sources, `createAgentFromBreeding()` for breeding. Both return a complete agent (worldview + description + storage URI).
- Breeding is always async via job queue, never synchronous in API routes
- On-chain data is minimal — only metadata URI and lineage pointers; full data lives on 0G Storage
- Contract uses `onlyMinter` access control — only authorized addresses can mint. Deployer is auto-authorized; use `setMinter()` to add more.
- Gas is paid by the user (standard web3 UX)
- Tests use vitest + msw (fake HTTP). Run single test file: `pnpm --filter web vitest run src/lib/path/to/test.ts`
