"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatEther } from "viem";
import {
  galileoAddressUrl,
  shortHex,
} from "@/lib/explorer/galileo";
import type { PublicAgentView } from "@/lib/gallery/public-agents";
import { getPublicAgentLineage } from "@/lib/gallery/public-feed";
import { useWorkbench } from "@/lib/workbench-context";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

interface AgentCardProps {
  agent: PublicAgentView;
  defaultOpen?: boolean;
  showDetailLink?: boolean;
}

export function AgentCard({
  agent,
  defaultOpen = false,
  showDetailLink = true,
}: AgentCardProps) {
  const router = useRouter();
  const workbench = useWorkbench();
  const { genesis } = workbench;

  const proof = workbench.proofs[agent.tokenId] ?? { status: "idle" };
  const unlock = workbench.unlockedAgents[agent.tokenId] ?? { status: "idle" };
  const access = workbench.accessTerms[agent.tokenId] ?? { status: "idle" };
  const terms =
    access.status === "ready" ||
    access.status === "updating" ||
    access.status === "error"
      ? access.terms
      : undefined;
  const isOwner =
    !!genesis.address &&
    genesis.address.toLowerCase() === agent.owner.toLowerCase();
  const lineage = getPublicAgentLineage(agent);
  const usageFeeOg = terms ? formatEther(BigInt(terms.usage.feeWei)) : "0";
  const breedingFeeOg = terms
    ? formatEther(BigInt(terms.breeding.feeWei))
    : "0";
  const isAccessUpdating = access.status === "updating";
  const openHref = showDetailLink
    ? `/agents/${agent.tokenId}`
    : `/breed?withA=${agent.tokenId}`;
  const navigate = () => {
    if (showDetailLink) router.push(openHref);
  };

  return (
    <Card
      className="agent-card"
      onClick={navigate}
      onKeyDown={(event) => {
        if (!showDetailLink) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate();
        }
      }}
      role={showDetailLink ? "link" : undefined}
      tabIndex={showDetailLink ? 0 : undefined}
    >
      <CardHeader className="agent-card-header">
        <div className="agent-card-topline">
          <Badge>Token #{agent.tokenId}</Badge>
          <Badge className="agent-card-lineage">{lineage}</Badge>
        </div>
        <CardTitle>{agent.publicProfile.name}</CardTitle>
        <CardDescription>{agent.publicProfile.description}</CardDescription>
        {agent.publicProfile.expertiseType ? (
          <div className="agent-card-positioning">
            {agent.publicProfile.expertiseType}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="agent-card-content">
        <div className="agent-card-meta">
          <Meta label="Generation" value={agent.publicProfile.generation.toString()} />
          <Meta label="Owner" value={shortHex(agent.owner, 10, 6)} />
          <Meta label="Hash" value={shortHex(agent.dataHash, 10, 8)} />
        </div>

        <div className="agent-card-skills">
          {agent.publicProfile.skills.slice(0, 4).map((skill) => (
            <div key={skill.id} className="agent-skill-pill">
              <strong>{skill.name}</strong>
              <span>{skill.source}</span>
            </div>
          ))}
          {agent.publicProfile.skills.length > 4 ? (
            <div className="agent-skill-pill muted">
              <strong>+{agent.publicProfile.skills.length - 4} more</strong>
              <span>skills</span>
            </div>
          ) : null}
        </div>

        <details className="agent-card-details" open={defaultOpen}>
          <summary
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            Inspect
          </summary>
          <div className="agent-card-details-body">
            <div className="agent-card-links">
              {showDetailLink ? null : (
                <Link
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                  href={`/breed?withA=${agent.tokenId}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  Breed with this agent
                </Link>
              )}
              {CONTRACT_ADDRESS ? (
                <a
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  href={galileoAddressUrl(CONTRACT_ADDRESS)}
                  rel="noreferrer"
                  target="_blank"
                  onClick={(event) => event.stopPropagation()}
                >
                  Contract
                </a>
              ) : null}
              <a
                className={buttonVariants({ variant: "outline", size: "sm" })}
                href={galileoAddressUrl(agent.owner)}
                rel="noreferrer"
                target="_blank"
                onClick={(event) => event.stopPropagation()}
              >
                Owner
              </a>
            </div>

            <div className="agent-card-grid">
              <DetailField label="Public URI" value={agent.publicUri} />
              <DetailField label="Private URI" value={agent.privateUri} />
              {agent.publicProfile.sourceLabels?.length ? (
                <DetailField
                  label="Source provenance"
                  value={`${agent.publicProfile.sourceCount ?? 0} source${
                    (agent.publicProfile.sourceCount ?? 0) === 1 ? "" : "s"
                  }${agent.publicProfile.sourceLabels?.length ? ` · ${agent.publicProfile.sourceLabels.join(", ")}` : ""}`}
                />
              ) : null}
              {agent.publicProfile.desiredCapabilities?.length ? (
                <DetailField
                  label="Desired capabilities"
                  value={agent.publicProfile.desiredCapabilities.join(", ")}
                />
              ) : null}
            </div>

            <div className="agent-card-actions">
              <Button
                type="button"
                variant="outline"
                disabled={proof.status === "loading"}
                onClick={(event) => {
                  event.stopPropagation();
                  workbench.verifyAgent(agent);
                }}
              >
                {proof.status === "loading" ? "Verifying..." : "Verify"}
              </Button>

              {isOwner ? (
                <Button
                  type="button"
                  disabled={unlock.status === "loading"}
                  onClick={(event) => {
                    event.stopPropagation();
                    workbench.unlockAgent(agent);
                  }}
                >
                  {unlock.status === "loading"
                    ? "Unlocking..."
                    : unlock.status === "ready"
                      ? "Unlocked"
                      : "Unlock"}
                </Button>
              ) : terms && !terms.usage.isAuthorized && terms.usage.feeWei !== "0" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={access.status === "updating"}
                  onClick={(event) => {
                    event.stopPropagation();
                    workbench.payForUsage(agent);
                  }}
                >
                  {isAccessUpdating ? "Waiting..." : "Pay for access"}
                </Button>
              ) : terms && !terms.usage.isAuthorized ? (
                <Alert className="ui-alert-warning">
                  <AlertDescription>Owner has not set a usage fee.</AlertDescription>
                </Alert>
              ) : null}
            </div>

            {proof.status === "ready" ? (
              <Alert
                className={
                  proof.proof.matches ? "ui-alert-success" : "ui-alert-error"
                }
              >
                <AlertTitle>
                  {proof.proof.matches ? "Hash match" : "Hash mismatch"} ·{" "}
                  {proof.proof.byteLength} bytes
                </AlertTitle>
                <AlertDescription>
                  Expected {proof.proof.expectedDataHash}; fetched{" "}
                  {proof.proof.actualDataHash}.
                </AlertDescription>
              </Alert>
            ) : null}

            {proof.status === "error" ? (
              <Alert className="ui-alert-error">
                <AlertDescription>{proof.error}</AlertDescription>
              </Alert>
            ) : null}

            {isOwner ? (
              <div className="agent-card-economics">
                <DetailField label="Usage fee" value={`${usageFeeOg} 0G`} />
                <DetailField label="Breeding fee" value={`${breedingFeeOg} 0G`} />
                {unlock.status === "error" ? (
                  <Alert className="ui-alert-error">
                    <AlertDescription>{unlock.error}</AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : terms ? (
              <div className="agent-card-economics">
                <DetailField
                  label="Usage access"
                  value={terms.usage.isAuthorized ? "Authorized" : "Not authorized"}
                />
                <DetailField
                  label="Breeding access"
                  value={
                    terms.breeding.isAuthorized ? "Authorized" : "Not authorized"
                  }
                />
                {access.status === "error" ? (
                  <Alert className="ui-alert-error">
                    <AlertDescription>{access.error}</AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : null}
          </div>
        </details>
      </CardContent>

      {!showDetailLink ? (
        <CardFooter className="agent-card-footer">
          <Link
            className={buttonVariants({ variant: "default" })}
            href={openHref}
            onClick={(event) => event.stopPropagation()}
          >
            Breed with this agent
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="agent-card-meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="agent-card-field">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}
