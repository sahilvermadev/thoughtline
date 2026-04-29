# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: ThoughtLine

Breed AI advisor agents into personalized decision systems with inherited reasoning and verifiable lineage on 0G. Users create genesis agents from source text, mint them as ERC-7857-style iNFTs, unlock encrypted private worldviews with wallet signatures, authorize others to use or breed with agents for separate fees without transferring ownership, invoke skill packages, and breed two agents into a child with inherited/adapted/synthesized capabilities.

`docs/PRD.md` is the source of truth for hackathon V1. If this file and the PRD disagree, follow the PRD and update this file.

## Architecture

Turborepo monorepo with pnpm workspaces:
- `apps/web` — Next.js frontend + API routes
- `packages/contracts` — Hardhat Solidity contracts (minimal ERC-7857-style iNFT with lineage and stub TEE verifier)
- `packages/shared` — Shared TypeScript types, schemas, constants

### Stack
- **Runtime**: TypeScript + Node.js
- **Frontend**: Next.js, RainbowKit + wagmi + viem. No SIWE in V1; use per-action wallet signatures for unlock.
- **Database**: PostgreSQL + Drizzle ORM remains scaffolding only. V1 demo state is recovered from chain + 0G Storage.
- **LLM**: Provider-agnostic abstraction. OpenRouter remains a reliability hedge; 0G Compute is used for breeding synthesis where practical.
- **Streaming workflows**: Genesis and breeding stream progress with Server-Sent Events from Next.js API routes. No Inngest / Trigger.dev in V1.
- **Contracts**: Hardhat, Solidity, deployed to 0G Galileo Testnet (chain ID 16602)
- **Storage**: Adapter-based (`StorageProvider` interface in shared). Memory adapter for dev/test, 0G Storage adapter for production.
- **Deployment**: Vercel (web app), 0G Galileo contracts/storage

### Data Split
- **On-chain (0G Galileo)**: ERC-7857-style iNFT with public profile URI, private worldview URI, private ciphertext `dataHash`, and parent token IDs.
- **0G Storage public profile**: Plaintext `name`, `description`, `skills`, `generation`, `parentIds`.
- **0G Storage private worldview**: AES-GCM ciphertext containing `values`, `heuristics`, `blindspots`, `decisionStyle`, and `freeform`.
- **Browser memory**: Decrypted worldviews after owner unlock. Do not persist decrypted private data.

### Key Flows
- **Genesis creation**: User connects wallet, signs deterministic unlock message, pastes source text, SSE route extracts public profile + private worldview, encrypts private data, uploads both halves to 0G Storage, returns mint transaction prep, and the user signs the mint.
- **Owner unlock**: User signs a deterministic token-specific message; SHA-256 of the signature derives the AES-GCM key for decrypting that agent's private worldview client-side.
- **Breeding**: User unlocks two parents available to them, SSE route synthesizes child private worldview and public skill packages via LLM, encrypts/uploads both halves, returns child mint transaction prep, and the user signs the mint.
- **Skill invocation**: Owners may invoke with a locally decrypted private worldview via `/api/invoke-skill`. Authorized non-owners invoke through an authorized runtime endpoint that checks on-chain authorization, decrypts internally, and returns only the response. No persisted chat history in V1.
- **Paid authorization**: Usage and breeding are separate rights. Usage authorization permits skill invocation; breeding authorization permits using an agent as a parent. Owners can price them independently.
- **Verification**: Judges can fetch encrypted private bytes from 0G Storage and verify their SHA-256 matches the on-chain `dataHash`.

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
npx hardhat deploy --network 0g-testnet  # Deploy to 0G Galileo
```

## Conventions

- Agent genome is split: public profile is plaintext and comparable; private worldview is encrypted and owner-unlocked.
- Use project-native `SkillPackage[]` for public capabilities. Skill packages are `SKILL.md`-style markdown instructions with provenance (`genesis`, `inherited`, `adapted`, `synthesized`) and parent skill ids.
- LLM provider abstraction: never import a specific provider directly in business logic; use `createProvider()` from `apps/web/src/lib/llm/provider.ts`
- Structured LLM extraction: use `extractStructured(llm, messages, zodSchema)` from `apps/web/src/lib/llm/extract-structured.ts` for any LLM→JSON→validate pipeline. It handles retry-on-bad-JSON automatically.
- Storage provider abstraction: never call 0G SDK directly in business logic; use `createStorage()` from `apps/web/src/lib/storage/index.ts`. Use `"memory"` adapter for dev/test, `"0g"` for production
- Agent creation: use `createAgentFromText()` for genesis from text sources and `createAgentFromBreeding()` for breeding. Split the result into public profile and private worldview before storage.
- `AgentArchive` owns serialization + storage composition and should absorb encryption details through a crypto boundary.
- `AgentArchive` computes verifier-facing `dataHash` from private ciphertext bytes; do not rely on storage adapter hash semantics for on-chain proof.
- Breeding is streamed through SSE in V1, not a job queue.
- Do not introduce SIWE or backend sessions for V1.
- Do not put Postgres on any demo-critical path for V1.
- Contract work should target minimal ERC-7857 compatibility, lineage, data hashes, and a stub `TEEVerifier`. Be explicit in docs that the V1 verifier is not a real TEE.
- Gas is paid by the user (standard web3 UX)
- Tests use vitest + msw (fake HTTP). Run single test file: `pnpm --filter web vitest run src/lib/path/to/test.ts`
