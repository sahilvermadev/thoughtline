"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PrivateWorldview, SkillPackage } from "@thoughtline/shared";
import type { PrivateWorldviewSummary } from "@/lib/agent-artifact";
import type { TextSource } from "@/lib/agents/create-from-text";
import {
  galileoAddressUrl,
  galileoTxUrl,
  shortHex,
} from "@/lib/explorer/galileo";
import {
  canMintReviewedGenesis,
  type GenesisReadyPayload,
} from "@/lib/genesis-browser-flow";
import {
  extractTextSource,
  SUPPORTED_EXTENSIONS,
} from "@/lib/source-files";
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
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";

const FILE_ACCEPT = SUPPORTED_EXTENSIONS.join(",");

type CreateStage = "compose" | "forging" | "review";
type SourceTab = "files" | "urls" | "paste";
type ReviewTab = "summary" | "skills" | "private" | "technical";

export function GenesisWorkspace() {
  const { genesis } = useWorkbench();
  const [stage, setStage] = useState<CreateStage>(
    genesis.ready && !genesis.isMintConfirmed ? "review" : "compose"
  );
  const [sourceTab, setSourceTab] = useState<SourceTab>("files");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("summary");
  const [mintSuccessTokenId, setMintSuccessTokenId] = useState<string | null>(
    null
  );
  const [name, setName] = useState("");
  const [expertiseType, setExpertiseType] = useState("");
  const [sourceLabels, setSourceLabels] = useState("");
  const [desiredCapabilities, setDesiredCapabilities] = useState("");
  const [usageFeeOg, setUsageFeeOg] = useState("");
  const [breedingFeeOg, setBreedingFeeOg] = useState("");
  const [sourceUrls, setSourceUrls] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const handledMintConfirmation = useRef(false);

  useEffect(() => {
    if (genesis.ready && !genesis.isMintConfirmed) setStage("review");
  }, [genesis.ready, genesis.isMintConfirmed]);

  useEffect(() => {
    if (!genesis.isMintConfirmed || handledMintConfirmation.current) return;
    handledMintConfirmation.current = true;
    setMintSuccessTokenId(genesis.mintedTokenId);
    setStage("compose");
    setReviewTab("summary");
    genesis.clearGenesisReview();
  }, [genesis.clearGenesisReview, genesis.isMintConfirmed, genesis.mintedTokenId]);

  const hasSource =
    sourceText.trim().length > 0 ||
    sourceUrls.trim().length > 0 ||
    files.length > 0;
  const canForge =
    !!genesis.address && hasSource && !genesis.isForging && !genesis.isSigning;
  const canMintGenesis = canMintReviewedGenesis({
    ready: genesis.ready,
    isMinting: genesis.isMinting,
    isApproved: genesis.isApproved,
    isMintConfirmed: genesis.isMintConfirmed,
  });
  const forgeDisabledReason = getForgeDisabledReason({
    hasAddress: Boolean(genesis.address),
    hasSource,
    isForging: genesis.isForging,
    isSigning: genesis.isSigning,
  });
  const isBusy = genesis.isForging || genesis.isSigning || genesis.isMinting;
  const showProgress =
    stage === "forging" || (stage === "review" && genesis.isMinting);

  function addFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const next: File[] = [...files];
    for (const file of Array.from(incoming)) {
      if (next.some((existing) => existing.name === file.name)) continue;
      next.push(file);
    }
    setFiles(next);
    setFileError(null);
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  async function buildSources(): Promise<{
    sources: TextSource[] | null;
    error: string | null;
  }> {
    const sources: TextSource[] = [];
    for (const file of files) {
      try {
        sources.push(await extractTextSource(file));
      } catch (error) {
        return {
          sources: null,
          error:
            error instanceof Error ? error.message : "Failed to read file",
        };
      }
    }
    if (sourceText.trim().length > 0) {
      sources.push({ label: "Pasted text", text: sourceText });
    }
    return { sources, error: null };
  }

  async function onForge() {
    setFileError(null);
    setMintSuccessTokenId(null);
    handledMintConfirmation.current = false;
    const { sources, error } = await buildSources();
    if (error) {
      setFileError(error);
      return;
    }
    const urls = parseSourceUrls(sourceUrls);
    if (!sources || (sources.length === 0 && !urls?.length)) {
      setFileError("Attach a file, paste source text, or add a source URL.");
      return;
    }
    setStage("forging");
    void genesis.forgeGenesis({
      name,
      sources,
      sourceUrls: urls,
      expertiseType: expertiseType.trim() || undefined,
      sourceLabels: parseSourceLabels(sourceLabels),
      desiredCapabilities: parseDesiredCapabilities(desiredCapabilities),
    });
  }

  function clearReview() {
    genesis.clearGenesisReview();
    setReviewTab("summary");
    setStage("compose");
    setMintSuccessTokenId(null);
    handledMintConfirmation.current = false;
  }

  return (
    <section className={stage === "forging" ? "create-shell forging" : "create-shell"}>
      {stage !== "forging" ? (
        <div className={stage === "compose" ? "create-head" : "create-head solo"}>
          <div>
            <Badge>Genesis</Badge>
            <h1>Create a new agent</h1>
            <p>
              Package links, notes, examples, and work samples into a public
              capability profile with an encrypted private worldview.
            </p>
          </div>
          {stage === "compose" ? (
            <PipelineCard
              events={genesis.events}
              state={formatPipelineState(genesis)}
            />
          ) : null}
        </div>
      ) : null}

      {stage === "compose" ? (
        <ComposeSurface
          breedingFeeOg={breedingFeeOg}
          canForge={canForge}
          desiredCapabilities={desiredCapabilities}
          expertiseType={expertiseType}
          fileError={fileError}
          files={files}
          forgeDisabledReason={forgeDisabledReason}
          genesisError={genesis.error}
          mintedTokenId={mintSuccessTokenId}
          name={name}
          onAddFiles={addFiles}
          onForge={onForge}
          onRemoveFile={removeFile}
          setBreedingFeeOg={setBreedingFeeOg}
          setDesiredCapabilities={setDesiredCapabilities}
          setExpertiseType={setExpertiseType}
          setName={setName}
          setSourceLabels={setSourceLabels}
          setSourceText={setSourceText}
          setSourceUrls={setSourceUrls}
          setUsageFeeOg={setUsageFeeOg}
          sourceLabels={sourceLabels}
          sourceTab={sourceTab}
          sourceText={sourceText}
          sourceUrls={sourceUrls}
          setSourceTab={setSourceTab}
          usageFeeOg={usageFeeOg}
          showMintSuccess={Boolean(mintSuccessTokenId)}
        />
      ) : null}

      {stage === "forging" ? (
        <ProgressSurface
          error={genesis.error}
          events={genesis.events}
          isBusy={isBusy}
          onEditInputs={() => setStage("compose")}
          state={formatPipelineState(genesis)}
        />
      ) : null}

      {stage === "review" && genesis.ready ? (
        <ReviewSurface
          breedingFeeOg={breedingFeeOg}
          canMintGenesis={canMintGenesis}
          error={genesis.error}
          isApproved={genesis.isApproved}
          isMintConfirmed={genesis.isMintConfirmed}
          isMinting={genesis.isMinting}
          mintTxHash={genesis.mintTxHash}
          mintedTokenId={genesis.mintedTokenId}
          onApprove={genesis.approveGenesisReview}
          onClear={clearReview}
          onMint={() => genesis.mintGenesis({ usageFeeOg, breedingFeeOg })}
          ready={genesis.ready}
          reviewTab={reviewTab}
          setReviewTab={setReviewTab}
          usageFeeOg={usageFeeOg}
        />
      ) : null}

      {showProgress && stage === "review" ? (
        <PipelineCard
          className="create-mobile-pipeline"
          events={genesis.events}
          state={formatPipelineState(genesis)}
        />
      ) : null}
    </section>
  );
}

function ComposeSurface(props: {
  breedingFeeOg: string;
  canForge: boolean;
  desiredCapabilities: string;
  expertiseType: string;
  fileError: string | null;
  files: File[];
  forgeDisabledReason: string | null;
  genesisError: string | null;
  mintedTokenId: string | null;
  name: string;
  showMintSuccess: boolean;
  onAddFiles: (incoming: FileList | null) => void;
  onForge: () => void;
  onRemoveFile: (index: number) => void;
  setBreedingFeeOg: (value: string) => void;
  setDesiredCapabilities: (value: string) => void;
  setExpertiseType: (value: string) => void;
  setName: (value: string) => void;
  setSourceLabels: (value: string) => void;
  setSourceTab: (value: SourceTab) => void;
  setSourceText: (value: string) => void;
  setSourceUrls: (value: string) => void;
  setUsageFeeOg: (value: string) => void;
  sourceLabels: string;
  sourceTab: SourceTab;
  sourceText: string;
  sourceUrls: string;
  usageFeeOg: string;
}) {
  return (
    <div className="create-compose-grid">
      {props.showMintSuccess && props.mintedTokenId ? (
        <Alert className="ui-alert-success create-inline-alert create-compose-banner">
          <AlertTitle>Mint confirmed</AlertTitle>
          <AlertDescription>
            The last agent is on-chain.
            <Link className="inline-link" href={`/agents/${props.mintedTokenId}`}>
              Open minted agent #{props.mintedTokenId}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      <Card className="create-compose-card">
        <CardHeader>
          <CardTitle>Agent setup</CardTitle>
          <CardDescription>
            Define the public profile and choose the source material to forge.
          </CardDescription>
        </CardHeader>
        <CardContent className="create-form-grid">
          <div className="create-form-row wide">
            <label htmlFor="agent-name">Agent name</label>
            <Input
              id="agent-name"
              autoComplete="off"
              name="thoughtline-agent-name"
              value={props.name}
              onChange={(event) => props.setName(event.target.value)}
              placeholder="Agent name"
            />
          </div>

          <div className="create-form-row wide">
            <label htmlFor="expertise-type">Expertise / positioning</label>
            <Input
              id="expertise-type"
              value={props.expertiseType}
              onChange={(event) => props.setExpertiseType(event.target.value)}
              placeholder="B2B SaaS onboarding teardown specialist"
            />
          </div>

          <div className="create-form-row">
            <label htmlFor="source-labels">Source labels</label>
            <Input
              id="source-labels"
              value={props.sourceLabels}
              onChange={(event) => props.setSourceLabels(event.target.value)}
              placeholder="Calls, docs, playbooks"
            />
          </div>

          <div className="create-form-row">
            <label htmlFor="desired-capabilities">Desired capabilities</label>
            <Textarea
              className="create-compact-textarea"
              id="desired-capabilities"
              value={props.desiredCapabilities}
              onChange={(event) =>
                props.setDesiredCapabilities(event.target.value)
              }
              placeholder="Review pitch decks, critique onboarding flows"
            />
          </div>

          <div className="create-fee-grid wide">
            <div className="create-form-row">
              <label htmlFor="usage-fee-og">Usage fee (0G)</label>
              <Input
                id="usage-fee-og"
                inputMode="decimal"
                placeholder="0"
                value={props.usageFeeOg}
                onChange={(event) => props.setUsageFeeOg(event.target.value)}
              />
            </div>
            <div className="create-form-row">
              <label htmlFor="breeding-fee-og">Breeding fee (0G)</label>
              <Input
                id="breeding-fee-og"
                inputMode="decimal"
                placeholder="0"
                value={props.breedingFeeOg}
                onChange={(event) => props.setBreedingFeeOg(event.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="create-source-card">
        <CardHeader>
          <CardTitle>Source material</CardTitle>
          <CardDescription>
            Use one source mode or combine several before forging.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs className="create-source-tabs">
            <TabsList>
              <TabsTrigger
                active={props.sourceTab === "files"}
                onClick={() => props.setSourceTab("files")}
              >
                Files
              </TabsTrigger>
              <TabsTrigger
                active={props.sourceTab === "urls"}
                onClick={() => props.setSourceTab("urls")}
              >
                URLs
              </TabsTrigger>
              <TabsTrigger
                active={props.sourceTab === "paste"}
                onClick={() => props.setSourceTab("paste")}
              >
                Paste
              </TabsTrigger>
            </TabsList>

            {props.sourceTab === "files" ? (
              <TabsContent>
                <div className="create-form-row">
                  <label htmlFor="source-files">
                    Attach files
                    <span className="muted">
                      {" "}
                      - PDF, text, markdown, code, and data files
                    </span>
                  </label>
                  <Input
                    id="source-files"
                    type="file"
                    multiple
                    accept={FILE_ACCEPT}
                    onChange={(event) => {
                      props.onAddFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </div>
                {props.files.length > 0 ? (
                  <ScrollArea className="create-file-list">
                    {props.files.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="create-file-chip"
                      >
                        <span>{file.name}</span>
                        <strong>{formatBytes(file.size)}</strong>
                        <Button
                          aria-label={`Remove ${file.name}`}
                          onClick={() => props.onRemoveFile(index)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                ) : (
                  <div className="create-empty-source">
                    No files attached yet.
                  </div>
                )}
              </TabsContent>
            ) : null}

            {props.sourceTab === "urls" ? (
              <TabsContent>
                <Textarea
                  className="create-source-textarea"
                  id="source-urls"
                  value={props.sourceUrls}
                  onChange={(event) => props.setSourceUrls(event.target.value)}
                  placeholder={"https://nav.al/rich\nhttps://example.com/playbook"}
                />
              </TabsContent>
            ) : null}

            {props.sourceTab === "paste" ? (
              <TabsContent>
                <Textarea
                  className="create-source-textarea"
                  id="source-text"
                  value={props.sourceText}
                  onChange={(event) => props.setSourceText(event.target.value)}
                  placeholder="Paste the raw material this agent should learn from."
                />
              </TabsContent>
            ) : null}
          </Tabs>

          {props.fileError ? (
            <Alert className="ui-alert-error create-inline-alert">
              <AlertTitle>Source error</AlertTitle>
              <AlertDescription>{props.fileError}</AlertDescription>
            </Alert>
          ) : null}
          {props.genesisError ? (
            <Alert className="ui-alert-error create-inline-alert">
              <AlertTitle>Forge failed</AlertTitle>
              <AlertDescription>{props.genesisError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="create-card-actions">
          <Button
            disabled={!props.canForge}
            onClick={props.onForge}
            size="lg"
            type="button"
          >
            Forge genesis
          </Button>
          {props.forgeDisabledReason ? (
            <span className="create-disabled-reason">
              {props.forgeDisabledReason}
            </span>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}

function ProgressSurface({
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
              <h2>{error && !isBusy ? "Forge stopped" : "Forging agent"}</h2>
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
                <AlertTitle>Forge failed</AlertTitle>
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
              <h3>Pipeline</h3>
              <p>{state}</p>
            </div>
            <ScrollArea className="create-progress-pipeline-scroll">
              <ol className="create-status-list">
                {events.length === 0 ? <li>Idle</li> : null}
                {events.map((event, index) => (
                  <li key={`${event}-${index}`}>{formatPipelineEvent(event)}</li>
                ))}
              </ol>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewSurface({
  breedingFeeOg,
  canMintGenesis,
  error,
  isApproved,
  isMintConfirmed,
  isMinting,
  mintTxHash,
  mintedTokenId,
  onApprove,
  onClear,
  onMint,
  ready,
  reviewTab,
  setReviewTab,
  usageFeeOg,
}: {
  breedingFeeOg: string;
  canMintGenesis: boolean;
  error: string | null;
  isApproved: boolean;
  isMintConfirmed: boolean;
  isMinting: boolean;
  mintTxHash: `0x${string}` | null;
  mintedTokenId: string | null;
  onApprove: () => void;
  onClear: () => void;
  onMint: () => void;
  ready: GenesisReadyPayload;
  reviewTab: ReviewTab;
  setReviewTab: (value: ReviewTab) => void;
  usageFeeOg: string;
}) {
  return (
    <Card className="create-review-card">
      <CardHeader className="create-review-head">
        <div>
          <div className="create-review-badges">
            <Badge>Review ready</Badge>
            {isApproved ? <Badge className="agent-badge-owner">Approved</Badge> : null}
            {isMintConfirmed ? (
              <Badge className="agent-badge-owner">Minted</Badge>
            ) : null}
          </div>
          <CardTitle>{ready.publicProfile.name}</CardTitle>
          <CardDescription>{ready.publicProfile.description}</CardDescription>
        </div>
        <div className="create-review-actions">
          {isMintConfirmed && mintedTokenId ? (
            <Link
              className={buttonVariants({ size: "lg" })}
              href={`/agents/${mintedTokenId}`}
            >
              Open minted agent
            </Link>
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
                disabled={!canMintGenesis}
                onClick={onMint}
                type="button"
                variant="secondary"
              >
                {isMinting ? "Minting..." : "Mint iNFT"}
              </Button>
            </>
          )}
          <Button onClick={onClear} type="button" variant="outline">
            {isMintConfirmed ? "Create another" : "Clear review"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isMintConfirmed ? (
          <Alert className="ui-alert-success create-inline-alert">
            <AlertTitle>Mint confirmed</AlertTitle>
            <AlertDescription>
              The agent is on-chain and ready to open from the gallery.
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
          <Metric label="Usage fee" value={`${usageFeeOg.trim() || "0"} 0G`} />
          <Metric
            label="Breeding fee"
            value={`${breedingFeeOg.trim() || "0"} 0G`}
          />
          <Metric
            label="Skills"
            value={ready.publicProfile.skills.length.toString()}
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
              <ReviewSummary ready={ready} />
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
              <TechnicalReview
                mintTxHash={mintTxHash}
                mintedTokenId={mintedTokenId}
                ready={ready}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ReviewSummary({ ready }: { ready: GenesisReadyPayload }) {
  return (
    <div className="create-summary-grid">
      {ready.publicProfile.expertiseType ? (
        <Metric label="Expertise" value={ready.publicProfile.expertiseType} />
      ) : null}
      {ready.publicProfile.sourceLabels?.length ? (
        <Metric
          label="Sources"
          value={ready.publicProfile.sourceLabels.join(", ")}
        />
      ) : null}
      {ready.publicProfile.desiredCapabilities?.length ? (
        <Metric
          label="Capabilities"
          value={ready.publicProfile.desiredCapabilities.join(", ")}
        />
      ) : null}
      {!ready.publicProfile.expertiseType &&
      !ready.publicProfile.sourceLabels?.length &&
      !ready.publicProfile.desiredCapabilities?.length ? (
        <Alert className="ui-alert-info">
          <AlertTitle>Public profile generated</AlertTitle>
          <AlertDescription>
            Review the skills and private model before approving the mint.
          </AlertDescription>
        </Alert>
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
              {skill.creationBasis ? <Badge>{formatSkillBasis(skill)}</Badge> : null}
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
          This artifact did not include a private worldview summary.
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
  mintedTokenId,
  ready,
}: {
  mintTxHash: `0x${string}` | null;
  mintedTokenId: string | null;
  ready: GenesisReadyPayload;
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
            Mint transaction
            <span>{shortHex(mintTxHash)}</span>
          </a>
        ) : null}
        {mintedTokenId ? (
          <Link className="external-link" href={`/agents/${mintedTokenId}`}>
            Minted agent
            <span>#{mintedTokenId}</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function PipelineCard({
  className,
  events,
  state,
}: {
  className?: string;
  events: string[];
  state: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Pipeline</CardTitle>
        <CardDescription>{state}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="create-pipeline-scroll">
          <ol className="create-status-list">
            {events.length === 0 ? <li>Idle</li> : null}
            {events.map((event, index) => (
              <li key={`${event}-${index}`}>{formatPipelineEvent(event)}</li>
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

function parseSourceLabels(value: string): string[] | undefined {
  const labels = value
    .split(",")
    .map((label) => label.trim())
    .filter(
      (label, index, all) => label.length > 0 && all.indexOf(label) === index
    )
    .slice(0, 20);
  return labels.length > 0 ? labels : undefined;
}

function parseDesiredCapabilities(value: string): string[] | undefined {
  const capabilities = value
    .split(/\n|,/)
    .map((capability) => capability.trim())
    .filter(
      (capability, index, all) =>
        capability.length > 0 && all.indexOf(capability) === index
    )
    .slice(0, 5);
  return capabilities.length > 0 ? capabilities : undefined;
}

function parseSourceUrls(value: string): string[] | undefined {
  const urls = value
    .split(/\s+/)
    .map((url) => url.trim())
    .filter((url, index, all) => url.length > 0 && all.indexOf(url) === index)
    .slice(0, 8);
  return urls.length > 0 ? urls : undefined;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSkillBasis(skill: SkillPackage): string {
  switch (skill.creationBasis) {
    case "user-guided":
      return "user-guided";
    case "llm-discovered":
      return "LLM-discovered";
    case "merged":
      return "merged";
    default:
      return "";
  }
}

function getForgeDisabledReason(input: {
  hasAddress: boolean;
  hasSource: boolean;
  isForging: boolean;
  isSigning: boolean;
}): string | null {
  if (input.isSigning) return "Waiting for wallet signature.";
  if (input.isForging) return "Agent creation is running.";
  if (!input.hasAddress) return "Connect your wallet to enable Forge genesis.";
  if (!input.hasSource) {
    return "Add a source URL, attach a text file, or paste source text.";
  }
  return null;
}

function formatPipelineState(genesis: {
  isSigning: boolean;
  isForging: boolean;
  isMinting: boolean;
  isMintConfirmed?: boolean;
  events: string[];
  ready: unknown;
}): string {
  if (genesis.isSigning) return "Waiting for your wallet signature.";
  if (genesis.isMinting) return "Waiting for mint confirmation.";
  if (genesis.isForging) return "Creating the agent.";
  if (genesis.isMintConfirmed) return "Mint confirmed.";
  if (genesis.ready) return "Review is ready. Approve it before minting.";
  if (genesis.events.length === 0) return "No run has started yet.";
  return "Latest run is complete or stopped.";
}

function formatPipelineEvent(event: string): string {
  switch (event) {
    case "fetching-source":
      return "Fetching source URL";
    case "preparing-sources":
      return "Preparing source material";
    case "extracting-source-chunk":
      return "Extracting large-source chunk";
    case "preparing":
      return "Preparing unlock key";
    case "synthesizing-worldview":
      return "Synthesizing private worldview";
    case "synthesizing-skills":
      return "Synthesizing public skills";
    case "encrypting":
      return "Encrypting private worldview";
    case "uploading":
      return "Uploading public/private artifacts";
    case "ready":
      return "Review ready";
    case "mint-submitted":
      return "Mint transaction submitted";
    case "mint-confirmed":
      return "Mint confirmed";
    case "setting-usage-fee":
      return "Setting usage fee";
    case "usage-fee-set":
      return "Usage fee set";
    case "setting-breeding-fee":
      return "Setting breeding fee";
    case "breeding-fee-set":
      return "Breeding fee set";
    default:
      return event;
  }
}
