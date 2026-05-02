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

Ship an end-to-end tracer-bullet through the full stack: a **fully user-created agent system** where any visitor can connect a wallet, paste a chunk of source text, and mint an ERC-7857 iNFT advisor agent whose worldview is encrypted on 0G Storage; then **browse a public gallery of other people's minted agents**, inspect their public profiles without a wallet, and **breed any two agents** via a Genetic Crossover Oracle that synthesizes a child by combining qualitative reasoning (LLM synthesis on 0G Compute) with project-native skill-package inheritance, encrypts the child, uploads to 0G, and mints a child iNFT on 0G Galileo testnet with on-chain lineage pointers. A live demo URL where a viewer can witness the pipeline run, browse other agents, and click through to verify the iNFT on the 0G explorer.

The genome shape is hybrid AND split:

- **Public profile** (plaintext, fetchable by anyone, lives in standard ERC-721 `tokenURI` form): `name, description, skills, generation, parentIds`. Skills are project-native skill packages, modeled after Claude Code / Codex skills: each public skill has a stable id, name, description, `SKILL.md`-style markdown instructions, provenance, and optional parent skill ids. The skill list is intentionally public because it makes the agent's capabilities discoverable in the gallery.
- **Private worldview** (encrypted ciphertext on 0G Storage, owner-unlocked): `values, heuristics, blindspots, decisionStyle, freeform persona`. This is the *reasoning fingerprint* — the part that's gated to ownership. Anyone fetching the 0G Storage URI sees ciphertext; only the owner, who can re-sign the deterministic unlock message with their wallet, recovers the AES key.

The private half captures *how* an agent reasons; the public skill packages describe *what the agent can do*. Users interact with an agent through a conversation-first "Ask" surface. Skills are available inside that conversation as slash commands (`/decision-review`) and as routing metadata the runtime may choose automatically when the user does not explicitly pick a skill. Anyone can inspect an agent's skills, but there is no free public-preview ask path: unauthenticated or unauthorized viewers can browse, verify, view lineage, and request/pay for access, but they cannot generate agent responses. The owner can unlock and converse with the agent directly. Other users can converse with it only if the owner grants on-chain usage authorization, and the conversation runs through an authorized runtime that does not reveal the decrypted worldview to the caller. Breeding authorization is separate from usage authorization, because deriving a child from an agent is a stronger right than asking the agent a question.

There are no pre-seeded parents in the contract or codebase. Demo agents shown on the live URL are simply agents the developer created from their own wallet ahead of recording, using the same user-facing genesis flow visitors will use.

The submission package consists of: deployed contract addresses (ERC-7857 + lineage + stub TEE verifier), a live demo URL, the GitHub repo with README, a 3-minute demo video, and a link to a minted child iNFT on the 0G explorer whose `dataHash` matches the SHA-256 of the encrypted private-worldview blob fetchable from its 0G Storage URI.

**On the TEE story (honest framing):** the Genetic Crossover Oracle architecture is *designed for* execution inside a Trusted Execution Environment so that parent owners do not need to trust any intermediary with their decrypted worldviews. V1 ships the on-chain hooks (a stub `TEEVerifier` contract with a single ECDSA signer the deployer controls) and the off-chain breeding service that conforms to the same interface, but the V1 breeding service runs in a normal Next.js API route — not a real enclave. The README will state this clearly: V1 demonstrates the architecture and the on-chain integration; production will swap the breeding service for a real TEE-attested service (e.g. via 0G's Sealed Inference) without changing the contract or the rest of the stack.

## User Stories

### End-user stories (the live demo)

1. As a viewer, I want to land on the live demo URL and see a gallery of every minted agent, including other people's agents, without connecting a wallet, so that I can browse before committing.
2. As a viewer, I want to see each agent's public profile (name, description, skill packages, generation, parent links) without unlocking anything, so that I can grok the agent at a glance.
2a. As a wallet-connected agent owner, I want to unlock my own agent and see its full private worldview (values, heuristics, blindspots, decision style, freeform persona), so that I have access to the reasoning fingerprint I own.
3. As a viewer, I want to inspect each agent's public skill packages, so that I can understand what concrete tasks the agent can perform before I connect a wallet.
4. As a viewer, I want to see each agent's lineage badge (genesis vs. bred-from-X-and-Y), so that I understand its provenance at a glance.
5. As a viewer, I want to click through any agent to view its iNFT on the 0G explorer (token ID, owner, dataHash, storage URI), so that I can verify the on-chain claims.
6. As a viewer, I want to fetch the raw encrypted blob from the storage URI and confirm its SHA-256 matches the on-chain `dataHash`, so that I can verify intelligence-is-embedded from the outside.
7. As a viewer, I want to see which skill packages require ownership or usage authorization, so that I understand the difference between public discovery and authorized conversation.
8. As a viewer, I want to understand that public skill packages are discoverability metadata, not a free preview path, so that I know I need ownership or usage authorization to ask the agent.
9. As an iNFT owner, I want to have a multi-turn conversation with my unlocked agent, grounded in its private worldview, so that I can use the reasoning fingerprint I own.
10. As an iNFT owner, I want to type `/` in the conversation box and pick one of my agent's public skill packages for the next message, so that I can deliberately ask the agent to use a concrete capability.
11. As an iNFT owner, I want the runtime to automatically choose a relevant skill when I do not slash-select one, and show the used skill subtly after the response, so that the agent feels natural while its capabilities remain legible.
12. As an iNFT owner, I want to ask meta-questions about my agent's worldview (values, blindspots, decision style, what would change its mind), so that unlock feels like access to an owned mind rather than just a raw data reveal.
13. As an iNFT owner, I want conversation state to stay in browser memory only for V1, so that multi-turn interaction works without creating a persisted chat-history system or mutating the agent genome.
14. As an iNFT owner, I want to authorize another wallet to use my agent without transferring ownership, so that I can share or monetize access while keeping control.
15. As an authorized user, I want to converse with another user's agent through a runtime that checks on-chain authorization and returns only assistant messages, so that I can benefit from the agent without receiving its private worldview.
16. As an authorized user, I want the runtime to use the private worldview internally without letting me extract raw values, heuristics, blindspots, decision style internals, or freeform persona text, so that usage access does not become private genome exfiltration.
17. As an iNFT owner, I want to revoke another wallet's usage authorization, so that I can stop access without affecting ownership.
18. As an iNFT owner, I want to set separate fees for usage and breeding authorization, so that lightweight interaction and derivative creation can be priced differently.
18a. As an iNFT owner, I want to set usage and breeding fees in ETH decimal amounts from the app, so that I do not need contract-console calls for demo setup.
18b. As an iNFT owner, I want setting a fee to zero to clearly disable payment-based access for that access type, so that zero is not mistaken for free access.
19. As a user, I want to pay to use another user's agent and wait for on-chain confirmation, so that I can become authorized before asking the agent.
20. As an iNFT owner, I want to authorize breeding separately from usage, so that someone who can chat with my agent cannot automatically create derivative children from it.
20a. As an authorized non-owner, I want the same slash-skill conversation panel shape as owners, without any worldview display, so that authorized conversation feels first-class while private data stays hidden.
21. As a wallet-connected user, I want to paste a chunk of source text on a genesis page, watch the agent get synthesized live (via SSE), and mint it as my own iNFT, so that I can put my own values onto the chain.
22. As a wallet-connected user, I want to select any two minted agents I have access to and click "Breed", so that I can synthesize a child. (When the parents include another user's agent, breeding requires me to also own/unlock that parent's private worldview — for V1 the demo focuses on self-breeding own × own.)
23. As a wallet-connected user, I want to watch the breeding pipeline stream progress events live (worldview synthesis, skill synthesis, encryption, upload, mint-tx), so that I trust the system is doing real work.
24. As a wallet-connected user, I want to see the child's skill packages appear with provenance back to parent skills, so that genetic crossover is legible as concrete inherited, adapted, or newly synthesized capabilities.
25. As a wallet-connected user, I want to confirm a wallet transaction to mint the child iNFT, so that I own the child on-chain.
26. As an iNFT owner, I want to sign a wallet message to unlock and view my agent's full worldview client-side, so that the intelligence is gated to ownership.
27. As an iNFT owner, I want my agent to retain its identity across page reloads (recoverable from chain + storage), so that ownership is durable.
28. As a viewer, I want to see the lineage tree expand after a breed, so that the parent-child relationship is visually anchored.

### Hackathon-judge stories (submission compliance)

29. As a hackathon judge, I want a public GitHub repo with a README and setup instructions, so that I can reproduce the project.
30. As a hackathon judge, I want the deployed contract addresses listed in the README, so that I can inspect them on-chain.
31. As a hackathon judge, I want a link to at least one minted child iNFT on the 0G explorer, so that I can confirm the project produced real on-chain artifacts.
32. As a hackathon judge, I want documented proof that the intelligence/memory is embedded (the encrypted-blob-hash-matches-on-chain-dataHash story), so that the iNFT requirement is satisfied.
33. As a hackathon judge, I want an explicit explanation of the V1 TEE-stub vs. production-Sealed-Inference gap in the README, so that I can grade the design honestly without confusion about what is implemented.
34. As a hackathon judge, I want a list of the 0G features used (Storage, Compute, iNFT/ERC-7857), so that I can score on platform integration.
35. As a hackathon judge, I want a 3-minute demo video, so that I can grade quickly.
36. As a hackathon judge, I want a live demo URL, so that I can interact with the project myself.

### Developer/operator stories

37. As the developer, I want my own demo agents (created via the user-facing genesis flow with my own wallet) minted on the live testnet before the video shoot, so that the gallery is populated and the breeding demo has compelling parents to work with on first load.
38. As the developer, I want a contract-deploy script targeting 0G Galileo testnet, so that I can deploy and redeploy with a single command.
39. As the developer, I want a stub TEE-oracle signer that runs as a Node script with a configurable private key, so that I can sign proofs the verifier accepts without a real TEE for the hackathon.
40. As the developer, I want a clear seam where AES-GCM crypto and the V1 signature-derived-key strategy plug into `AgentArchive`, so that swapping in a different key-derivation strategy (e.g. real ECIES seal-to-pubkey post-hackathon) does not require re-shaping any consumer.
41. As the developer, I want all integration points to 0G (Storage, Compute) implemented behind interfaces that already exist (`StorageProvider`, `LLMProvider`), so that the rest of the codebase doesn't know which provider is in use.
41a. As the developer/operator, I want the demo app to use 0G Compute for every production LLM path (genesis, owner conversation, slash-skill use, authorized ask, and breeding), so that the submission can honestly claim all agent intelligence calls run through 0G Compute.
41b. As the developer/operator, I want a working 0G Galileo testnet Direct Compute configuration even if Router testnet keys are unavailable or incompatible, so that the live demo can proceed using faucet-funded testnet OG.
41c. As the developer/operator, I want a Router adapter retained behind the same provider interface, so that switching to the broader Router model catalog later is an environment change once valid Router credentials are available.
42. As the developer, I want skill-package selection and synthesis to be isolated behind a testable service boundary, so that breeding can create coherent child capabilities without coupling the rest of the app to prompt internals.
43. As the developer, I want authorized third-party conversation isolated behind a runtime interface, so that V1 can use a clearly labeled stub runtime and production can swap in 0G Sealed Inference / TEE execution without reshaping the app.

## Implementation Decisions

### Architecture (already locked, foundations done)

- **Tracer bullet over depth-first**: end-to-end vertical slice ahead of polish on any one piece.
- **`StorageProvider` is byte-shaped** (`upload(bytes) → {uri, hash}`, `fetch(uri) → bytes`). Adapters know nothing about agent metadata or encryption. *(Done.)*
- **`AgentArchive` is the deep module** that owns serialization-and-storage composition and produces the `dataHash` that goes on-chain. *(Done; will grow a `CryptoProvider` dependency.)*
- **`forgeAgent` is the shared envelope** around new-agent creation. Both `createAgentFromText` and `createAgentFromBreeding` are thin wrappers. *(Done.)*
- **No SIWE.** Wallet connect via RainbowKit; per-action signing for the unlock flow only. Owner conversation receives decrypted worldview from the frontend in-memory.
- **No async job queue (no Inngest / Trigger.dev).** Breeding pipeline streams progress to the client over Server-Sent Events from a single Next.js API route.
- **Fully user-created agents** — no pre-seeded parents in V1. Any visitor can connect a wallet, paste source text, and mint an agent. Genesis-from-text is the front door of the app. Genesis-from-interview remains out of scope.
- **Demo agents are just user-created agents the developer made earlier** from their own wallet. The live demo's gallery shows whatever agents have been minted; nothing in the contract or app distinguishes "demo" from "user" agents.
- **Schema is split into public profile + private worldview.** The public half (name, description, skill packages, generation, parentIds) lives in plaintext via `tokenURI` and is visible to any visitor. The private half (values, heuristics, blindspots, decisionStyle, freeform persona) is encrypted on 0G Storage and gated to the owner's wallet signature.
- **Hybrid genome (private worldview + public capabilities).** Private side carries qualitative fields (values, heuristics, blindspots, decision style, freeform). Public side carries `SkillPackage[]`: named, invokable, `SKILL.md`-style capability packages. The private side captures *how* an agent reasons; the public side describes *what the agent can do*.
- **Skills are project-native skill packages.** A skill package is the ThoughtLine equivalent of a Claude Code / Codex skill: stable id, name, description, markdown instructions, provenance, and optional parent skill ids. V1 stores skill markdown inline in the public profile; future versions can split skill packages into separate 0G Storage URIs with their own content hashes.
- **Conversation-first interaction.** The primary way to use an agent is to ask it in a multi-turn conversation. Owner conversations use the decrypted private worldview after unlock. Authorized non-owner conversations run through the authorized runtime. Conversations are in-memory only in V1: reload clears the transcript, no Postgres or 0G chat history is written, and conversation transcripts do not mutate the agent genome or affect breeding.
- **Skills are slash commands and routing metadata.** `SkillPackage[]` remains public. In the conversation box, typing `/` opens a dropdown of the agent's public skills. Selecting one applies that skill to the next user message only. If the user does not select a slash skill, the runtime may automatically route the message to a relevant skill or answer directly from the private worldview. Each assistant response may include `usedSkillId` so the UI can show `Used /skill-id` quietly.
- **Public discovery, authorized conversation.** Anyone can browse an agent's public skill packages. Unauthenticated or unauthorized viewers cannot ask the agent or run a public-preview response. Owners can unlock and converse with their own agents directly. Non-owners can converse with an agent only if authorized on-chain via ERC-7857 usage authorization, and the conversation must run through an authorized runtime that returns assistant messages without exposing the private worldview.
- **Usage and breeding are separate permissions with separate fees.** Usage authorization allows agent conversation through the authorized runtime. Breeding authorization allows the agent to be used as a parent in sealed breeding. Owners can set different fee terms for each. Paying a fee grants the corresponding authorization but does not transfer ownership or reveal the private worldview.
- **Authorized runtime is the seam for safe third-party use.** The runtime checks ownership or `authorizedUsersOf(tokenId)`, fetches encrypted private worldview bytes from 0G Storage, decrypts inside the runtime, routes each user message to an explicit slash-selected skill, an auto-selected skill, or direct worldview-grounded answering, and returns only assistant messages plus optional `usedSkillId`. V1 may use a stub runtime for demo purposes; production swaps this for 0G Sealed Inference / a TEE-backed sealed executor.
- **Authorized conversations are privacy-filtered.** Usage authorization permits benefiting from the agent's judgment, not extracting its private genome. Owner conversations may reveal raw `PrivateWorldview` fields. Authorized non-owner conversations must not reveal or quote hidden values, heuristics, blindspots, decision style internals, or freeform persona text; meta-questions should be answered at a high level or refused when they attempt extraction.
- **Authorized breeding runtime is the seam for safe derivative creation.** The runtime checks ownership or breeding authorization for both parent token IDs, loads/decrypts parent private worldviews internally, synthesizes the child genome, encrypts the child to the breeder's key, and returns child mint artifacts without revealing either parent's private worldview.
- **Breeding is a Genetic Crossover Oracle.** Two computations happen in the breeding pipeline:
  1. **Worldview synthesis** (on 0G Compute) for the private qualitative fields.
  2. **Skill-package synthesis** for public capabilities. The child does not automatically inherit the union of parent skills. The breeding process chooses the skills that make sense for the newly synthesized child: it may inherit some parent skills unchanged, adapt some, synthesize new hybrid skills, and drop skills that do not fit the child's identity.
- **Genesis from text extracts both halves of the genome in one LLM call.** The structured extraction prompt asks for both qualitative private worldview fields and 3-5 public skill packages the source text plausibly supports.
- **Breeding produces a coherent child skill set.** The child should usually have 3-6 skills total. At least one skill should be adapted or synthesized when the parents have meaningfully different capabilities. Each child skill records provenance through `source` and `parentSkillIds`.

### Modules to build/modify

- **Crypto helpers** (new module). Pure functions: AES-GCM encrypt/decrypt, signature-derived-key helper (`deriveKey(walletSignature) → AES key`), SHA-256 helpers. Browser-friendly (SubtleCrypto). **No ECIES in V1** — the unlock flow uses a deterministic signed-message → key derivation pattern that works with standard wallets without exposing private keys to JavaScript.
- **`AgentArchive` extension** (modify): grow to support both halves of the schema. `storePublic(profile)` returns `{uri, hash}` (plaintext bytes). `storePrivate(worldview, encryptionKey)` returns `{uri, dataHash}` (AES-GCM ciphertext bytes). `loadPublic(uri)` and `loadPrivate(uri, encryptionKey)` are the inverses. The interface absorbs encryption transparently; existing consumers don't change shape.
- **0G Storage adapter** (implemented). Implements the existing byte-shaped `StorageProvider` against `@0glabs/0g-ts-sdk`. Reference patterns: `.0g-skills/skills/storage/upload-file/SKILL.md` and `.0g-skills/skills/storage/download-file/SKILL.md`. Verified by an integration test (gated by env var) that round-trips bytes against live Galileo storage. The adapter ignores blank storage env values, uses the default turbo indexer when unset, and wraps SDK submissions for the current Galileo Flow ABI.
- **0G Compute LLM providers** (implemented behind `LLMProvider`). The app supports three provider names: `openrouter`, `0g-router`, and `0g-compute`. `0g-router` calls the OpenAI-compatible Router at `https://router-api.0g.ai/v1` with `OG_ROUTER_API_KEY` and can target catalog models with `OG_ROUTER_MODEL`; it is retained for later production-style Router use. For the current hackathon/testnet demo, `LLM_PROVIDER=0g-compute` is the working path: it uses `@0glabs/0g-serving-broker`, a fixed `OG_COMPUTE_PROVIDER_ADDRESS`, `OG_PRIVATE_KEY`/`PRIVATE_KEY`, and `OG_RPC_URL`. The selected Galileo testnet provider is `0xa48f01287233509FD694a22Bf840225062E67836` running `qwen/qwen-2.5-7b-instruct`. Direct Compute requires the operator to create/fund a 0G Compute account, transfer at least slightly more than 1 OG to the inference provider sub-account, and acknowledge the provider signer before app startup. The adapter extracts `ChatID` from `ZG-Res-Key` first, falls back to the response `id`, and calls `processResponse(providerAddress, chatID, usageJson)` after every successful inference. In either 0G mode there is no hidden OpenRouter fallback.
- **Current LLM routing contract.** With `LLM_PROVIDER=0g-compute`, all production server-side LLM use cases route through 0G Direct Compute: genesis extraction/skill synthesis, owner conversation, slash-selected or auto-routed skill use, authorized non-owner ask, breeding worldview synthesis, and child skill synthesis. Tests may inject fake `LLMProvider` instances, but production routes create the provider from env.
- **ERC-7857 + lineage contract** (replaces current ERC-721). Minimal `IERC7857`-style contract written ourselves on top of the existing `mintGenesis`/`mintChild`/`lineage` extensions. It exposes the 0G/EIP-facing `intelligentDataOf`, `iTransfer`, `iClone`, usage authorization, delegate-access, and ERC-721 approval/ownership methods through `supportsInterface`. `iTransfer`/`iClone` verify that proof outputs match the token's current private `dataHash` before updating or cloning data. Stub `TEEVerifier` remains a hackathon verifier; the demo does not claim real enclave-backed re-encryption.
- **Stub TEE oracle signer** (new Node.js script). Off-chain process with a known private key that signs `dataHash`-style payloads in the format the deployed `TEEVerifier` accepts.
- **Skill-package synthesis service** (new). Given both parent public profiles, both parent private worldviews, and the synthesized child worldview, produces the child's public skill packages. The service decides which parent skills to inherit, adapt, synthesize, or drop based on coherence with the child agent. This is a deep module with a simple interface so prompt internals can change without reshaping callers.
- **Genesis API route + UI (user-facing)** (new). `POST /api/genesis` (SSE response) takes name + source text + owner's unlock signature; pipeline: derive AES key → `createAgentFromText` → split into `PublicProfile` + `PrivateWorldview` → encrypt private with the derived key → upload encrypted bytes to 0G Storage → upload public profile to 0G Storage as plaintext → return `{tokenId, publicUri, privateUri, dataHash, mintCalldata}`. The user signs the mint TX themselves. The frontend has a paste-text page that drives this.
- **Authorized breeding pipeline** (SSE API route + service). `POST /api/breed-authorized` is the canonical V1 breeding path. It checks owner/breeding authorization for both parent token IDs, loads V2 private-worldview envelopes internally through the authorized runtime, synthesizes the child private worldview and public skill packages, encrypts the child to the breeder's signature-derived key, uploads both halves, and returns mint-transaction prep for `mintChild`. Streams progress events including `preparing`, `loading-parents`, `synthesizing-worldview`, `synthesizing-skills`, `encrypting`, `uploading`, and `ready`. Legacy raw-ciphertext private blobs remain owner-unlockable but cannot be used by the server-side authorized breeding runtime.
- **Wallet connect + unlock flow** (new). RainbowKit + wagmi configured for 0G Galileo. Unlock works by `personal_sign(deterministicMessage)` → SHA-256 of the signature is the AES key for that agent. Same wallet + same message = same key, deterministically. Decrypted worldview lives in React state, never persisted. The deterministic message includes the agent's token ID so each agent has its own independent key (compromising one agent's signature doesn't compromise another's).
- **Agent conversation flow** (new). Owners unlock an agent locally, then converse with it using an in-memory transcript. The conversation request includes the decrypted private worldview, public profile, messages, and optional per-turn slash-selected skill id. The runtime uses private worldview + selected or auto-routed skill markdown + transcript context to produce the next assistant message.
- **Authorized agent runtime** (new). Deep module with a small interface: `ask({tokenId, callerAddress, messages, skillId?}) -> {message, usedSkillId}`. It depends on chain reads, storage, archive/crypto, privacy filtering, skill routing, and LLM provider adapters. The V1 stub can hold demo/runtime key material server-side and must be documented as non-production; the production implementation uses sealed execution.
- **Authorization marketplace contract surface** (partly built). Contract stores per-agent usage and breeding fees, lets users pay those fees to receive the matching authorization, and lets owners revoke authorizations. Web chain helpers can read authorization/fee state and prepare usage/breeding payment transactions. The next V1 slice exposes access terms through server routes, lets owners set usage and breeding fees, and lets non-owners pay usage fees with receipt polling.
- **Access terms** (new deep module/API concept). Access terms are the current usage and breeding fee/access state for one agent and one caller. The server owns chain reads and transaction-prep assembly; the browser owns wallet signing, transaction submission, receipt polling, and state refresh.
- **Frontend skeleton** (built for V1). Next.js layout, agent gallery (any-visitor view of all minted agents using public-profile data only), genesis page (paste-text → mint flow), skill package list, owner-only conversation panel with `/` skill dropdown, worldview card component (public part visible to all, private part visible after unlock), authorized non-owner ask UI, usage payment UI, owner usage/breeding fee-setting controls, authorized breeding flow, child mint flow, lineage display, explorer links, and hash-proof details exist.
- **Contract deploy script** (new). Deploys `TEEVerifier` first, then `ThoughtLineAgent` with that verifier address. Writes both addresses to a `.env` file and to the frontend config.

### Current 0G Compute demo setup

- **Active provider mode:** Direct Compute (`LLM_PROVIDER=0g-compute`).
- **Active model/provider:** `qwen/qwen-2.5-7b-instruct` via provider `0xa48f01287233509FD694a22Bf840225062E67836`.
- **Funding state used during local setup:** 3 testnet OG deposited into the 0G Compute account; 1.1 testnet OG transferred to the selected inference provider sub-account; provider signer acknowledged.
- **Router status:** The Router adapter exists and passes mocked tests. A testnet 0G Private Computer API key from `pc.0g.ai` was rejected by `https://router-api.0g.ai/v1` with `401 invalid_api_key`, so Router is not the current demo path. Keep Router support, but do not depend on it for the hackathon demo unless valid Router credentials are confirmed with a live test.
- **Operational note:** The Direct provider enforces a 1 OG locked-balance reserve plus unsettled/current request fees. Funding exactly 1 OG is insufficient; transfer a small buffer above 1 OG to the provider sub-account.

### Current 0G Storage + contract demo setup

- **Active storage mode:** 0G Storage (`STORAGE_ADAPTER=0g`) on Galileo using `https://indexer-storage-testnet-turbo.0g.ai`.
- **Deployed contracts:** `ThoughtLineAgent` at `0xCE417B89Cf7839502C3dcE93FeE4828D442bbff2`; `TEEVerifier` at `0x79860Be4236dAbA300750191Bb00Dee899d9f12C`; chain ID `16602`.
- **Live minted smoke iNFT:** token `0` on the deployed `ThoughtLineAgent`, owner `0xEf2394D6d90482A022efD14Cee906383D39A9768`.
- **Smoke artifact:** public URI `0g://0xcda254d304b1809a1b5293f4299223b1b45596b1d9a7d8d920fa9d354ab073d3`; private URI `0g://0xdb499c8ab12d6eaebd1ed93ecec506613777fc91349407429c57e0c61e39e392`; data hash `0x492a5a2895b7162243780407a9687758ddce359b4d4190b355e3f416152f448a`.
- **Proof status:** `/api/proof/private-data` returned `matches: true` for the smoke private URI and data hash; `/api/agents` recovered token `0` from chain and hydrated its public profile from 0G Storage.

### Schema changes

- **Split `Worldview` into `PublicProfile` and `PrivateWorldview`.** The previous monolithic `Worldview` Zod schema becomes two:
  - `PublicProfile`: `{ name, description, skills: SkillPackage[], generation, parentIds }` — plaintext, visible to anyone via `tokenURI`.
  - `PrivateWorldview`: `{ values, heuristics, blindspots, decisionStyle, freeform }` — encrypted, owner-only.
- **`AgentMetadata` becomes `{ publicProfile, privateWorldview }`** during in-memory construction; on storage they split into two URIs (one plaintext, one ciphertext).
- **`SkillPackage` is a public capability package.** It contains a stable id, name, short description, `SKILL.md`-style markdown instructions, a source (`genesis`, `inherited`, `adapted`, or `synthesized`), and zero or more parent skill ids for provenance.
- **Skill markdown is public in V1.** It should contain enough procedural detail to make the capability concrete, but not private worldview data. Conversation gets its personality and judgment style from the encrypted worldview at runtime.
- The `decisionStyle` enum stays as-is; revisit only if it becomes a real friction point during demo content authoring.
- On-chain ERC-7857 storage carries two pointers per agent: a public-profile URI (plaintext on 0G) and a private-worldview URI (ciphertext on 0G). The `dataHash` field of the private side is the SHA-256 of the ciphertext — that's the value judges can verify out-of-band.

### API contracts

- `POST /api/genesis` (SSE response). Request: `{name, sources, ownerAddress, unlockSignature}`. Pipeline: derive AES key from `unlockSignature` → `createAgentFromText` → split → encrypt private → upload both halves → return mint calldata. Streams events for each step. Client signs the mint TX.
- `GET /api/agents` returns every minted agent's public profile (token ID, name, description, skill packages, generation, parentIds, owner address, public profile URI, private worldview URI, dataHash). All visitors get the same response — no auth required.
- `POST /api/converse-agent`. Owner-unlocked conversation request: `{privateWorldview, publicProfile, messages, skillId?}` where `messages` is the current in-memory transcript and `skillId` is an optional slash-selected skill for the latest user message only. Response: `{message: {role: "assistant", content: string}, usedSkillId: string | null}`. The server must not persist the request, transcript, or decrypted worldview.
- `POST /api/agents/:tokenId/ask`. Authorized runtime conversation request: `{callerAddress, messages, skillId?}`. The runtime verifies that `callerAddress` is the owner or an authorized user on-chain, loads/decrypts the private worldview internally, applies privacy filtering, routes to an explicit or auto-selected skill when appropriate, and returns `{message, usedSkillId}` without returning private worldview data. Authorized callers must not be able to extract raw private worldview fields through meta-questions.
- `POST /api/breed-authorized` (SSE response). Request: `{parentTokenIdA, parentTokenIdB, callerAddress, childName, unlockSignature}`. The runtime verifies the caller owns or has breeding authorization for both parents, performs sealed/stub breeding internally, and returns child mint artifacts without returning parent private worldviews. Duplicate parent IDs are rejected before LLM invocation. Streams: `preparing`, `loading-parents`, `synthesizing-worldview`, `synthesizing-skills`, `encrypting`, `uploading`, `ready`, `error`.
- `GET /api/agents/:tokenId/access-terms?callerAddress=0x...` returns usage and breeding access state and fee values in wei strings.
- `POST /api/agents/:tokenId/access-terms` accepts `{kind: "usage" | "breeding", feeWei: string}` and returns owner-only transaction prep for `setUsageFee` or `setBreedingFee`.
- `POST /api/agents/:tokenId/pay-usage` returns transaction prep for `payForUsage`; the browser submits it, polls `eth_getTransactionReceipt`, then refetches access terms until `isAuthorizedUser` is true.
- Planned later: `POST /api/agents/:tokenId/pay-breeding` prepares a transaction that pays the owner's breeding fee and grants breeding authorization. The current demo-critical payment path is usage payment; breeding remains owners/already-authorized breeders until this route/UI is prioritized.

### Remaining V1 gaps

- **Breeding payment UI/routes.** The contract and web chain helpers support breeding fees and `payForBreeding`. The current breeding UI supports owners and already-authorized breeders; paying to become breeding-authorized is not yet exposed.
- **Direct authorization and revocation controls.** Direct grants and revocations for usage/breeding remain outside the immediate next slice.
- **Demo child artifact.** The deployed contract and app support `mintChild`, but the submission package still needs a polished minted child iNFT link after two strong demo parent agents are minted and bred.

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
- **Agent conversation prompt assembly and skill routing** — vitest. Given a private worldview, public profile, in-memory transcript, and optional slash-selected skill, it builds the expected LLM request, applies the explicit skill for one turn only, can auto-route when no skill is selected, returns `usedSkillId`, and does not ignore the selected skill.
- **Authorized agent runtime** — vitest with fake chain, storage/archive, and LLM adapters. Covers owner access, authorized-user access, unauthorized rejection, multi-turn transcript handling, slash-selected skill routing, auto-routing, response-only output, and privacy filtering that prevents private worldview extraction by authorized non-owners.
- **Authorized breeding runtime and route** — vitest with fake chain, storage/archive, and LLM adapters. Covers self-owned parent access, authorized breeder access, unauthorized rejection before LLM invocation, duplicate-parent rejection, child artifact output, SSE event order, `mintChild` calldata shape, and no parent-private-worldview leakage.
- **Access terms and payment flow** — vitest with fake chain readers/writers. Covers access state reads, disabled-fee behavior, owner fee-setting transaction prep for usage and breeding, usage payment transaction prep, and receipt/access polling behavior at the browser-helper boundary.
- **Authorization fee contract behavior** — Hardhat tests. Covers setting usage/breeding fees, paying exact fees, rejecting underpayment, granting only the paid authorization type, owner withdrawals, and revocation.
- **`AgentArchive` (with `CryptoProvider`)** — vitest. Round-trip tests with a stub `CryptoProvider` that has known behavior, plus the existing tests against a passthrough crypto. The integration of crypto + serialization + storage is the surface that matters; bugs here are silent and ruinous.
- **0G Storage adapter** — vitest with an environment-gated integration test (`VITEST_0G=1`). Round-trips bytes against the actual testnet. Skipped in normal CI runs to keep the suite fast.
- **0G Compute LLM providers** — vitest unit coverage for OpenRouter, 0G Router, and 0G Direct through the public `LLMProvider` factory. The 0G Direct tests mock `@0glabs/0g-serving-broker` at the package boundary and use MSW for the OpenAI-compatible provider endpoint. Gated live tests are available for both 0G modes; the current passing live test is `VITEST_0G_COMPUTE=1` against the funded Galileo Direct provider. Router live tests remain gated and should only be used when `OG_ROUTER_API_KEY` is known to work against `router-api.0g.ai`.
- **ERC-7857 + lineage contract** — Hardhat tests. Covers: `mintGenesis` produces a token; `mintChild` mints a child for existing parent token IDs without requiring parent ownership; lineage is queryable; `IERC7857`/metadata interface IDs are supported via `supportsInterface`; `iTransfer` and `iClone` reject stale `oldDataHash` proofs before changing ownership or minting a clone. Full real-oracle conformance remains out of scope for V1.

### Modules NOT to be tested (with rationale)

- **Stub TEE oracle signer** — covered by the contract test's verifier flow.
- **Usage/breeding payment UI** — not yet built; test when implemented.
- **Demo-agent setup** — the developer creates demo agents via the live UI before recording. Not a script, just usage of the user-facing flow.
- **Wallet connect / unlock flow** — UI; manual verification.
- **Frontend skeleton** — UI; manual verification.
- **Contract deploy script** — run-once script.

### Prior art for tests

- `apps/web/src/lib/llm/__tests__/provider.test.ts` — hand-rolled `LLMProvider` fake pattern.
- `apps/web/src/lib/storage/__tests__/storage.test.ts` — byte-roundtrip pattern for the new bytes-shaped storage interface.
- `apps/web/src/lib/agent-archive/__tests__/agent-archive.test.ts` — round-trip-through-composition pattern; the model new tests should follow when adding `CryptoProvider`.

## Out of Scope

- **Real Sealed Inference / TEE-attested breeding and third-party conversation.** V1 ships the architecture (stub `TEEVerifier` on-chain + services that conform to the same interfaces), but the breeding service and authorized runtime may run as normal server code for the hackathon. Production path: swap these services for TEE-attested / 0G Sealed Inference execution. The README will state this gap explicitly so judges grade honestly.
- **Real ECIES seal-to-wallet-pubkey.** V1 uses signature-derived AES keys (deterministic `personal_sign` → SHA-256 → key) because standard browser wallets don't expose private keys to JavaScript. Production path: a wallet that exposes pubkey-encryption (e.g. Lit Protocol, BLS-key wallet) lets us seal directly to an immutable pubkey. The `AgentArchive` interface accepts an opaque encryption key, so swapping the derivation strategy is local.
- **Real TEE / ZKP oracle for transfer.** The stub verifier is sufficient for hackathon submission; data transfer between owners is not part of the demo flow. The contract has the standard-shaped hooks and current-`dataHash` checks, but the off-chain re-encryption/storage-availability oracle is not a real TEE/ZKP service in V1.
- **SIWE / authenticated backend sessions.** Wallet connect + per-action signing only.
- **Persistent chat history.** V1 supports multi-turn conversations only in memory. Reloading clears the transcript. No Postgres chat table, no 0G conversation storage, no transcript-based genome mutation, and no use of conversation history in breeding.
- **Genesis-via-interview path.** Genesis-from-text is the only V1 creation path.
- **Pre-seeded parent system.** No parent agents are seeded by the deployer in V1. Demo agents are user-created using the same flow visitors use.
- **Legacy raw-ciphertext agents in authorized breeding.** Owner unlock still supports legacy raw ciphertext, but server-side authorized breeding requires V2 private-worldview envelopes with runtime unwrap material. Agents minted before V2 envelope support must be reminted or migrated before they can participate in authorized breeding.
- **Multi-generation tournaments / evolutionary selection.** Considered and explicitly rejected in scoping; if a demo task is reintroduced later, this PRD does not commit to it.
- **Agent transfer between owners.** ERC-7857 `iTransfer` is implemented to satisfy the interface but not exercised in the demo.
- **Track-record / reputation primitives** (the "iNFT carries a record of judgments over time" idea). Future direction; not for the hackathon.
- **Advanced monetization.** V1 supports direct usage and breeding fees. Subscriptions, royalty splits, usage metering, auctions, revenue sharing across ancestor lineages, and marketplace discovery/ranking are future work.
- **Async job queue (Inngest / Trigger.dev).** SSE in a single API route is the chosen alternative.
- **Postgres for any path on the demo critical path.** The Drizzle schema remains in the repo as scaffolding; no API route writes to it for V1.
- **Eliza OS character export.** Outputting a bred agent's worldview as an Eliza-OS-compatible character JSON would be a credible portability story, but it's a future direction — not for V1.
- **Unsafe public agent previews for non-owners.** Anyone can inspect public skill packages, but non-owner conversation must require on-chain usage authorization and runtime-side execution. The app must not hand a non-owner the decrypted private worldview and must not offer a public-preview ask path.
- **Full LLM weight-merging.** Hackathon-grade breeding operates on the structured genome (private worldview + public skill packages), not on neural weights. Real weight-merging is a research-grade problem.
- **Skill-market mechanics and evolutionary selection.** The genome supports capability inheritance across generations, but marketplace pricing, rankings, multi-generation tournaments, and selection pressure are not part of V1.

## Further Notes

- **Submission deadline:** ~5 days from 2026-04-28 (i.e., ~2026-05-04). Solo build with Claude Code. ~80 hours of effective working time accounting for sleep + buffer.
- **Demo content is parked.** This PRD covers everything *except* the specific demo task (the dilemma posed to agents and the comparison of responses). Three thesis directions were explored and rejected during scoping: capability-win-against-parents, synthesis-of-disagreement with archetype parents, evolutionary tournament. Pinning the demo task is a follow-up, not a blocker on the architecture/integration work in this PRD.
- **The 0G reference implementation is at `github.com/0gfoundation/0g-agent-nft`** (~1,200 lines, upgradeable proxies). For the hackathon I'm writing a minimal `IERC7857` implementation myself (Path B from scoping) rather than forking the full reference, because the reference's upgradeable beacon proxy + role hierarchy is overhead I won't use, and the existing `mintGenesis`/`mintChild`/`lineage` work composes cleanly into a from-scratch implementation.
- **The architectural refactor done before this PRD** (byte-shaped storage, `AgentArchive`, `forgeAgent`) means the encryption + 0G Storage + 0G Compute work all plug into existing seams without re-shaping any consumer. That refactor is the reason a 5-day timeline is realistic.
- **The "Genetic Crossover Oracle" framing** is load-bearing for the pitch even though V1's "oracle" is a normal API route. The on-chain integration (stub `TEEVerifier`, ERC-7857 conformance, content-addressable `dataHash`) is the same shape required to swap in a real TEE-attested breeding service later. Stating this clearly is the difference between an honest narrative and an overclaim.
- **The skill-package idea evolved** from a separate ERC-7857 design conversation that proposed a `genome: {personality, skills, memory_fragment_cid}` shape. We first considered numeric skill vectors, then replaced them with project-native skill packages modeled after Claude Code / Codex skills. This makes breeding functional rather than merely visual: a child agent gets a coherent set of invokable capabilities, some inherited, adapted, or synthesized from parent skills. The conversation also referenced `0g-agent-skills` and `OpenClaw`; `0g-agent-skills` turned out to be a real and useful 0G repo (now cloned to `.0g-skills/` for SDK-pattern reference), `OpenClaw` is still unverified and not relied upon.
- **0G SDK references.** Storage: `@0glabs/0g-ts-sdk`. Compute: `@0glabs/0g-serving-broker`. Reference patterns lifted from `.0g-skills/skills/storage/upload-file/`, `.0g-skills/skills/storage/download-file/`, and `.0g-skills/skills/compute/streaming-chat/`. Critical SDK gotchas to respect: the current Galileo Flow contract uses the newer wrapped submit shape while `@0glabs/0g-ts-sdk@0.3.3` still calls the older selector, so keep the local compatibility submit wrapper in the storage adapter; use one-byte upload tags (`0x00`); `processResponse()` after every compute inference; `ChatID` extraction from `ZG-Res-Key` header first; ethers v6 only; tuple-not-object indexing on `listService()` and `getLedger()`; always close `ZgFile` handles in a `finally` block.
- **0G Compute decision as of local setup.** Use Direct Compute on Galileo testnet for the demo because it has been funded, acknowledged, and live-tested successfully. Router remains useful for broader model choice later, but the testnet Private Computer key available during setup did not authenticate against the documented Router endpoint. Do not switch the demo back to Router without rerunning and passing the gated live Router test.
