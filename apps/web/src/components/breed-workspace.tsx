"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PrivateWorldview, SkillPackage } from "@thoughtline/shared";
import type { PrivateWorldviewSummary } from "@/lib/agent-artifact";
import type { BreedingReadyPayload } from "@/lib/breeding-browser-flow";
import { canMintReviewedChild } from "@/lib/breeding-browser-flow";
import {
  galileoAddressUrl,
  galileoTxUrl,
  shortHex,
} from "@/lib/explorer/galileo";
import type { PublicAgentView } from "@/lib/gallery/public-agents";
import { useWorkbench } from "@/lib/workbench-context";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button, buttonVariants } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";

type BreedStage = "compose" | "breeding" | "review";
type ReviewTab = "summary" | "skills" | "private" | "technical";

export function BreedWorkspace() {
  const workbench = useWorkbench();
  const { genesis, breeding } = workbench;
  const searchParams = useSearchParams();
  const prefillA = searchParams.get("withA");
  const prefillB = searchParams.get("withB");
  const [stage, setStage] = useState<BreedStage>(
    breeding.ready ? "review" : "compose"
  );
  const [reviewTab, setReviewTab] = useState<ReviewTab>("summary");

  useEffect(() => {
    if (prefillA && !breeding.parentTokenIdA) {
      workbench.setBreedingParentA(prefillA);
    }
    if (prefillB && !breeding.parentTokenIdB) {
      workbench.setBreedingParentB(prefillB);
    }
  }, [
    prefillA,
    prefillB,
    breeding.parentTokenIdA,
    breeding.parentTokenIdB,
    workbench,
  ]);

  useEffect(() => {
    if (breeding.ready) setStage("review");
  }, [breeding.ready]);

  if (!workbench.isLoadingGallery && workbench.agents.length === 0) {
    return (
      <section className="create-shell breed-shell">
        <Card className="agent-empty-card">
          <CardHeader>
            <Badge>Breeding</Badge>
            <CardTitle>Breed a child agent</CardTitle>
            <CardDescription>
              No agents have been minted yet. Create a first agent to use as a
              parent.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link className={buttonVariants()} href="/create">
              Create an agent
            </Link>
          </CardFooter>
        </Card>
      </section>
    );
  }

  const selectedParentA = workbench.agents.find(
    (agent) => agent.tokenId === breeding.parentTokenIdA
  );
  const selectedParentB = workbench.agents.find(
    (agent) => agent.tokenId === breeding.parentTokenIdB
  );
  const canBreed =
    !!genesis.address &&
    !!breeding.parentTokenIdA &&
    !!breeding.parentTokenIdB &&
    breeding.parentTokenIdA !== breeding.parentTokenIdB &&
    breeding.childName.trim().length > 0 &&
    breeding.childBrief.trim().length > 0 &&
    !breeding.isBreeding;
  const canMintChild = canMintReviewedChild({
    ready: breeding.ready,
    isMinting: breeding.isMinting,
    isApproved: breeding.isApproved,
  });
  const disabledReason = getBreedDisabledReason({
    hasAddress: Boolean(genesis.address),
    hasParentA: Boolean(breeding.parentTokenIdA),
    hasParentB: Boolean(breeding.parentTokenIdB),
    parentsDistinct: breeding.parentTokenIdA !== breeding.parentTokenIdB,
    hasChildName: breeding.childName.trim().length > 0,
    hasChildBrief: breeding.childBrief.trim().length > 0,
    isBreeding: breeding.isBreeding,
  });

  function startBreeding() {
    setStage("breeding");
    void workbench.breedSelectedParents();
  }

  return (
    <section
      className={
        stage === "breeding" ? "create-shell breed-shell forging" : "create-shell breed-shell"
      }
    >
      {stage !== "breeding" ? (
        <div className={stage === "compose" ? "create-head" : "create-head solo"}>
          <div>
            <Badge>Lineage</Badge>
            <h1>Breed a child agent</h1>
            <p>
              Select two authorized parents, synthesize a child, then mint the
              lineage transaction.
            </p>
          </div>
          {stage === "compose" ? (
            <PipelineCard events={breeding.events} state={formatBreedingState(breeding)} />
          ) : null}
        </div>
      ) : null}

      {stage === "compose" ? (
        <BreedComposeSurface
          agents={workbench.agents}
          breedingError={breeding.error}
          canBreed={canBreed}
          childBrief={breeding.childBrief}
          childName={breeding.childName}
          disabledReason={disabledReason}
          onBreed={startBreeding}
          parentTokenIdA={breeding.parentTokenIdA}
          parentTokenIdB={breeding.parentTokenIdB}
          selectedParentA={selectedParentA}
          selectedParentB={selectedParentB}
          setChildBrief={workbench.setBreedingChildBrief}
          setChildName={workbench.setBreedingChildName}
          setParentA={workbench.setBreedingParentA}
          setParentB={workbench.setBreedingParentB}
        />
      ) : null}

      {stage === "breeding" ? (
        <BreedProgressSurface
          error={breeding.error}
          events={breeding.events}
          isBusy={breeding.isBreeding}
          onEditInputs={() => setStage("compose")}
          state={formatBreedingState(breeding)}
        />
      ) : null}

      {stage === "review" && breeding.ready ? (
        <BreedReviewSurface
          canMintChild={canMintChild}
          error={breeding.error}
          isApproved={breeding.isApproved}
          isMinting={breeding.isMinting}
          mintTxHash={breeding.mintTxHash}
          onApprove={workbench.approveBreedChildReview}
          onEditInputs={() => setStage("compose")}
          onMint={workbench.mintBreedChild}
          ready={breeding.ready}
          reviewTab={reviewTab}
          setReviewTab={setReviewTab}
        />
      ) : null}
    </section>
  );
}

function BreedComposeSurface({
  agents,
  breedingError,
  canBreed,
  childBrief,
  childName,
  disabledReason,
  onBreed,
  parentTokenIdA,
  parentTokenIdB,
  selectedParentA,
  selectedParentB,
  setChildBrief,
  setChildName,
  setParentA,
  setParentB,
}: {
  agents: PublicAgentView[];
  breedingError: string | null;
  canBreed: boolean;
  childBrief: string;
  childName: string;
  disabledReason: string | null;
  onBreed: () => void;
  parentTokenIdA: string;
  parentTokenIdB: string;
  selectedParentA?: PublicAgentView;
  selectedParentB?: PublicAgentView;
  setChildBrief: (value: string) => void;
  setChildName: (value: string) => void;
  setParentA: (value: string) => void;
  setParentB: (value: string) => void;
}) {
  return (
    <div className="breed-compose-grid">
      <Card>
        <CardHeader>
          <CardTitle>Parents</CardTitle>
          <CardDescription>
            Choose two distinct agents. Authorization is checked by the
            breeding runtime.
          </CardDescription>
        </CardHeader>
        <CardContent className="breed-parent-grid">
          <ParentSelect
            agents={agents}
            disabledTokenId={parentTokenIdB}
            id="parent-a"
            label="Parent A"
            value={parentTokenIdA}
            onChange={setParentA}
          />
          <ParentSelect
            agents={agents}
            disabledTokenId={parentTokenIdA}
            id="parent-b"
            label="Parent B"
            value={parentTokenIdB}
            onChange={setParentB}
          />
          <ParentSummary agent={selectedParentA} label="Parent A profile" />
          <ParentSummary agent={selectedParentB} label="Parent B profile" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Child brief</CardTitle>
          <CardDescription>
            Define the marketable purpose the child should serve.
          </CardDescription>
        </CardHeader>
        <CardContent className="create-form-grid breed-child-grid">
          <div className="create-form-row wide">
            <label htmlFor="child-name">Child name</label>
            <Input
              id="child-name"
              autoComplete="off"
              name="thoughtline-child-name"
              value={childName}
              onChange={(event) => setChildName(event.target.value)}
              placeholder="Child name"
            />
          </div>
          <div className="create-form-row wide">
            <label htmlFor="child-brief">Child brief</label>
            <Textarea
              className="breed-brief-textarea"
              id="child-brief"
              value={childBrief}
              onChange={(event) => setChildBrief(event.target.value)}
              placeholder="Describe the child agent's purpose, audience, and behavior."
            />
          </div>
          {breedingError ? (
            <Alert className="ui-alert-error create-inline-alert">
              <AlertTitle>Breeding failed</AlertTitle>
              <AlertDescription>{breedingError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="create-card-actions">
          <Button disabled={!canBreed} onClick={onBreed} size="lg" type="button">
            Breed child
          </Button>
          {disabledReason ? (
            <span className="create-disabled-reason">{disabledReason}</span>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}

function ParentSelect({
  agents,
  disabledTokenId,
  id,
  label,
  onChange,
  value,
}: {
  agents: PublicAgentView[];
  disabledTokenId: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="create-form-row">
      <label htmlFor={id}>{label}</label>
      <select
        className="ui-input"
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select parent</option>
        {agents.map((agent) => (
          <option
            disabled={agent.tokenId === disabledTokenId}
            key={`${id}-${agent.tokenId}`}
            value={agent.tokenId}
          >
            #{agent.tokenId} {agent.publicProfile.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ParentSummary({
  agent,
  label,
}: {
  agent?: PublicAgentView;
  label: string;
}) {
  if (!agent) {
    return (
      <div className="breed-parent-summary empty">
        <span>{label}</span>
        <p>Select an agent.</p>
      </div>
    );
  }

  return (
    <div className="breed-parent-summary">
      <span>{label}</span>
      <strong>
        #{agent.tokenId} {agent.publicProfile.name}
      </strong>
      <p>{agent.publicProfile.description}</p>
      <div className="breed-parent-skills">
        {agent.publicProfile.skills.slice(0, 3).map((skill) => (
          <Badge key={skill.id}>{skill.name}</Badge>
        ))}
      </div>
    </div>
  );
}

function BreedProgressSurface({
  error,
  events,
  isBusy,
  onEditInputs,
  state,
}: {
  error: string | null;
  events: string[];
  isBusy: boolean;
  onEditInputs: () => void;
  state: string;
}) {
  return (
    <div className="create-progress-grid create-progress-stage">
      <Card className="create-progress-card">
        <CardContent className="create-progress-layout">
          <div className="create-progress-main">
            <div>
              <Badge>
                {isBusy ? "Running" : error ? "Needs attention" : "Waiting"}
              </Badge>
              <h2>{error && !isBusy ? "Breeding stopped" : "Synthesizing child"}</h2>
              <p>{state}</p>
            </div>
            {isBusy ? (
              <div className="create-progress-visual">
                <Skeleton />
                <Skeleton />
                <Skeleton />
              </div>
            ) : null}
            {error ? (
              <Alert className="ui-alert-error">
                <AlertTitle>Breeding failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {!isBusy && error ? (
              <Button onClick={onEditInputs} type="button" variant="outline">
                Edit inputs
              </Button>
            ) : null}
          </div>
          <div className="create-progress-pipeline">
            <div>
              <h3>Breeding pipeline</h3>
              <p>{state}</p>
            </div>
            <ScrollArea className="create-progress-pipeline-scroll">
              <ol className="create-status-list">
                {events.length === 0 ? <li>Idle</li> : null}
                {events.map((event, index) => (
                  <li key={`${event}-${index}`}>{formatBreedingEvent(event)}</li>
                ))}
              </ol>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BreedReviewSurface({
  canMintChild,
  error,
  isApproved,
  isMinting,
  mintTxHash,
  onApprove,
  onEditInputs,
  onMint,
  ready,
  reviewTab,
  setReviewTab,
}: {
  canMintChild: boolean;
  error: string | null;
  isApproved: boolean;
  isMinting: boolean;
  mintTxHash: `0x${string}` | null;
  onApprove: () => void;
  onEditInputs: () => void;
  onMint: () => void;
  ready: BreedingReadyPayload;
  reviewTab: ReviewTab;
  setReviewTab: (value: ReviewTab) => void;
}) {
  return (
    <Card className="create-review-card">
      <CardHeader className="create-review-head">
        <div>
          <div className="create-review-badges">
            <Badge>Child review</Badge>
            {isApproved ? <Badge className="agent-badge-owner">Approved</Badge> : null}
            {mintTxHash ? <Badge className="agent-badge-owner">Submitted</Badge> : null}
          </div>
          <CardTitle>{ready.publicProfile.name}</CardTitle>
          <CardDescription>{ready.publicProfile.description}</CardDescription>
        </div>
        <div className="create-review-actions">
          {mintTxHash ? (
            <a
              className={buttonVariants({ size: "lg" })}
              href={galileoTxUrl(mintTxHash)}
              rel="noreferrer"
              target="_blank"
            >
              View transaction
            </a>
          ) : (
            <>
              <Button
                disabled={isApproved}
                onClick={onApprove}
                type="button"
                variant={isApproved ? "secondary" : "default"}
              >
                {isApproved ? "Approved" : "Approve"}
              </Button>
              <Button
                disabled={!canMintChild}
                onClick={onMint}
                type="button"
                variant="secondary"
              >
                {isMinting ? "Minting..." : "Mint child"}
              </Button>
            </>
          )}
          <Button onClick={onEditInputs} type="button" variant="outline">
            Edit inputs
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {mintTxHash ? (
          <Alert className="ui-alert-success create-inline-alert">
            <AlertTitle>Mint transaction submitted</AlertTitle>
            <AlertDescription>
              The child mint transaction was sent. Open the transaction to check
              confirmation.
            </AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert className="ui-alert-error create-inline-alert">
            <AlertTitle>Mint failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="create-review-metrics">
          <Metric
            label="Generation"
            value={ready.publicProfile.generation.toString()}
          />
          <Metric
            label="Parents"
            value={ready.publicProfile.parentIds?.join(" + ") ?? "unknown"}
          />
          <Metric
            label="Skills"
            value={ready.publicProfile.skills.length.toString()}
          />
          <Metric
            label="Chain ID"
            value={ready.mintTransaction.chainId.toString()}
          />
        </div>
        <Tabs className="create-review-tabs">
          <TabsList>
            <TabsTrigger
              active={reviewTab === "summary"}
              onClick={() => setReviewTab("summary")}
            >
              Summary
            </TabsTrigger>
            <TabsTrigger
              active={reviewTab === "skills"}
              onClick={() => setReviewTab("skills")}
            >
              Skills
            </TabsTrigger>
            <TabsTrigger
              active={reviewTab === "private"}
              onClick={() => setReviewTab("private")}
            >
              Private model
            </TabsTrigger>
            <TabsTrigger
              active={reviewTab === "technical"}
              onClick={() => setReviewTab("technical")}
            >
              Technical
            </TabsTrigger>
          </TabsList>

          {reviewTab === "summary" ? (
            <TabsContent>
              <BreedSummary ready={ready} />
            </TabsContent>
          ) : null}

          {reviewTab === "skills" ? (
            <TabsContent>
              <ReviewSkills skills={ready.publicProfile.skills} />
            </TabsContent>
          ) : null}

          {reviewTab === "private" ? (
            <TabsContent>
              <PrivateReview
                privateWorldview={ready.privateWorldview}
                summary={ready.privateWorldviewSummary}
              />
            </TabsContent>
          ) : null}

          {reviewTab === "technical" ? (
            <TabsContent>
              <TechnicalReview mintTxHash={mintTxHash} ready={ready} />
            </TabsContent>
          ) : null}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function BreedSummary({ ready }: { ready: BreedingReadyPayload }) {
  return (
    <div className="create-summary-grid">
      {ready.publicProfile.positioning ? (
        <Metric label="Positioning" value={ready.publicProfile.positioning} />
      ) : null}
      <Metric
        label="Parents"
        value={ready.publicProfile.parentIds?.join(" + ") ?? "unknown"}
      />
      {ready.publicProfile.expertiseType ? (
        <Metric label="Expertise" value={ready.publicProfile.expertiseType} />
      ) : null}
    </div>
  );
}

function ReviewSkills({ skills }: { skills: SkillPackage[] }) {
  return (
    <div className="create-skill-grid">
      {skills.map((skill) => (
        <Card key={skill.id} className="create-skill-card">
          <CardHeader>
            <div className="create-review-badges">
              <Badge>{skill.source}</Badge>
              {skill.parentSkillIds.length > 0 ? <Badge>Inherited</Badge> : null}
            </div>
            <CardTitle>{skill.name}</CardTitle>
            <CardDescription>{skill.description}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function PrivateReview({
  privateWorldview,
  summary,
}: {
  privateWorldview?: PrivateWorldview;
  summary?: PrivateWorldviewSummary;
}) {
  if (!summary && !privateWorldview) {
    return (
      <Alert className="ui-alert-info">
        <AlertTitle>No private summary</AlertTitle>
        <AlertDescription>
          This child artifact did not include a private worldview summary.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="create-private-review">
      {summary ? (
        <div className="create-private-grid">
          <Metric label="Identity" value={summary.identity} />
          <Metric label="Decision-making" value={summary.decisionMaking} />
          {summary.style ? <Metric label="Style" value={summary.style} /> : null}
          {summary.contradictions ? (
            <Metric label="Contradictions" value={summary.contradictions} />
          ) : null}
          <Metric label="Confidence" value={summary.confidence} />
          <Metric label="Boundaries" value={summary.boundaries} />
        </div>
      ) : null}
      {privateWorldview ? (
        <details className="create-private-json">
          <summary>Full private worldview</summary>
          <pre>{JSON.stringify(privateWorldview, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function TechnicalReview({
  mintTxHash,
  ready,
}: {
  mintTxHash: `0x${string}` | null;
  ready: BreedingReadyPayload;
}) {
  return (
    <div className="create-technical-grid">
      <TechnicalField label="Public URI" value={ready.publicUri} />
      <TechnicalField label="Private URI" value={ready.privateUri} />
      <TechnicalField label="Data hash" value={ready.dataHash} />
      <TechnicalField
        label="Chain ID"
        value={ready.mintTransaction.chainId.toString()}
      />
      <div className="agent-link-row">
        {ready.mintTransaction.to ? (
          <a
            className="external-link"
            href={galileoAddressUrl(ready.mintTransaction.to)}
            rel="noreferrer"
            target="_blank"
          >
            Contract
            <span>{shortHex(ready.mintTransaction.to)}</span>
          </a>
        ) : null}
        {mintTxHash ? (
          <a
            className="external-link"
            href={galileoTxUrl(mintTxHash)}
            rel="noreferrer"
            target="_blank"
          >
            Child mint transaction
            <span>{shortHex(mintTxHash)}</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

function PipelineCard({
  events,
  state,
}: {
  events: string[];
  state: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Breeding pipeline</CardTitle>
        <CardDescription>{state}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="create-pipeline-scroll">
          <ol className="create-status-list">
            {events.length === 0 ? <li>Waiting</li> : null}
            {events.map((event, index) => (
              <li key={`${event}-${index}`}>{formatBreedingEvent(event)}</li>
            ))}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="agent-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TechnicalField({ label, value }: { label: string; value: string }) {
  return (
    <div className="agent-technical-field">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function getBreedDisabledReason(input: {
  hasAddress: boolean;
  hasParentA: boolean;
  hasParentB: boolean;
  parentsDistinct: boolean;
  hasChildName: boolean;
  hasChildBrief: boolean;
  isBreeding: boolean;
}): string | null {
  if (input.isBreeding) return "Child synthesis is running.";
  if (!input.hasAddress) return "Connect your wallet to breed agents.";
  if (!input.hasParentA || !input.hasParentB) return "Select two parent agents.";
  if (!input.parentsDistinct) return "Select two distinct parent agents.";
  if (!input.hasChildName) return "Enter a child name.";
  if (!input.hasChildBrief) return "Enter a child brief.";
  return null;
}

function formatBreedingState(breeding: {
  isBreeding: boolean;
  isMinting: boolean;
  ready: unknown;
  mintTxHash: `0x${string}` | null;
  events: string[];
  error: string | null;
}): string {
  if (breeding.isBreeding) return "Synthesizing child worldview and skills.";
  if (breeding.isMinting) return "Submitting child mint transaction.";
  if (breeding.mintTxHash) return "Mint transaction submitted.";
  if (breeding.ready) return "Child review is ready. Approve it before minting.";
  if (breeding.error) return "The latest breeding run needs attention.";
  if (breeding.events.length === 0) return "No breeding run has started yet.";
  return "Latest run is complete or stopped.";
}

function formatBreedingEvent(event: string): string {
  switch (event) {
    case "preparing":
      return "Preparing parent data";
    case "checking-authorization":
      return "Checking breeding authorization";
    case "synthesizing-worldview":
      return "Synthesizing private worldview";
    case "synthesizing-skills":
      return "Synthesizing child skills";
    case "encrypting":
      return "Encrypting child worldview";
    case "uploading":
      return "Uploading public/private artifacts";
    case "ready":
      return "Child review ready";
    case "mint-submitted":
      return "Mint transaction submitted";
    default:
      return event;
  }
}
