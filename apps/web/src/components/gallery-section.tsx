"use client";

import Link from "next/link";
import type { PublicAgentView } from "@/lib/gallery/public-agents";
import { useWorkbench } from "@/lib/workbench-context";
import { AgentCard } from "./agent-card";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

export function PageHead() {
  const workbench = useWorkbench();
  return (
    <section className="agents-hero">
      <div className="agents-hero-copy">
        <Badge>0G Compute · Storage · iNFT lineage</Badge>
        <h1>Discover minted agents and inspect what they can actually do.</h1>
        <p>
          Browse public profiles, skill packages, lineage, and verification
          details. Unlock or pay only when you want to use one.
        </p>
        <div className="agents-hero-actions">
          <Link className="ui-button ui-button-default ui-button-lg" href="/create">
            Create agent
          </Link>
          <Link className="ui-button ui-button-outline ui-button-lg" href="/breed">
            Breed agents
          </Link>
        </div>
      </div>

      <Card className="agents-filter-card">
        <CardHeader>
          <CardTitle>Gallery filter</CardTitle>
          <CardDescription>
            Search by name, skill, lineage, owner, or storage hash.
          </CardDescription>
        </CardHeader>
        <CardContent className="agents-filter-content">
          <Input
            aria-label="Search agents"
            placeholder="Search agents"
            value={workbench.search}
            onChange={(event) => workbench.setSearch(event.target.value)}
          />
          <div className="agents-stats">
            <Stat label="Visible" value={workbench.filteredAgents.length.toString()} />
            <Stat
              label="Gallery"
              value={workbench.isLoadingGallery ? "Syncing" : "Live"}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

interface GallerySectionProps {
  limit?: number;
  grouped?: boolean;
}

export function GallerySection({ limit, grouped = false }: GallerySectionProps = {}) {
  const workbench = useWorkbench();
  const visibleAgents = limit
    ? workbench.filteredAgents.slice(0, limit)
    : workbench.filteredAgents;
  const walletAddress = workbench.genesis.address?.toLowerCase() ?? null;
  const myAgents = walletAddress
    ? visibleAgents.filter((agent) => agent.owner.toLowerCase() === walletAddress)
    : [];
  const publicAgents =
    grouped && walletAddress
      ? visibleAgents.filter((agent) => agent.owner.toLowerCase() !== walletAddress)
      : visibleAgents;

  return (
    <section className="agents-gallery">
      {workbench.galleryError ? (
        <Card className="agents-message-card">
          <CardContent>
            <p className="error">{workbench.galleryError}</p>
          </CardContent>
        </Card>
      ) : null}
      {workbench.galleryWarning ? (
        <Card className="agents-message-card">
          <CardContent>
            <p className="proof">{workbench.galleryWarning}</p>
          </CardContent>
        </Card>
      ) : null}
      {grouped ? (
        <>
          <GalleryGroup
            title="My agents"
            agents={myAgents}
            empty={
              walletAddress
                ? "No agents owned by this wallet match the current view."
                : "Connect your wallet to see the agents you own."
            }
            isLoading={workbench.isLoadingGallery}
          />
          <GalleryGroup
            title="Public agents"
            agents={publicAgents}
            empty={
              walletAddress
                ? "No public agents from other wallets match the current view."
                : "No public agents match the current view."
            }
            isLoading={workbench.isLoadingGallery}
            showCreateEmpty={workbench.agents.length === 0}
          />
        </>
      ) : (
        <GalleryGroup
          agents={visibleAgents}
          empty="No agents match that search."
          isLoading={workbench.isLoadingGallery}
          showCreateEmpty={workbench.agents.length === 0}
        />
      )}
    </section>
  );
}

function GalleryGroup({
  title,
  agents,
  empty,
  isLoading,
  showCreateEmpty = false,
}: {
  title?: string;
  agents: PublicAgentView[];
  empty: string;
  isLoading: boolean;
  showCreateEmpty?: boolean;
}) {
  return (
    <div className="gallery-group">
      {title ? (
        <div className="gallery-group-head">
          <h2>{title}</h2>
          <Badge>{agents.length}</Badge>
        </div>
      ) : null}
      {isLoading ? (
        <Card className="agents-message-card">
          <CardContent>
            <p className="gallery-empty">Loading public agents...</p>
          </CardContent>
        </Card>
      ) : null}
      {!isLoading && showCreateEmpty ? (
        <Card className="agents-message-card">
          <CardContent className="agents-empty-stack">
            <p>No minted agents yet.</p>
            <Link className="ui-button ui-button-secondary" href="/create">
              Create the first agent
            </Link>
          </CardContent>
        </Card>
      ) : null}
      {!isLoading && !showCreateEmpty && agents.length === 0 ? (
        <Card className="agents-message-card">
          <CardContent>
            <p className="gallery-empty">{empty}</p>
          </CardContent>
        </Card>
      ) : null}
      {agents.length > 0 ? (
        <div className="agents-grid">
          {agents.map((agent) => (
            <AgentCard key={agent.tokenId} agent={agent} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="agents-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
