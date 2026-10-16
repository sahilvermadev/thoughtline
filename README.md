# ThoughtLine

A hackathon prototype for creating AI agents from source material, publishing their capabilities, encrypting their private data and controlling usage through on-chain authorization.

**Next.js / React / TypeScript · Solidity / Hardhat · Vitest · 0G Storage**

[Product specification](docs/PRD.md) · [Development and historical demo artifacts](docs/DEVELOPMENT.md) · [Web tests](apps/web/src/lib) · [Contract tests](packages/contracts/test/ThoughtLineAgent.ts)

## What it does

1. Connect a wallet and provide expertise notes, examples or source material.
2. Stream generation progress while creating a public capability profile and an encrypted private worldview.
3. Prepare a mint transaction linking off-chain content to an on-chain ciphertext hash.
4. Browse public profiles, unlock owned agents, or invoke agents through authorized usage. Usage and breeding permissions are separate.

**Status:** hackathon/testnet prototype. This is not an audited contract system or a production confidential-computing service. The TEE verifier is a stub. Authorized non-owner execution runs in an ordinary server process with a server-held runtime key; real enclave execution and TEE-held key custody are not implemented. Historical testnet addresses and the recorded storage/hash smoke result are preserved in the development notes; their continued availability has not been revalidated here.

## Engineering entry points

| Concern | Implementation | Tests |
| --- | --- | --- |
| Access boundaries | [Usage and breeding authorization](apps/web/src/lib/authorization/access.ts) | [Access checks](apps/web/src/lib/authorization/__tests__/access.test.ts) |
| Private artifact handling | [Agent artifact](apps/web/src/lib/agent-artifact/index.ts) | [Artifact tests](apps/web/src/lib/agent-artifact/__tests__/agent-artifact.test.ts) |
| Replaceable storage | [Storage interface and adapters](apps/web/src/lib/storage/index.ts) | [Storage tests](apps/web/src/lib/storage/__tests__/storage.test.ts) |
| Provider integration | [LLM provider factory](apps/web/src/lib/llm/provider.ts), [structured extraction](apps/web/src/lib/llm/extract-structured.ts) | [Provider tests](apps/web/src/lib/llm/__tests__/provider.test.ts), [extraction tests](apps/web/src/lib/llm/__tests__/extract-structured.test.ts) |
| On-chain rights and lineage | [ThoughtLineAgent](packages/contracts/contracts/ThoughtLineAgent.sol) | [Hardhat contract tests](packages/contracts/test/ThoughtLineAgent.ts) |

The web routes use server-sent events for long-running generation. Provider and storage implementations sit behind interfaces. The V1 demo recovers its published state from the chain and storage; the checked-in Drizzle database scaffolding is not required for that path.

## Local setup

Use Node.js 22 and **pnpm 10.33.0**, matching the package-manager declaration. From the repository root:

```bash
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @thoughtline/shared build
pnpm --filter web dev
```

Open `http://localhost:3000`. Memory storage supports local development; full generation still needs your own configured LLM provider key, and minting needs a wallet and matching testnet contract. Configure values in `apps/web/.env.local` using the [example](apps/web/.env.example). The authorized-runtime flow additionally needs its RSA-OAEP JWK configuration. Never put private provider, wallet or runtime keys in public browser variables.

## Checks

```bash
pnpm --filter @thoughtline/shared build
pnpm --filter web test
pnpm --filter web exec tsc --noEmit
pnpm --filter @thoughtline/contracts test
pnpm build
```

These are the checked-in test/build entry points, not a claim that they were rerun for this documentation update. The storage suite's live 0G roundtrip is explicitly gated by `VITEST_0G=1`; leave it unset for ordinary review. Unit tests do not establish live testnet or provider availability. See [development notes](docs/DEVELOPMENT.md) for deployment, optional integrations and historical artifacts.
