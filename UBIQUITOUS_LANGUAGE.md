# Ubiquitous Language

## Agents and genomes

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Agent** | A minted iNFT advisor whose public profile and encrypted private worldview are recoverable from chain plus storage. | Bot, character, assistant |
| **iNFT** | The on-chain token representing ownership of an **Agent** and pointers to its intelligent data. | NFT, ERC-721 token |
| **Public Profile** | The plaintext, publicly fetchable half of an **Agent Genome** containing name, description, skills, generation, and parent IDs. | Public metadata, token metadata |
| **Private Worldview** | The encrypted private half of an **Agent Genome** containing values, heuristics, blindspots, decision style, and freeform persona. | Private data, memory, personality |
| **Agent Genome** | The combined **Public Profile** and **Private Worldview** that define an **Agent**. | Worldview, metadata, genome blob |
| **Skill Package** | A public, invokable capability package with id, name, description, markdown instructions, source, and parent skill provenance. | Skill, capability, tool |
| **Reasoning Fingerprint** | The privately owned judgment style encoded by the **Private Worldview**. | Intelligence, memory, personality |
| **Generation** | The ancestry depth of an **Agent**, where genesis agents are generation zero and bred children increment from parents. | Version, level |
| **Lineage** | The parent-child relationship recorded for a bred **Agent**. | Family tree, ancestry |

## Creation and breeding

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Genesis** | The creation path that mints a generation-zero **Agent** from user-provided source text. | Forge, create, seed |
| **Parent Agent** | An existing **Agent** selected as an input to breeding. | Parent, source agent |
| **Child Agent** | A newly synthesized **Agent** created from two **Parent Agents** and minted through `mintChild`. | Offspring, bred agent |
| **Breeding** | The authorized process that synthesizes a **Child Agent** from two **Parent Agents**. | Crossover, derivation |
| **Genetic Crossover Oracle** | The breeding service that synthesizes child worldview and skill packages, currently as a V1 server-side stub. | Oracle, breeding service, crossover service |
| **Worldview Synthesis** | The LLM step that creates a child **Private Worldview** from parent private worldviews. | Private synthesis |
| **Skill Synthesis** | The LLM step that creates child **Skill Packages** from parent profiles, parent skills, and the child worldview. | Capability synthesis |
| **Mint Artifact** | The prepared storage pointers, hashes, calldata, and transaction data needed for the wallet to mint an **Agent**. | Mint prep, mint transaction |

## Access and authorization

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Owner** | The wallet address that owns an **Agent** token on-chain. | User, account |
| **Viewer** | A person browsing public agent data without necessarily connecting a wallet or having authorization. | Visitor, public user |
| **Caller** | The wallet address requesting an authorized runtime action. | User, requester |
| **Authorized User** | A non-owner wallet with on-chain **Usage Authorization** for an **Agent**. | Subscriber, paid user |
| **Authorized Breeder** | A non-owner wallet with on-chain **Breeding Authorization** for an **Agent**. | Breeder, licensed breeder |
| **Usage Authorization** | The permission to converse with an **Agent** through the authorized runtime without seeing its private worldview. | Access, chat access |
| **Breeding Authorization** | The permission to use an **Agent** as a parent in authorized breeding. | Breed access, derivative access |
| **Usage Fee** | The owner-set ETH price for buying **Usage Authorization**. | Access fee, chat fee |
| **Breeding Fee** | The owner-set ETH price for buying **Breeding Authorization**. | Derivative fee, breed fee |
| **Access Terms** | The current usage and breeding fee/access state for an **Agent** and caller. | Authorization state, fee state |
| **Disabled Fee** | A zero fee value that means payment-based authorization is unavailable for that access type. | Free access, no fee |

## Conversation and runtime

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Owner Conversation** | A browser-memory conversation where the **Owner** provides a locally unlocked private worldview. | Local chat, unlocked chat |
| **Authorized Conversation** | A conversation where an **Authorized User** asks through the server-side authorized runtime and never receives private worldview fields. | Paid chat, non-owner chat |
| **Authorized Runtime** | The server-side runtime that checks on-chain authorization, loads private worldview internally, filters leakage, and returns only assistant messages. | Runtime, sealed runtime, ask service |
| **Slash-Selected Skill** | A **Skill Package** explicitly selected for the next conversation turn with `/skill-id`. | Slash command, selected skill |
| **Auto-Routed Skill** | A **Skill Package** chosen by the runtime when the caller does not slash-select one. | Automatic skill, inferred skill |
| **Used Skill ID** | The skill identifier returned with an assistant response to show which skill was applied. | Skill result, route |
| **Private Worldview Leakage** | Revealing raw private worldview fields to a caller who only has usage authorization. | Data leak, exfiltration |

## Storage and verification

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Storage Pointer** | A URI pointing to a public profile or private worldview object in storage. | URI, CID, pointer |
| **Data Hash** | The on-chain SHA-256 hash of the encrypted private-worldview bytes. | Hash, content hash |
| **V2 Private Envelope** | The private-worldview storage format that supports both owner unlock and runtime unwrap. | Envelope, V2 blob |
| **Legacy Private Blob** | The older raw-ciphertext private-worldview format that supports owner unlock but not runtime breeding. | Legacy ciphertext, raw blob |
| **Owner Unlock** | The browser-side process where the owner signs a deterministic message to derive a key for decrypting private worldview. | Unlock, decrypt |
| **Runtime Unwrap** | The server-side process that decrypts a **V2 Private Envelope** for authorized runtime use. | Runtime decrypt, server unlock |
| **Proof of Embedded Intelligence** | The external verification that fetched encrypted private bytes hash to the on-chain **Data Hash**. | Proof, verification |

## Relationships

- An **Agent** has exactly one **Public Profile** and exactly one **Private Worldview**.
- A **Public Profile** has zero or more **Skill Packages**.
- A **Genesis** creates an **Agent** with no **Parent Agents**.
- A **Breeding** operation consumes exactly two distinct **Parent Agents** and produces one **Child Agent**.
- A **Child Agent** records **Lineage** to exactly two **Parent Agents**.
- An **Owner** owns zero or more **Agents**.
- An **Authorized User** has **Usage Authorization** for one or more **Agents**.
- An **Authorized Breeder** has **Breeding Authorization** for one or more **Agents**.
- **Usage Authorization** and **Breeding Authorization** are separate permissions and paying one fee does not grant the other.
- A **Disabled Fee** prevents payment-based authorization for its corresponding access type.
- An **Authorized Conversation** may use a **Private Worldview** internally but must not expose **Private Worldview Leakage**.
- Server-side authorized breeding requires **V2 Private Envelopes**; **Legacy Private Blobs** are limited to **Owner Unlock**.

## Example Dialogue

> **Dev:** "When a **Viewer** opens an agent row, do they see the **Private Worldview**?"
> **Domain expert:** "No. They see the **Public Profile**, including **Skill Packages**, lineage, owner, storage pointers, and data hash."
>
> **Dev:** "If a non-owner pays the **Usage Fee**, are they allowed to breed with that agent?"
> **Domain expert:** "No. Payment grants **Usage Authorization** only. **Breeding Authorization** is separate and uses the **Breeding Fee**."
>
> **Dev:** "Once they are an **Authorized User**, should they use the same ask UI as the **Owner**?"
> **Domain expert:** "Yes, but it is an **Authorized Conversation** through the **Authorized Runtime** and must not display or return the **Private Worldview**."
>
> **Dev:** "Can any old minted agent participate in server-side **Breeding**?"
> **Domain expert:** "Only if its private side is a **V2 Private Envelope**. A **Legacy Private Blob** remains owner-unlockable but cannot be runtime-unwrapped for authorized breeding."

## Flagged Ambiguities

- "Worldview" has been used to mean both the complete genome and the private fields; use **Agent Genome** for the full split model and **Private Worldview** for the encrypted private half.
- "Skill" can mean a domain capability or a repo/agent skill file; use **Skill Package** for ThoughtLine public capabilities.
- "Access" is overloaded across conversation and breeding; use **Usage Authorization** and **Breeding Authorization** when discussing permissions.
- "User" is too broad for access decisions; use **Owner**, **Viewer**, **Caller**, **Authorized User**, or **Authorized Breeder**.
- "Fee disabled" should not be described as "free"; a **Disabled Fee** means payment access is unavailable because the contract requires a positive fee.
- "Breeding" and "cross-user breeding" previously implied sharing decrypted parent data; canonical V1 **Breeding** uses runtime-loaded **V2 Private Envelopes** for owners or already-authorized breeders.
- "Oracle" can overclaim real TEE execution; use **Genetic Crossover Oracle** for the product framing and explicitly state that V1 is a server-side stub.
