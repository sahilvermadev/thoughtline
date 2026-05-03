import Link from "next/link";
import { GallerySection } from "@/components/gallery-section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="tl-landing">
      <section className="tl-hero">
        <div className="tl-hero-copy">
          <Badge>Judgment as an ownable asset</Badge>
          <h1>Turn expertise into ownable, breedable AI agents.</h1>
          <p>
            ThoughtLine packages notes, playbooks, work samples, and lived
            expertise into an iNFT with a public capability profile and an
            encrypted private worldview. The result can be discovered, priced,
            consulted, verified, and bred into new agents with traceable
            lineage.
          </p>
          <div className="tl-actions">
            <Link className={buttonVariants({ size: "lg" })} href="/create">
              Create agent
            </Link>
            <Link
              className={buttonVariants({ variant: "outline", size: "lg" })}
              href="/agents"
            >
              Explore agents
            </Link>
          </div>
        </div>

        <Card className="tl-hero-card">
          <CardHeader>
            <CardTitle>What the demo proves</CardTitle>
            <CardDescription>
              A complete tracer bullet for packaging judgment as a verifiable
              digital asset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="tl-proof-list">
              <li>
                <span>01</span>
                <div>
                  <strong>Create from expertise</strong>
                  <p>User sources and desired capabilities guide skill synthesis.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Encrypt the worldview</strong>
                  <p>Private heuristics stay owner-controlled and unlock locally.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Mint and authorize</strong>
                  <p>Public skills are discoverable; usage and breeding are priced separately.</p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <strong>Breed new agents</strong>
                  <p>Children inherit, adapt, and combine parent capabilities with lineage.</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="tl-section tl-section-grid">
        <div className="tl-section-copy">
          <Badge>Not another chatbot</Badge>
          <h2>A primitive for specific judgment.</h2>
          <p>
            Most AI agents are rented interfaces on someone else's model.
            ThoughtLine makes the expertise layer itself addressable: a public
            profile for what the agent can do, an encrypted worldview for how it
            reasons, and on-chain ownership for who controls access.
          </p>
        </div>
        <div className="tl-card-grid">
          {[
            [
              "Ownable",
              "Agents are minted iNFTs with verifiable storage pointers, owners, and lineage.",
            ],
            [
              "Private",
              "The worldview is encrypted. Public discovery does not leak the source judgment.",
            ],
            [
              "Marketable",
              "Skills are buyer-facing capabilities with clear inputs, outputs, and provenance.",
            ],
            [
              "Breedable",
              "Authorized parents can produce child agents that synthesize capabilities instead of cloning profiles.",
            ],
          ].map(([title, description]) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="tl-bet">
        <Badge>The bet</Badge>
        <h2>Reasoning is the last major medium still tied to the person.</h2>
        <p>
          Recordings made performance travel. Photography made what was seen
          durable. Movable type made ideas cheap to reproduce. Each shift
          turned presence into an artifact.
        </p>
        <p>
          Books capture conclusions. LLMs synthesize generic intelligence.
          ThoughtLine asks whether a specific person's way of weighing
          tradeoffs can become an artifact too: owned, transferred, paid for,
          audited, bred, and durable beyond the original human.
        </p>
      </section>

      <section className="tl-section">
        <div className="tl-section-head">
          <Badge>Where this goes</Badge>
          <h2>From agents to a market for judgment.</h2>
          <p>
            V1 proves the end-to-end shape. The long-term architecture points
            toward agents that own memory, earn from consultations, compose
            skills, and route value through their lineage.
          </p>
        </div>
        <div className="tl-timeline">
          {[
            [
              "Composable skill iNFTs",
              "Capabilities become attachable, detachable, tradable assets with their own hashes.",
            ],
            [
              "Owned episodic memory",
              "Agents learn from consultations through encrypted, owner-controlled memory artifacts.",
            ],
            [
              "Agent wallets and royalties",
              "Agents earn, pay other agents, and route revenue up intellectual family trees.",
            ],
            [
              "Sealed and verifiable reasoning",
              "TEE execution and later proofs make answers auditable without exposing private state.",
            ],
          ].map(([title, description]) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="tl-gallery-head">
        <div>
          <Badge>Live network</Badge>
          <h2>Discover the public side of the agent graph.</h2>
          <p className="muted">
            The gallery shows minted public profiles, skills, source labels,
            hashes, and lineage signals. Open the full discovery page to
            inspect, unlock, authorize, and use agents.
          </p>
        </div>
        <Link
          className={buttonVariants({ variant: "secondary" })}
          href="/agents"
        >
          Explore all agents
        </Link>
      </section>
      <GallerySection limit={3} />
    </div>
  );
}
