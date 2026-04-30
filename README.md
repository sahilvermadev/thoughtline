# ThoughtLine

ThoughtLine is a hackathon tracer bullet for minting user-created advisor agents as ERC-7857-style iNFTs on 0G Galileo. A user connects a wallet, pastes source text, signs an unlock message, and receives mint transaction data for an agent whose public profile and encrypted private worldview are stored off-chain.

## What Works Now

- Genesis-from-text flow in the web app.
- Split agent genome:
  - Public profile: `name`, `description`, `skills`, `generation`, `parentIds`.
  - Private worldview: `values`, `heuristics`, `blindspots`, `decisionStyle`, `freeform`.
- AES-GCM encryption of the private worldview using a wallet-signature-derived key.
- V2 private worldview envelopes for new agents when an authorized runtime public
  key is configured: the worldview is encrypted with a random data key, then the
  data key is wrapped for owner unlock and for the demo authorized runtime.
- Byte-shaped storage seam with memory and 0G Storage adapters.
- 0G Storage adapter for upload/fetch by `0g://<rootHash>`.
- Genesis SSE route: `POST /api/genesis`.
- Mint calldata for `mintGenesis(publicUri, privateUri, dataHash)`.
- Minimal ERC-7857-style contract with lineage, separate usage/breeding authorization, and a stub `TEEVerifier`.
- Deploy script for 0G Galileo.
- Proof helper that fetches encrypted private bytes and checks their SHA-256 against `dataHash`.

Not done yet: public gallery, proof UI, owner unlock UI for existing iNFTs, skill invocation UI, paid access UI, breeding UI/API, and real 0G Compute / sealed inference.

## Run Locally

Install dependencies from the repo root:

```bash
pnpm install
```

Create a local web env file:

```bash
cp apps/web/.env.example apps/web/.env.local
```

For local development, memory storage is enough:

```bash
STORAGE_ADAPTER=memory
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
NEXT_PUBLIC_CHAIN_ID=16602
NEXT_PUBLIC_CONTRACT_ADDRESS=...
AUTHORIZED_RUNTIME_PUBLIC_KEY_JWK=...
AUTHORIZED_RUNTIME_PRIVATE_KEY_JWK=...
```

Start the web app:

```bash
pnpm --filter web dev
```

Open `http://localhost:3000`.

You can also start all workspace dev tasks through Turbo:

```bash
pnpm dev
```

For 0G Storage:

```bash
STORAGE_ADAPTER=0g
OG_PRIVATE_KEY=...
OG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
```

The current UI uses the browser wallet provider directly. It asks the wallet to:

1. connect accounts,
2. sign a deterministic genesis unlock message,
3. submit the `mintGenesis` transaction after the backend prepares the artifact.

## Contracts

Compile and test:

```bash
pnpm --filter contracts build
pnpm --filter contracts test
```

Deploy to 0G Galileo:

```bash
DEPLOYER_PRIVATE_KEY=... pnpm --filter contracts deploy
```

The deploy script prints:

- `TEE_VERIFIER_ADDRESS`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_CHAIN_ID=16602`
- 0G Galileo explorer links

Galileo details:

- Chain ID: `16602`
- RPC: `https://evmrpc-testnet.0g.ai`
- Explorer: `https://chainscan-galileo.0g.ai`

## Genesis Flow

`POST /api/genesis` accepts:

```json
{
  "name": "My Agent",
  "sources": [{ "label": "source", "text": "..." }],
  "ownerAddress": "0x...",
  "unlockSignature": "0x..."
}
```

It streams:

```text
preparing
synthesizing-worldview
synthesizing-skills
encrypting
uploading
ready
```

The `ready` event includes public mint artifacts only:

- `publicProfile`
- `publicUri`
- `publicHash`
- `privateUri`
- `dataHash`
- `mintCalldata`
- `mintTransaction`

It does not return the private worldview.

## Embedded Intelligence Proof

The contract stores `dataHash`, the SHA-256 hash of the encrypted private-worldview bytes.

Anyone can verify the embedded-data claim:

1. Read `privateUri` and `dataHash` from the minted iNFT.
2. Fetch encrypted bytes from storage using `privateUri`.
3. SHA-256 hash those encrypted bytes.
4. Confirm the result equals on-chain `dataHash`.

The helper lives at:

```text
apps/web/src/lib/proof/private-data.ts
```

Its interface is:

```ts
verifyPrivateDataHash({ storage, privateUri, dataHash })
```

This proves the private data bytes are embedded by content hash. It does not decrypt the worldview.

## V1 TEE Honesty

ThoughtLine V1 includes a `TEEVerifier` contract and runtime seams shaped for sealed execution, but it does not run a real enclave yet.

For the hackathon version:

- The verifier is a stub.
- Owner unlock happens with normal wallet signatures.
- Authorized non-owner ask runs in normal server code using
  `AUTHORIZED_RUNTIME_PRIVATE_KEY_JWK` to unwrap V2 private worldview envelopes.
- Real 0G Sealed Inference / TEE-held key custody is future work.

The architecture is intended to swap the stub runtime for real 0G sealed execution without changing the on-chain public/private pointer model.

## Test

Full workspace checks:

```bash
pnpm test
pnpm build
```

Useful focused checks:

```bash
pnpm --filter web test
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
pnpm --filter contracts test
```

0G live storage roundtrip is env-gated:

```bash
VITEST_0G=1 STORAGE_ADAPTER=0g OG_PRIVATE_KEY=... pnpm --filter web test
```
