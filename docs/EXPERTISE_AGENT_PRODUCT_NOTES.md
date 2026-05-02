# Expertise Agent Product Notes

These notes capture the product decisions from the grill-me session about
ThoughtLine's longer-term direction: packaging human expertise into ownable,
interactive, monetizable agents.

## Product Thesis

ThoughtLine should not be framed as a generic agent minting tool. The stronger
vision is:

> Turn a creator's specific expertise, judgment, workflows, and knowledge into
> an interactive agent that can be owned, verified, used, remixed, and
> monetized.

A book or course is mostly static. An expertise agent is interactive and can run
bounded expert workflows immediately. The valuable asset is not just text or a
persona; it is a source-grounded, actionable knowledge product.

## Identity And Representation

Official agents that claim to represent a living real person should require that
person or an authorized representative to create or verify them.

Allowed without verification:

- "Value Investing Study Agent based on public Berkshire letters"
- "Public-source inspired chess study agent"
- "Creator-provided GTM advisor"

Not acceptable as an unverified claim:

- "Warren Buffett's Investment Agent"
- "Elon Musk Agent"
- "Magnus Carlsen Official Chess Agent"

The product should distinguish official creator agents from unofficial
public-source-inspired agents. This protects trust, monetization, and product
positioning.

## What Is Monetized

The monetized unit is a verified expertise product, not merely a chatbot or a
pile of source text.

Each agent should eventually expose four layers:

- **Identity:** who or what the agent represents.
- **Knowledge corpus:** what sources ground it.
- **Capabilities:** what concrete workflows it can perform.
- **Rights and monetization:** what buyers can do: ask, invoke skills, breed,
  remix, or use via API.

The current app has the beginnings of corpus, capabilities, and rights. Identity
and provenance need to become more explicit over time.

## Quality Bar For Agent Creation

Agent creation should prove that the agent captures valuable expertise rather
than generic LLM behavior.

A strong creation flow should include:

- source artifacts: notes, docs, code, transcripts, memos, examples
- extracted claims about what the agent knows and can do
- generated skill/capability proposals
- creator review and editing
- preview questions/tasks before minting
- explicit approval before mint

Minting should eventually happen after preview and creator approval, not
immediately after generation.

## Versioning

Agents should be versioned rather than silently edited.

The long-term model:

- Agent v1 is an initial expertise snapshot.
- Agent v2 can add sources, refine skills, and update worldview.
- Each version has a new data hash.
- Old versions remain inspectable.
- Breeding should reference exact parent versions.

For the hackathon, immutable minted agents are acceptable.

## Monetization Model

Long-term monetization should center on paid capabilities, not only generic chat.

Useful tiers:

- public browse: identity, provenance, skills, lineage, proof
- basic usage: ask general questions grounded in the agent
- paid skill invocation: high-value structured workflows
- breeding/remix rights: derivative creation
- later: API/subscription/private action tiers

The current usage fee and breeding fee are a good V1 foundation. Per-skill
pricing is a later product layer.

## Credibility Layer

The marketplace needs credibility signals to avoid being flooded by low-quality
clone agents.

Important signals:

- verified creator
- source labels/count
- public provenance
- concrete skills
- public sample tasks
- usage/revenue history
- lineage
- version
- proof status

For V1, showing source labels/count, skills, lineage, and proof status is enough.

## Public Versus Private Data

Public data should prove what the agent is and what it can do. Private data
should contain the high-resolution judgment engine.

Public:

- name
- creator identity or claim
- official/unofficial/verified status
- description
- source labels/count
- public skill cards
- sample tasks
- lineage
- version
- price/terms
- proof hashes

Private:

- full worldview
- detailed heuristics
- creator-specific decision rules
- private notes
- proprietary examples
- internal rubrics
- private skill execution instructions
- private source-derived summaries

The current public `SkillPackage.markdown` is acceptable for the hackathon, but
long-term skills should likely split into public capability cards and private
execution rubrics.

## Derivative Agents And Breeding

Breeding should create a new marketable expertise product, not just mix
personalities.

The child creator should own the child agent, while parents retain visible
lineage and configured economics.

Long-term model:

- child owner controls the child iNFT
- parent IDs and exact versions are recorded
- parent creators set breeding/remix fees
- future royalties can flow from child revenue to parents
- child profile clearly discloses parent lineage
- child cannot impersonate parent identities

For V1, separate breeding authorization, breeding fees, and lineage are enough.

## Source Rights

Source-rights workflows are intentionally out of scope for now.

The product should avoid heavy legal friction in V1. Use lightweight provenance
labels instead:

- creator-provided
- public-source inspired
- unofficial
- verified creator, later

Public profiles should eventually show source labels and source count without
requiring full source disclosure.

## Product Shape

The near-term product should prioritize creator publishing pages over a broad
marketplace.

Recommended flow:

1. Create agent.
2. Preview and approve.
3. Mint.
4. Share the agent page.
5. Monetize access.

The gallery is useful for the hackathon because it proves chain recovery and
public discovery, but a serious buyer needs a dedicated agent page that explains
identity, capabilities, provenance, proof, pricing, and sample tasks.

## Taking Action

"Actionable" should first mean structured expert deliverables, not unrestricted
autonomous execution.

Examples:

- review a pitch deck
- critique a code architecture
- analyze a chess position
- produce a research brief
- compare investment theses
- draft an investor update
- create a launch plan

Later, agents can integrate with tools such as GitHub, documents, email, APIs,
payments, and on-chain execution.

## Recommended Demo Direction

Avoid demoing famous-person clones. Use concrete expert-work agents that produce
visible artifacts.

Strong hackathon demo parents:

- **Protocol Architect:** evaluates technical architecture, decentralization
  claims, contracts, and infrastructure risk.
- **Product Judge:** evaluates user value, demo clarity, monetization, and
  hackathon/prize fit.

Strong child:

- **Launch Reviewer:** combines architecture critique with product/judge
  instinct to produce launch-readiness reviews.

This makes breeding useful instead of gimmicky.

## Hackathon-Scope Product Upgrades

The easy, high-leverage upgrades before submission are:

- add `expertiseType` or positioning to genesis creation (implemented as optional public profile metadata)
- add source labels to genesis creation and public profiles (implemented as lightweight provenance signals, not legal verification)
- add `childBrief` to breeding (implemented as child positioning metadata)
- update prompts so generated skills are concrete paid capabilities (implemented for genesis and breeding skill synthesis)
- improve UI copy around packaged expertise (implemented in the creation form and gallery inspect view)
- create two strong demo parent agents and one child

Medium/later upgrades:

- pre-mint review and approval screen
- skill editing before mint
- public/private skill split
- dedicated shareable agent pages
- agent versioning
- per-skill pricing

Hard/later upgrades:

- verified creator identity
- official/unofficial verification system
- child-agent royalties
- marketplace ranking and quality signals
- source-rights workflows
- broad tool/action integrations
- real sealed inference / TEE execution
