"use client";

import Link from "next/link";
import { useState } from "react";
import { formatEther } from "viem";
import {
  galileoAddressUrl,
  shortHex,
} from "@/lib/explorer/galileo";
import type { PublicAgentView } from "@/lib/gallery/public-agents";
import { getPublicAgentLineage } from "@/lib/gallery/public-feed";
import { useWorkbench } from "@/lib/workbench-context";
import { ConversationPanel } from "./conversation-panel";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "./ui/dialog";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

interface AgentDetailProps {
  tokenId: string;
}

type DetailTab = "skills" | "private" | "verification" | "economics";

export function AgentDetail({ tokenId }: AgentDetailProps) {
  const workbench = useWorkbench();
  const [activeTab, setActiveTab] = useState<DetailTab>("skills");
  const [chatOpen, setChatOpen] = useState(false);
  const agent = workbench.agents.find((candidate) => candidate.tokenId === tokenId);

  if (workbench.isLoadingGallery && !agent) {
    return <AgentDetailLoading tokenId={tokenId} />;
  }

  if (!agent) {
    return (
      <section className="agent-detail-page">
        <Card className="agent-empty-card">
          <CardHeader>
            <CardTitle>No agent with token #{tokenId}</CardTitle>
            <CardDescription>
              This token is not present in the public gallery feed.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link className={buttonVariants({ variant: "outline" })} href="/">
              Back to gallery
            </Link>
          </CardFooter>
        </Card>
      </section>
    );
  }

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
  const isUnlocked = unlock.status === "ready";
  const isAccessUpdating = access.status === "updating";
  const canAskAsNonOwner = !isOwner && terms?.usage.isAuthorized;
  const canChat = (isOwner && isUnlocked) || !!canAskAsNonOwner;
  const conversation = workbench.conversations[agent.tokenId] ?? {
    status: "idle",
    messages: [],
  };
  const usageFeeOg = terms ? formatEther(BigInt(terms.usage.feeWei)) : null;
  const breedingFeeOg = terms
    ? formatEther(BigInt(terms.breeding.feeWei))
    : null;
  const visibleTabs: Array<{ id: DetailTab; label: string }> = [
    { id: "skills", label: "Skills" },
    ...(isOwner && isUnlocked
      ? ([{ id: "private", label: "Private model" }] as const)
      : []),
    { id: "verification", label: "Verification" },
    { id: "economics", label: "Economics" },
  ];
  const selectedTab = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : "skills";

  return (
    <section className="agent-detail-page">
      <div className="agent-detail-header">
        <div className="agent-title-block">
          <div className="agent-badge-row">
            <Badge>Token #{agent.tokenId}</Badge>
            <Badge className={isOwner ? "agent-badge-owner" : undefined}>
              {isOwner ? "Owner" : "Public"}
            </Badge>
          </div>
          <h1>{agent.publicProfile.name}</h1>
          <p>{agent.publicProfile.description}</p>
          {agent.publicProfile.expertiseType ? (
            <div className="agent-positioning">
              {agent.publicProfile.expertiseType}
            </div>
          ) : null}
          <div className="agent-meta-grid">
            <Metric label="Lineage" value={getPublicAgentLineage(agent)} />
            <Metric
              label="Generation"
              value={agent.publicProfile.generation.toString()}
            />
            <Metric label="Owner" value={shortHex(agent.owner, 10, 6)} />
          </div>
        </div>

        <Card className="agent-primary-card">
          <CardHeader>
            <CardTitle>Interaction</CardTitle>
            <CardDescription>
              {isOwner
                ? isUnlocked
                  ? "Private worldview unlocked in this browser session."
                  : "Unlock with your wallet signature to chat as the owner."
                : canAskAsNonOwner
                  ? "This wallet has paid or been authorized for usage."
                  : "Usage requires authorization before chat starts."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InteractionBody
              agent={agent}
              isOwner={isOwner}
              isUnlocked={isUnlocked}
              canAskAsNonOwner={!!canAskAsNonOwner}
              usageFeeOg={usageFeeOg}
              unlockStatus={unlock.status}
              unlockError={unlock.status === "error" ? unlock.error : null}
              accessStatus={access.status}
              accessError={access.status === "error" ? access.error : null}
              isAccessUpdating={isAccessUpdating}
              hasConnectedWallet={!!genesis.address}
              hasUsageFee={terms ? terms.usage.feeWei !== "0" : false}
              messageCount={conversation.messages.length}
              onOpenChat={() => setChatOpen(true)}
              onUnlock={() => workbench.unlockAgent(agent)}
              onPay={() => workbench.payForUsage(agent)}
            />
          </CardContent>
        </Card>
      </div>

      <Tabs className="agent-detail-tabs">
        <TabsList>
          {visibleTabs.map((tab) => (
            <TabsTrigger
              active={selectedTab === tab.id}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {selectedTab === "skills" ? (
          <TabsContent>
            <SkillPanel agent={agent} />
          </TabsContent>
        ) : null}

        {selectedTab === "private" && unlock.status === "ready" ? (
          <TabsContent>
            <PrivateModelPanel worldview={unlock.worldview} />
          </TabsContent>
        ) : null}

        {selectedTab === "verification" ? (
          <TabsContent>
            <VerificationPanel
              agent={agent}
              proof={proof}
              onVerify={() => workbench.verifyAgent(agent)}
            />
          </TabsContent>
        ) : null}

        {selectedTab === "economics" ? (
          <TabsContent>
            <EconomicsPanel
              accessError={access.status === "error" ? access.error : null}
              breedingFeeOg={breedingFeeOg}
              termsReady={!!terms}
              usageAuthorized={!!terms?.usage.isAuthorized}
              usageFeeOg={usageFeeOg}
              breedingAuthorized={!!terms?.breeding.isAuthorized}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      <Dialog open={chatOpen && canChat}>
        <DialogOverlay onClick={() => setChatOpen(false)} />
        <DialogContent className="agent-chat-dialog">
          <DialogHeader>
            <div>
              <Badge>Token #{agent.tokenId}</Badge>
              <DialogTitle>Chat with {agent.publicProfile.name}</DialogTitle>
              <DialogDescription>
                {isOwner
                  ? "Owner session using the unlocked private worldview."
                  : "Authorized usage session. Private worldview remains hidden."}
              </DialogDescription>
            </div>
            <Button
              onClick={() => setChatOpen(false)}
              type="button"
              variant="outline"
            >
              Close
            </Button>
          </DialogHeader>
          <ConversationPanel agent={agent} mode="modal" />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AgentDetailLoading({ tokenId }: { tokenId: string }) {
  return (
    <section className="agent-detail-page">
      <div className="agent-detail-header">
        <Card>
          <CardHeader>
            <Skeleton className="agent-skeleton-badge" />
            <Skeleton className="agent-skeleton-title" />
            <Skeleton className="agent-skeleton-copy" />
            <Skeleton className="agent-skeleton-copy short" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Loading agent #{tokenId}</CardTitle>
            <CardDescription>Fetching public profile and access state.</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="agent-skeleton-action" />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function InteractionBody({
  agent,
  isOwner,
  isUnlocked,
  canAskAsNonOwner,
  usageFeeOg,
  unlockStatus,
  unlockError,
  accessStatus,
  accessError,
  isAccessUpdating,
  hasConnectedWallet,
  hasUsageFee,
  messageCount,
  onOpenChat,
  onUnlock,
  onPay,
}: {
  agent: PublicAgentView;
  isOwner: boolean;
  isUnlocked: boolean;
  canAskAsNonOwner: boolean;
  usageFeeOg: string | null;
  unlockStatus: string;
  unlockError: string | null;
  accessStatus: string;
  accessError: string | null;
  isAccessUpdating: boolean;
  hasConnectedWallet: boolean;
  hasUsageFee: boolean;
  messageCount: number;
  onOpenChat: () => void;
  onUnlock: () => void;
  onPay: () => void;
}) {
  if (isOwner) {
    if (isUnlocked) {
      return (
        <ChatLaunchPanel
          agent={agent}
          messageCount={messageCount}
          onOpenChat={onOpenChat}
          variant="owner"
        />
      );
    }

    return (
      <div className="agent-access-state">
        <Alert className="ui-alert-info">
          <AlertTitle>Locked private worldview</AlertTitle>
          <AlertDescription>
            The encrypted worldview stays hidden until this wallet signs the
            deterministic unlock message.
          </AlertDescription>
        </Alert>
        <Button
          disabled={unlockStatus === "loading"}
          onClick={onUnlock}
          size="lg"
          type="button"
        >
          {unlockStatus === "loading"
            ? "Unlocking..."
            : "Unlock private worldview"}
        </Button>
        {unlockError ? (
          <Alert className="ui-alert-error">
            <AlertTitle>Unlock failed</AlertTitle>
            <AlertDescription>{unlockError}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    );
  }

  if (!hasConnectedWallet) {
    return (
      <Alert className="ui-alert-info">
        <AlertTitle>Wallet required</AlertTitle>
        <AlertDescription>
          Connect a wallet to load this agent's usage terms and request access.
        </AlertDescription>
      </Alert>
    );
  }

  if (canAskAsNonOwner) {
    return (
      <ChatLaunchPanel
        agent={agent}
        messageCount={messageCount}
        onOpenChat={onOpenChat}
        variant="authorized"
      />
    );
  }

  if (accessStatus === "idle" || accessStatus === "loading") {
    return (
      <div className="agent-access-state">
        <Skeleton className="agent-skeleton-copy" />
        <Skeleton className="agent-skeleton-action" />
      </div>
    );
  }

  return (
    <div className="agent-access-state">
      {hasUsageFee ? (
        <>
          <Alert className="ui-alert-warning">
            <AlertTitle>Payment required</AlertTitle>
            <AlertDescription>
              Usage access costs {usageFeeOg ?? "0"} 0G for this wallet.
            </AlertDescription>
          </Alert>
          <Button
            disabled={isAccessUpdating}
            onClick={onPay}
            size="lg"
            type="button"
          >
            {isAccessUpdating ? "Waiting..." : "Pay for access"}
          </Button>
        </>
      ) : (
        <Alert className="ui-alert-warning">
          <AlertTitle>Usage not enabled</AlertTitle>
          <AlertDescription>
            The owner has not enabled paid usage for this agent.
          </AlertDescription>
        </Alert>
      )}
      {accessError ? (
        <Alert className="ui-alert-error">
          <AlertTitle>Access update failed</AlertTitle>
          <AlertDescription>{accessError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function ChatLaunchPanel({
  agent,
  messageCount,
  onOpenChat,
  variant,
}: {
  agent: PublicAgentView;
  messageCount: number;
  onOpenChat: () => void;
  variant: "owner" | "authorized";
}) {
  return (
    <div className="agent-chat-launch">
      <Alert className="ui-alert-success">
        <AlertTitle>
          {variant === "owner" ? "Private model unlocked" : "Usage authorized"}
        </AlertTitle>
        <AlertDescription>
          Open a focused chat workspace with {agent.publicProfile.name}.
        </AlertDescription>
      </Alert>
      <div className="agent-chat-launch-body">
        <div>
          <span>Conversation</span>
          <strong>
            {messageCount === 0
              ? "No messages yet"
              : `${messageCount} message${messageCount === 1 ? "" : "s"}`}
          </strong>
        </div>
        <div>
          <span>Available skills</span>
          <strong>{agent.publicProfile.skills.length}</strong>
        </div>
      </div>
      <Button onClick={onOpenChat} size="lg" type="button">
        Open chat
      </Button>
    </div>
  );
}

function SkillPanel({ agent }: { agent: PublicAgentView }) {
  return (
    <div className="agent-skill-grid">
      {agent.publicProfile.skills.map((skill) => (
        <Card key={skill.id} className="agent-skill-card">
          <CardHeader>
            <div className="agent-card-kicker">
              <Badge>{skill.source}</Badge>
              {skill.creationBasis ? <Badge>{skill.creationBasis}</Badge> : null}
            </div>
            <CardTitle>{skill.name}</CardTitle>
            <CardDescription>{skill.description}</CardDescription>
          </CardHeader>
          {skill.parentSkillIds.length > 0 ? (
            <CardContent>
              <div className="agent-detail-list">
                <span>Parent skills</span>
                <p>{skill.parentSkillIds.join(", ")}</p>
              </div>
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function PrivateModelPanel({
  worldview,
}: {
  worldview: {
    values: string[];
    heuristics: string[];
    blindspots: string[];
    decisionStyle: string;
    freeform: string;
  };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Private model</CardTitle>
        <CardDescription>
          Owner-only worldview decrypted into browser memory.
        </CardDescription>
      </CardHeader>
      <CardContent className="agent-private-grid">
        <WorldviewBlock label="Values" items={worldview.values} />
        <WorldviewBlock label="Heuristics" items={worldview.heuristics} />
        <WorldviewBlock
          label="Blindspots"
          items={
            worldview.blindspots.length > 0
              ? worldview.blindspots
              : ["None listed"]
          }
        />
        <WorldviewBlock label="Decision style" items={[worldview.decisionStyle]} />
        <div className="agent-worldview-freeform">
          <span>Freeform</span>
          <p>{worldview.freeform}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function VerificationPanel({
  agent,
  proof,
  onVerify,
}: {
  agent: PublicAgentView;
  proof:
    | { status: "idle" | "loading" }
    | {
        status: "ready";
        proof: {
          matches: boolean;
          byteLength: number;
          expectedDataHash: string;
          actualDataHash: string;
        };
      }
    | { status: "error"; error: string };
  onVerify: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification</CardTitle>
        <CardDescription>
          Compare the on-chain private data hash with bytes fetched from storage.
        </CardDescription>
      </CardHeader>
      <CardContent className="agent-verification-grid">
        <TechnicalField label="Public URI" value={agent.publicUri} />
        <TechnicalField label="Private URI" value={agent.privateUri} />
        <TechnicalField label="Data hash" value={agent.dataHash} />
        <TechnicalField label="Owner" value={agent.owner} />
        <div className="agent-link-row">
          {CONTRACT_ADDRESS ? (
            <a
              className="external-link"
              href={galileoAddressUrl(CONTRACT_ADDRESS)}
              rel="noreferrer"
              target="_blank"
            >
              Contract
              <span>{shortHex(CONTRACT_ADDRESS)}</span>
            </a>
          ) : null}
          <a
            className="external-link"
            href={galileoAddressUrl(agent.owner)}
            rel="noreferrer"
            target="_blank"
          >
            Owner
            <span>{shortHex(agent.owner)}</span>
          </a>
          <Link
            className="external-link"
            href={`/breed?withA=${agent.tokenId}`}
          >
            Breed
            <span>with token #{agent.tokenId}</span>
          </Link>
        </div>
        <Separator />
        <Button
          disabled={proof.status === "loading"}
          onClick={onVerify}
          type="button"
        >
          {proof.status === "loading" ? "Verifying..." : "Verify private data"}
        </Button>
        {proof.status === "ready" ? (
          <Alert
            className={proof.proof.matches ? "ui-alert-success" : "ui-alert-error"}
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
            <AlertTitle>Verification failed</AlertTitle>
            <AlertDescription>{proof.error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EconomicsPanel({
  termsReady,
  usageAuthorized,
  usageFeeOg,
  breedingAuthorized,
  breedingFeeOg,
  accessError,
}: {
  termsReady: boolean;
  usageAuthorized: boolean;
  usageFeeOg: string | null;
  breedingAuthorized: boolean;
  breedingFeeOg: string | null;
  accessError: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Economics</CardTitle>
        <CardDescription>
          Usage and breeding authorization are priced separately.
        </CardDescription>
      </CardHeader>
      <CardContent className="agent-economics-grid">
        <Metric
          label="Usage fee"
          value={termsReady ? `${usageFeeOg ?? "0"} 0G` : "Not loaded"}
        />
        <Metric
          label="Usage access"
          value={usageAuthorized ? "Authorized" : "Not authorized"}
        />
        <Metric
          label="Breeding fee"
          value={termsReady ? `${breedingFeeOg ?? "0"} 0G` : "Not loaded"}
        />
        <Metric
          label="Breeding access"
          value={breedingAuthorized ? "Authorized" : "Not authorized"}
        />
        {accessError ? (
          <Alert className="ui-alert-error agent-economics-error">
            <AlertTitle>Access terms failed</AlertTitle>
            <AlertDescription>{accessError}</AlertDescription>
          </Alert>
        ) : null}
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

function WorldviewBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="agent-worldview-block">
      <span>{label}</span>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
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
