# PRD: ThoughtLine — Hackathon Submission

## Problem Statement

I want to submit ThoughtLine to the ETHGlobal OpenAgents hackathon's *Best Autonomous Agents, Swarms & iNFT Innovations* track. Submission is due in ~5 days; I'm building solo with Claude Code.

The track has explicit qualification requirements that the current codebase cannot yet meet:

- A deployed contract address (no contract deployed; current contract is also wrong-shaped — ERC-721, not ERC-7857)
- A live demo URL (no frontend wired up)
- A minted iNFT on 0G with proof that the intelligence/memory is embedded (no 0G Storage integration; no encryption; no on-chain reference to embedded data)
- A 3-minute demo video and a public GitHub repo with setup instructions

The codebase today has solid pure-logic foundations (LLM provider, structured-extraction pipeline, agent-forge envelope, agent-archive serialization layer, memory storage adapter, lineage-aware ERC-721 contract that compiles) but no end-to-end path from "user opens the live URL" to "minted iNFT with embedded encrypted worldview on 0G Storage." Closing that gap is the work.

## Solution

Ship an end-to-end tracer-bullet through the full stack: a **fully user-created agent system** where any visitor can connect a wallet, paste a chunk of source text, and mint an ERC-7857 iNFT advisor agent whose worldview is encrypted on 0G Storage; then **breed any two agents** via a Genetic Crossover Oracle that synthesizes a child by combining qualitative reasoning (LLM synthesis on 0G Compute) with project-native skill-package inheritance, encrypts the child, uploads to 0G, and mints a child iNFT on 0G Galileo testnet with on-chain lineage pointers. A live demo URL where a viewer can witness the pipeline run and click through to verify the iNFT on the 0G explorer.

The genome shape is hybrid AND split:

- **Public profile** (plaintext, fetchable by anyone, lives in standard ERC-721 `tokenURI` form): `name, description, skills, generation, parentIds`. Skills are project-native skill packages, modeled after Claude Code / Codex skills: each public skill has a stable id, name, description, `SKILL.md`-style markdown instructions, provenance, and optional parent skill ids. The skill list is intentionally public because it makes the agent's capabilities discoverable in the gallery.
- **Private worldview** (encrypted ciphertext on 0G Storage, owner-unlocked): `values, heuristics, blindspots, decisionStyle, freeform persona`. This is the *reasoning fingerprint* — the part that's gated to ownership. Anyone fetching the 0G Storage URI sees ciphertext; only the owner, who can re-sign the deterministic unlock message with their wallet, recovers the AES key.

The private half captures *how* an agent reasons; the public skill packages describe *what the agent can do*. Anyone can inspect an agent's skills. The owner can unlock and invoke the agent directly. Other users can invoke it only if the owner grants on-chain usage authorization, and the invocation runs through an authorized runtime that does not reveal the decrypted worldview to the caller. Breeding authorization is separate from usage authorization, because deriving a child from an agent is a stronger right than asking the agent a question.

There are no pre-seeded parents in the contract or codebase. Demo agents shown on the live URL are simply agents the developer created from their own wallet ahead of recording, using the same user-facing genesis flow visitors will use.

The submission package consists of: deployed contract addresses (ERC-7857 + lineage + stub TEE verifier), a live demo URL, the GitHub repo with README, a 3-minute demo video, and a link to a minted child iNFT on the 0G explorer whose `dataHash` matches the SHA-256 of the encrypted private-worldview blob fetchable from its 0G Storage URI.

**On the TEE story (honest framing):** the Genetic Crossover Oracle architecture is *designed for* execution inside a Trusted Execution Environment so that parent owners do not need to trust any intermediary with their decrypted worldviews. V1 ships the on-chain hooks (a stub `TEEVerifier` contract with a single ECDSA signer the deployer controls) and the off-chain breeding service that conforms to the same interface, but the V1 breeding service runs in a normal Next.js API route — not a real enclave. The README will state this clearly: V1 demonstrates the architecture and the on-chain integration; production will swap the breeding service for a real TEE-attested service (e.g. via 0G's Sealed Inference) without changing the contract or the rest of the stack.

## User Stories

### End-user stories (the live demo)

1. As a viewer, I want to land on the live demo URL and see a gallery of every minted agent (their public profiles) without connecting a wallet, so that I can browse before committing.
2. As a viewer, I want to see each agent's public profile (name, description, skill packages, generation, parent links) without unlocking anything, so that I can grok the agent at a glance.
2a. As a wallet-connected agent owner, I want to unlock my own agent and see its full private worldview (values, heuristics, blindspots, decision style, freeform persona), so that I have access to the reasoning fingerprint I own.
3. As a viewer, I want to inspect each agent's public skill packages, so that I can understand what concrete tasks the agent can perform before I connect a wallet.
4. As a viewer, I want to see each agent's lineage badge (genesis vs. bred-from-X-and-Y), so that I understand its provenance at a glance.
5. As a viewer, I want to click through any agent to view its iNFT on the 0G explorer (token ID, owner, dataHash, storage URI), so that I can verify the on-chain claims.
6. As a viewer, I want to fetch the raw encrypted blob from the storage URI and confirm its SHA-256 matches the on-chain `dataHash`, so that I can verify intelligence-is-embedded from the outside.
7. As a viewer, I want to see which skill packages require ownership or usage authorization, so that I understand the difference between public discovery and authorized invocation.
8. As an iNFT owner, I want to invoke the same task against two owned agents' skills side-by-side, so that I can see how their worldviews and capabilities diverge.
8b. As an iNFT owner, I want to authorize another wallet to use my agent without transferring ownership, so that I can share or monetize access while keeping control.
8c. As an authorized user, I want to invoke another user's agent through a runtime that checks on-chain authorization and returns only the response, so that I can benefit from the agent without receiving its private worldview.
8d. As an iNFT owner, I want to revoke another wallet's usage authorization, so that I can stop access without affecting ownership.
8e. As an iNFT owner, I want to set separate fees for usage and breeding authorization, so that lightweight interaction and derivative creation can be priced differently.
8f. As a user, I want to pay to use another user's agent or pay a different fee to breed with it, so that I can access the level of capability I need without buying the agent.
8g. As an iNFT owner, I want to authorize breeding separately from usage, so that someone who can chat with my agent cannot automatically create derivative children from it.
8a. As a wallet-connected user, I want to paste a chunk of source text on a genesis page, watch the agent get synthesized live (via SSE), and mint it as my own iNFT, so that I can put my own values onto the chain.
9. As a wallet-connected user, I want to select any two minted agents I have access to and click "Breed", so that I can synthesize a child. (When the parents include another user's agent, breeding requires me to also own/unlock that parent's private worldview — for V1 the demo focuses on self-breeding own × own.)
10. As a wallet-connected user, I want to watch the breeding pipeline stream progress events live (worldview synthesis, skill synthesis, encryption, upload, mint-tx), so that I trust the system is doing real work.
11. As a wallet-connected user, I want to see the child's skill packages appear with provenance back to parent skills, so that genetic crossover is legible as concrete inherited, adapted, or newly synthesized capabilities.
12. As a wallet-connected user, I want to confirm a wallet transaction to mint the child iNFT, so that I own the child on-chain.
13. As an iNFT owner, I want to sign a wallet message to unlock and view my agent's full worldview client-side, so that the intelligence is gated to ownership.
14. As an iNFT owner, I want to invoke one of my agent's skill packages with its decrypted worldview as context, so that I can use the agent's concrete capabilities.
15. As an iNFT owner, I want my agent to retain its identity across page reloads (recoverable from chain + storage), so that ownership is durable.
16. As a viewer, I want to see the lineage tree expand after a breed, so that the parent-child relationship is visually anchored.

### Hackathon-judge stories (submission compliance)

17. As a hackathon judge, I want a public GitHub repo with a README and setup instructions, so that I can reproduce the project.
18. As a hackathon judge, I want the deployed contract addresses listed in the README, so that I can inspect them on-chain.
19. As a hackathon judge, I want a link to at least one minted child iNFT on the 0G explorer, so that I can confirm the project produced real on-chain artifacts.
20. As a hackathon judge, I want documented proof that the intelligence/memory is embedded (the encrypted-blob-hash-matches-on-chain-dataHash story), so that the iNFT requirement is satisfied.
21. As a hackathon judge, I want an explicit explanation of the V1 TEE-stub vs. production-Sealed-Inference gap in the README, so that I can grade the design honestly without confusion about what is implemented.
22. As a hackathon judge, I want a list of the 0G features used (Storage, Compute, iNFT/ERC-7857), so that I can score on platform integration.
23. As a hackathon judge, I want a 3-minute demo video, so that I can grade quickly.
24. As a hackathon judge, I want a live demo URL, so that I can interact with the project myself.

### Developer/operator stories

25. As the developer, I want my own demo agents (created via the user-facing genesis flow with my own wallet) minted on the live testnet before the video shoot, so that the gallery is populated and the breeding demo has compelling parents to work with on first load.
26. As the developer, I want a contract-deploy script targeting 0G Galileo testnet, so that I can deploy and redeploy with a single command.
27. As the developer, I want a stub TEE-oracle signer that runs as a Node script with a configurable private key, so that I can sign proofs the verifier accepts without a real TEE for the hackathon.
28. As the developer, I want a clear seam where AES-GCM crypto and the V1 signature-derived-key strategy plug into `AgentArchive`, so that swapping in a different key-derivation strategy (e.g. real ECIES seal-to-pubkey post-hackathon) does not require re-shaping any consumer.
29. As the developer, I want all integration points to 0G (Storage, Compute) implemented behind interfaces that already exist (`StorageProvider`, `LLMProvider`), so that the rest of the codebase doesn't know which provider is in use.
30. As the developer, I want skill-package selection and synthesis to be isolated behind a testable service boundary, so that breeding can create coherent child capabilities without coupling the rest of the app to prompt internals.
31. As the developer, I want authorized third-party invocation isolated behind a runtime interface, so that V1 can use a clearly labeled stub runtime and production can swap in 0G Sealed Inference / TEE execution without reshaping the app.

## Implementation Decisions

### Architecture (already locked, foundations done)

- **Tracer bullet over depth-first**: end-to-end vertical slice ahead of polish on any one piece.
- **`StorageProvider` is byte-shaped** (`upload(bytes) → {uri, hash}`, `fetch(uri) → bytes`). Adapters know nothing about agent metadata or encryption. *(Done.)*
- **`AgentArchive` is the deep module** that owns serialization-and-storage composition and produces the `dataHash` that goes on-chain. *(Done; will grow a `CryptoProvider` dependency.)*
- **`forgeAgent` is the shared envelope** around new-agent creation. Both `createAgentFromText` and `createAgentFromBreeding` are thin wrappers. *(Done.)*
- **No SIWE.** Wallet connect via RainbowKit; per-action signing for the unlock flow only. Backend chat receives decrypted worldview from the frontend in-memory.
- **No async job queue (no Inngest / Trigger.dev).** Breeding pipeline streams progress to the client over Server-Sent Events from a single Next.js API route.
- **Fully user-created agents** — no pre-seeded parents in V1. Any visitor can connect a wallet, paste source text, and mint an agent. Genesis-from-text is the front door of the app. Genesis-from-interview remains out of scope.
- **Demo agents are just user-created agents the developer made earlier** from their own wallet. The live demo's gallery shows whatever agents have been minted; nothing in the contract or app distinguishes "demo" from "user" agents.
- **Schema is split into public profile + private worldview.** The public half (name, description, skill packages, generation, parentIds) lives in plaintext via `tokenURI` and is visible to any visitor. The private half (values, heuristics, blindspots, decisionStyle, freeform persona) is encrypted on 0G Storage and gated to the owner's wallet signature.
- **Hybrid genome (private worldview + public capabilities).** Private side carries qualitative fields (values, heuristics, blindspots, decision style, freeform). Public side carries `SkillPackage[]`: named, invokable, `SKILL.md`-style capability packages. The private side captures *how* an agent reasons; the public side describes *what the agent can do*.
- **Skills are project-native skill packages.** A skill package is the ThoughtLine equivalent of a Claude Code / Codex skill: stable id, name, description, markdown instructions, provenance, and optional parent skill ids. V1 stores skill markdown inline in the public profile; future versions can split skill packages into separate 0G Storage URIs with their own content hashes.
- **Public discovery, authorized invocation.** Anyone can browse an agent's public skill packages. Owners can unlock and invoke their own agents directly. Non-owners can invoke an agent only if authorized on-chain via ERC-7857 usage authorization, and the invocation must run through an authorized runtime that returns outputs without exposing the private worldview.
- **Usage and breeding are separate permissions with separate fees.** Usage authorization allows skill invocation. Breeding authorization allows the agent to be used as a parent in sealed breeding. Owners can set different fee terms for each. Paying a fee grants the corresponding authorization but does not transfer ownership or reveal the private worldview.
- **Authorized runtime is the seam for safe third-party use.** The runtime checks ownership or `authorizedUsersOf(tokenId)`, fetches encrypted private worldview bytes from 0G Storage, decrypts inside the runtime, invokes the selected skill, and returns only the response. V1 may use a stub runtime for demo purposes; production swaps this for 0G Sealed Inference / a TEE-backed sealed executor.
- **Authorized breeding runtime is the seam for safe derivative creation.** The runtime checks ownership or breeding authorization for both parent token IDs, loads/decrypts parent private worldviews internally, synthesizes the child genome, encrypts the child to the breeder's key, and returns child mint artifacts without revealing either parent's private worldview.
- **Breeding is a Genetic Crossover Oracle.** Two computations happen in the breeding pipeline:
  1. **Worldview synthesis** (on 0G Compute) for the private qualitative fields.
  2. **Skill-package synthesis** for public capabilities. The child does not automatically inherit the union of parent skills. The breeding process chooses the skills that make sense for the newly synthesized child: it may inherit some parent skills unchanged, adapt some, synthesize new hybrid skills, and drop skills that do not fit the child's identity.
- **Genesis from text extracts both halves of the genome in one LLM call.** The structured extraction prompt asks for both qualitative private worldview fields and 3-5 public skill packages the source text plausibly supports.
- **Breeding produces a coherent child skill set.** The child should usually have 3-6 skills total. At least one skill should be adapted or synthesized when the parents have meaningfully different capabilities. Each child skill records provenance through `source` and `parentSkillIds`.

### Modules to build/modify

- **Crypto helpers** (new module). Pure functions: AES-GCM encrypt/decrypt, signature-derived-key helper (`deriveKey(walletSignature) → AES key`), SHA-256 helpers. Browser-friendly (SubtleCrypto). **No ECIES in V1** — the unlock flow uses a deterministic signed-message → key derivation pattern that works with standard wallets without exposing private keys to JavaScript.
- **`AgentArchive` extension** (modify): grow to support both halves of the schema. `storePublic(profile)` returns `{uri, hash}` (plaintext bytes). `storePrivate(worldview, encryptionKey)` returns `{uri, dataHash}` (AES-GCM ciphertext bytes). `loadPublic(uri)` and `loadPrivate(uri, encryptionKey)` are the inverses. The interface absorbs encryption transparently; existing consumers don't change shape.
- **0G Storage adapter** (new). Implements the existing byte-shaped `StorageProvider` against `@0glabs/0g-ts-sdk`. Reference patterns: `.0g-skills/skills/storage/upload-file/SKILL.md` and `.0g-skills/skills/storage/download-file/SKILL.md`. Verified by an integration test (gated by env var) that round-trips bytes against the live testnet.
- **0G Compute LLM provider** (new). Implements the existing `LLMProvider` interface against `@0glabs/0g-serving-broker`. Reference pattern: `.0g-skills/skills/compute/streaming-chat/SKILL.md`. Used for the breeding-synthesis call. OpenRouter remains the default for any non-synthesis LLM use, as a reliability hedge. Critical SDK rules to follow: `processResponse()` after every inference, `ChatID` extraction order, ledger/service tuple-not-object indexing.
- **ERC-7857 + lineage contract** (replaces current ERC-721). Minimal `IERC7857`-compliant contract written ourselves on top of the existing `mintGenesis`/`mintChild`/`lineage` extensions. Stub `TEEVerifier` with a single ECDSA signer address. Does not require a real TEE; the verifier only matters for `iTransferFrom`/`clone`, which the demo does not exercise.
- **Stub TEE oracle signer** (new Node.js script). Off-chain process with a known private key that signs `dataHash`-style payloads in the format the deployed `TEEVerifier` accepts.
- **Skill-package synthesis service** (new). Given both parent public profiles, both parent private worldviews, and the synthesized child worldview, produces the child's public skill packages. The service decides which parent skills to inherit, adapt, synthesize, or drop based on coherence with the child agent. This is a deep module with a simple interface so prompt internals can change without reshaping callers.
- **Genesis API route + UI (user-facing)** (new). `POST /api/genesis` (SSE response) takes name + source text + owner's unlock signature; pipeline: derive AES key → `createAgentFromText` → split into `PublicProfile` + `PrivateWorldview` → encrypt private with the derived key → upload encrypted bytes to 0G Storage → upload public profile to 0G Storage as plaintext → return `{tokenId, publicUri, privateUri, dataHash, mintCalldata}`. The user signs the mint TX themselves. The frontend has a paste-text page that drives this.
- **Breeding pipeline** (new SSE API route + service). For self-owned parents, the Genetic Crossover Oracle can receive already-decrypted parent private worldviews from the client. For third-party parents, it must use the authorized breeding runtime: check owner/breeding authorization, load/decrypt parent private worldviews internally, synthesize the child private worldview and public skill packages, encrypt private to the breeder's key, upload both halves, and return mint-transaction prep. Streams progress events including `synthesizing-worldview`, `synthesizing-skills`, `encrypting`, `uploading`, and `ready`.
- **Wallet connect + unlock flow** (new). RainbowKit + wagmi configured for 0G Galileo. Unlock works by `personal_sign(deterministicMessage)` → SHA-256 of the signature is the AES key for that agent. Same wallet + same message = same key, deterministically. Decrypted worldview lives in React state, never persisted. The deterministic message includes the agent's token ID so each agent has its own independent key (compromising one agent's signature doesn't compromise another's).
- **Skill invocation flow** (new). Owners can unlock an agent locally, select a public skill package, supply task input, and call the LLM with private worldview + selected skill markdown + user input. Authorized non-owners use the authorized runtime path: the caller supplies token id, skill id, and input; the runtime checks on-chain authorization and executes without exposing the private worldview.
- **Authorized agent runtime** (new). Deep module with a small interface: `invoke({tokenId, callerAddress, skillId, input}) -> response`. It depends on chain reads, storage, archive/crypto, and LLM provider adapters. The V1 stub can hold demo/runtime key material server-side and must be documented as non-production; the production implementation uses sealed execution.
- **Authorization marketplace contract surface** (new). Contract stores per-agent usage and breeding fees, lets users pay those fees to receive the matching authorization, and lets owners revoke authorizations. V1 can use direct owner-set ETH-denominated fees; richer royalty splits and subscriptions are out of scope.
- **Frontend skeleton** (new). Next.js layout, agent gallery (any-visitor view of all minted agents using public-profile data only), genesis page (paste-text → mint flow), skill package list, owner-only skill invocation panel, worldview card component (public part visible to all, private part visible after unlock), breed flow, mint flow, lineage display, link-to-explorer.
- **Contract deploy script** (new). Deploys `TEEVerifier` first, then `ThoughtLineAgent` with that verifier address. Writes both addresses to a `.env` file and to the frontend config.

### Schema changes

- **Split `Worldview` into `PublicProfile` and `PrivateWorldview`.** The previous monolithic `Worldview` Zod schema becomes two:
  - `PublicProfile`: `{ name, description, skills: SkillPackage[], generation, parentIds }` — plaintext, visible to anyone via `tokenURI`.
  - `PrivateWorldview`: `{ values, heuristics, blindspots, decisionStyle, freeform }` — encrypted, owner-only.
- **`AgentMetadata` becomes `{ publicProfile, privateWorldview }`** during in-memory construction; on storage they split into two URIs (one plaintext, one ciphertext).
- **`SkillPackage` is a public capability package.** It contains a stable id, name, short description, `SKILL.md`-style markdown instructions, a source (`genesis`, `inherited`, `adapted`, or `synthesized`), and zero or more parent skill ids for provenance.
- **Skill markdown is public in V1.** It should contain enough procedural detail to make the capability concrete, but not private worldview data. Invocation gets its personality and judgment style from the encrypted worldview at runtime.
- The `decisionStyle` enum stays as-is; revisit only if it becomes a real friction point during demo content authoring.
- On-chain ERC-7857 storage carries two pointers per agent: a public-profile URI (plaintext on 0G) and a private-worldview URI (ciphertext on 0G). The `dataHash` field of the private side is the SHA-256 of the ciphertext — that's the value judges can verify out-of-band.

### API contracts

- `POST /api/genesis` (SSE response). Request: `{name, sources, ownerAddress, unlockSignature}`. Pipeline: derive AES key from `unlockSignature` → `createAgentFromText` → split → encrypt private → upload both halves → return mint calldata. Streams events for each step. Client signs the mint TX.
- `POST /api/breed` (SSE response). Request: `{parentTokenIdA, parentTokenIdB, parentPrivateWorldviewA, parentPrivateWorldviewB, ownerAddress, unlockSignature}`. Streams events: `{type: "synthesizing-worldview"}` | `{type: "synthesizing-skills", childSkills}` | `{type: "encrypting"}` | `{type: "uploading", uri}` | `{type: "ready", mintCalldata}`. Client signs the mint TX itself.
- `GET /api/agents` returns every minted agent's public profile (token ID, name, description, skill packages, generation, parentIds, owner address, public profile URI, private worldview URI, dataHash). All visitors get the same response — no auth required.
- `POST /api/invoke-skill`. Owner-unlocked request: `{privateWorldview, publicProfile, skillId, input}` (private worldview already decrypted client-side). Response: `{response}` from the LLM.
- `POST /api/agents/:tokenId/invoke`. Authorized runtime request: `{callerAddress, skillId, input}`. The runtime verifies that `callerAddress` is the owner or an authorized user on-chain, loads/decrypts the private worldview internally, invokes the skill, and returns `{response}` without returning private worldview data.
- `POST /api/agents/:tokenId/pay-usage` prepares or sends a transaction that pays the owner's usage fee and grants usage authorization.
- `POST /api/agents/:tokenId/pay-breeding` prepares or sends a transaction that pays the owner's breeding fee and grants breeding authorization.
- `POST /api/breed-authorized` request: `{parentTokenIdA, parentTokenIdB, callerAddress, unlockSignature}`. The runtime verifies the caller owns or has breeding authorization for both parents, performs sealed/stub breeding internally, and returns child mint artifacts without returning parent private worldviews.

### Deployment target

- Web: Vercel.
- Contracts: 0G Galileo testnet (chain 16602, RPC `https://evmrpc-testnet.0g.ai`).
- Storage: 0G Storage on Galileo testnet.

## Testing Decisions

A good test exercises only the **interface** of a module, not its implementation. Tests should survive a re-implementation of the module without changing. The interface is the test surface; if a test breaks because internals were refactored, the test was wrong.

Tests already in the codebase use `vitest` + hand-rolled fakes for `LLMProvider`/`StorageProvider`. They mock at the module-interface boundary, never at lower levels. New tests should follow this pattern.

### Modules to be tested

- **Crypto helpers** — vitest. Roundtrip tests: encrypt then decrypt yields the original bytes; seal then unseal yields the original key. Tampered ciphertext fails decryption. Hash is stable. These are pure functions; tests are fast and high-leverage.
- **Skill-package synthesis** — vitest with fake LLM provider. Given parent public profiles, parent private worldviews, and a child worldview, it returns a bounded coherent child skill list. Tests assert output shape, provenance rules, source labels, no private-worldview leakage into public skill markdown, and fallback behavior when the LLM returns invalid skill JSON.
- **Skill invocation prompt assembly** — vitest. Given a private worldview, public profile, selected skill package, and user input, it builds the expected LLM request without exposing unrelated private fields or ignoring the selected skill.
- **Authorized agent runtime** — vitest with fake chain, storage/archive, and LLM adapters. Covers owner access, authorized-user access, unauthorized rejection, and response-only output with no private worldview leakage.
- **Authorized breeding runtime** — vitest with fake chain, storage/archive, and LLM adapters. Covers self-owned parent access, paid breeding authorization, unauthorized rejection, child artifact output, and no parent-private-worldview leakage.
- **Authorization fee contract behavior** — Hardhat tests. Covers setting usage/breeding fees, paying exact fees, rejecting underpayment, granting only the paid authorization type, owner withdrawals, and revocation.
- **`AgentArchive` (with `CryptoProvider`)** — vitest. Round-trip tests with a stub `CryptoProvider` that has known behavior, plus the existing tests against a passthrough crypto. The integration of crypto + serialization + storage is the surface that matters; bugs here are silent and ruinous.
- **0G Storage adapter** — vitest with an environment-gated integration test (`VITEST_0G=1`). Round-trips bytes against the actual testnet. Skipped in normal CI runs to keep the suite fast.
- **0G Compute LLM provider** — vitest with the same env-gated integration pattern. Calls a small chat completion against the real testnet to verify the SDK glue holds.
- **ERC-7857 + lineage contract** — Hardhat tests. Covers: `mintGenesis` produces a token; `mintChild` mints a child for existing parent token IDs without requiring parent ownership; lineage is queryable; `IERC7857` interface is supported via `supportsInterface`. Does not exhaustively test ERC-7857 conformance — that is out of scope.

### Modules NOT to be tested (with rationale)

- **Stub TEE oracle signer** — covered by the contract test's verifier flow.
- **Breeding pipeline (SSE)** — the synthesis logic is already covered by `createAgentFromBreeding` tests; the SSE plumbing is verified manually during integration.
- **Demo-agent setup** — the developer creates demo agents via the live UI before recording. Not a script, just usage of the user-facing flow.
- **Wallet connect / unlock flow** — UI; manual verification.
- **Frontend skeleton** — UI; manual verification.
- **Contract deploy script** — run-once script.

### Prior art for tests

- `apps/web/src/lib/llm/__tests__/provider.test.ts` — hand-rolled `LLMProvider` fake pattern.
- `apps/web/src/lib/storage/__tests__/storage.test.ts` — byte-roundtrip pattern for the new bytes-shaped storage interface.
- `apps/web/src/lib/agent-archive/__tests__/agent-archive.test.ts` — round-trip-through-composition pattern; the model new tests should follow when adding `CryptoProvider`.

## Out of Scope

- **Real Sealed Inference / TEE-attested breeding and third-party invocation.** V1 ships the architecture (stub `TEEVerifier` on-chain + services that conform to the same interfaces), but the breeding service and authorized runtime may run as normal server code for the hackathon. Production path: swap these services for TEE-attested / 0G Sealed Inference execution. The README will state this gap explicitly so judges grade honestly.
- **Real ECIES seal-to-wallet-pubkey.** V1 uses signature-derived AES keys (deterministic `personal_sign` → SHA-256 → key) because standard browser wallets don't expose private keys to JavaScript. Production path: a wallet that exposes pubkey-encryption (e.g. Lit Protocol, BLS-key wallet) lets us seal directly to an immutable pubkey. The `AgentArchive` interface accepts an opaque encryption key, so swapping the derivation strategy is local.
- **Real TEE / ZKP oracle for transfer.** The stub ECDSA signer is sufficient for hackathon submission; data transfer between owners is not part of the demo flow.
- **SIWE / authenticated backend sessions.** Wallet connect + per-action signing only.
- **Multi-turn chat history persistence.** Decision prompts are one-shot; no Postgres chat table for the hackathon.
- **Genesis-via-interview path.** Genesis-from-text is the only V1 creation path.
- **Pre-seeded parent system.** No parent agents are seeded by the deployer in V1. Demo agents are user-created using the same flow visitors use.
- **Cross-user breeding without shared decryption** (Alice breeds her agent with Bob's where Bob hasn't unlocked his agent's private worldview to her). Architecturally possible — anyone can call `mintChild(parentA, parentB)` — but the breeding pipeline requires *both* parents' private worldviews to be available decrypted. For V1 the demo focuses on self-breeding (own × own); cross-user breeding works only if both owners cooperate to share decrypted worldviews, and that flow is not built in V1.
- **Multi-generation tournaments / evolutionary selection.** Considered and explicitly rejected in scoping; if a demo task is reintroduced later, this PRD does not commit to it.
- **Agent transfer between owners.** ERC-7857 `iTransferFrom` is implemented to satisfy the interface but not exercised in the demo.
- **Track-record / reputation primitives** (the "iNFT carries a record of judgments over time" idea). Future direction; not for the hackathon.
- **Advanced monetization.** V1 supports direct usage and breeding fees. Subscriptions, royalty splits, usage metering, auctions, revenue sharing across ancestor lineages, and marketplace discovery/ranking are future work.
- **Async job queue (Inngest / Trigger.dev).** SSE in a single API route is the chosen alternative.
- **Postgres for any path on the demo critical path.** The Drizzle schema remains in the repo as scaffolding; no API route writes to it for V1.
- **Eliza OS character export.** Outputting a bred agent's worldview as an Eliza-OS-compatible character JSON would be a credible portability story, but it's a future direction — not for V1.
- **Unsafe public skill invocation for non-owners.** Anyone can inspect public skill packages, but non-owner invocation must require on-chain usage authorization and runtime-side execution. The app must not hand a non-owner the decrypted private worldview. Public previews or canned sample outputs are polish, not V1 scope.
- **Full LLM weight-merging.** Hackathon-grade breeding operates on the structured genome (private worldview + public skill packages), not on neural weights. Real weight-merging is a research-grade problem.
- **Skill-market mechanics and evolutionary selection.** The genome supports capability inheritance across generations, but marketplace pricing, rankings, multi-generation tournaments, and selection pressure are not part of V1.

## Further Notes

- **Submission deadline:** ~5 days from 2026-04-28 (i.e., ~2026-05-04). Solo build with Claude Code. ~80 hours of effective working time accounting for sleep + buffer.
- **Demo content is parked.** This PRD covers everything *except* the specific demo task (the dilemma posed to agents and the comparison of responses). Three thesis directions were explored and rejected during scoping: capability-win-against-parents, synthesis-of-disagreement with archetype parents, evolutionary tournament. Pinning the demo task is a follow-up, not a blocker on the architecture/integration work in this PRD.
- **The 0G reference implementation is at `github.com/0gfoundation/0g-agent-nft`** (~1,200 lines, upgradeable proxies). For the hackathon I'm writing a minimal `IERC7857` implementation myself (Path B from scoping) rather than forking the full reference, because the reference's upgradeable beacon proxy + role hierarchy is overhead I won't use, and the existing `mintGenesis`/`mintChild`/`lineage` work composes cleanly into a from-scratch implementation.
- **The architectural refactor done before this PRD** (byte-shaped storage, `AgentArchive`, `forgeAgent`) means the encryption + 0G Storage + 0G Compute work all plug into existing seams without re-shaping any consumer. That refactor is the reason a 5-day timeline is realistic.
- **The "Genetic Crossover Oracle" framing** is load-bearing for the pitch even though V1's "oracle" is a normal API route. The on-chain integration (stub `TEEVerifier`, ERC-7857 conformance, content-addressable `dataHash`) is the same shape required to swap in a real TEE-attested breeding service later. Stating this clearly is the difference between an honest narrative and an overclaim.
- **The skill-package idea evolved** from a separate ERC-7857 design conversation that proposed a `genome: {personality, skills, memory_fragment_cid}` shape. We first considered numeric skill vectors, then replaced them with project-native skill packages modeled after Claude Code / Codex skills. This makes breeding functional rather than merely visual: a child agent gets a coherent set of invokable capabilities, some inherited, adapted, or synthesized from parent skills. The conversation also referenced `0g-agent-skills` and `OpenClaw`; `0g-agent-skills` turned out to be a real and useful 0G repo (now cloned to `.0g-skills/` for SDK-pattern reference), `OpenClaw` is still unverified and not relied upon.
- **0G SDK references.** Storage: `@0glabs/0g-ts-sdk`. Compute: `@0glabs/0g-serving-broker`. Reference patterns lifted from `.0g-skills/skills/storage/upload-file/`, `.0g-skills/skills/storage/download-file/`, and `.0g-skills/skills/compute/streaming-chat/`. Critical SDK gotchas to respect: `processResponse()` after every compute inference; `ChatID` extraction from `ZG-Res-Key` header first; ethers v6 only; tuple-not-object indexing on `listService()` and `getLedger()`; always close `ZgFile` handles in a `finally` block.
