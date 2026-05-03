import type { PrivateWorldview, PublicProfile } from "@thoughtline/shared";
import {
  encodeMintChildCalldata,
  encodeMintGenesisCalldata,
  normalizeBytes32,
} from "../chain/thoughtline";

export interface StoredAgentArtifactInput {
  publicProfile: PublicProfile;
  privateWorldview?: PrivateWorldview;
  publicUri: string;
  publicHash: string;
  privateUri: string;
  dataHash: string;
}

export interface PrivateWorldviewSummary {
  identity: string;
  decisionMaking: string;
  style?: string;
  contradictions?: string;
  confidence: string;
  boundaries: string;
}

export interface StoredAgentPointers {
  publicUri: string;
  privateUri: string;
  dataHash: `0x${string}`;
}

export interface MintTransactionPrep {
  to: `0x${string}` | null;
  data: `0x${string}`;
  chainId: number;
}

export interface GenesisMintArtifact {
  publicProfile: PublicProfile;
  privateWorldview?: PrivateWorldview;
  privateWorldviewSummary?: PrivateWorldviewSummary;
  publicUri: string;
  publicHash: string;
  privateUri: string;
  dataHash: `0x${string}`;
  mintCalldata: `0x${string}`;
  mintTransaction: MintTransactionPrep;
}

export interface ChildMintArtifact extends GenesisMintArtifact {}

export function createGenesisMintArtifact(
  input: StoredAgentArtifactInput,
  env: Record<string, string | undefined> = process.env
): GenesisMintArtifact {
  const dataHash = normalizeStoredAgentDataHash(input.dataHash);
  const mintCalldata = encodeMintGenesisCalldata({
    publicUri: input.publicUri,
    privateUri: input.privateUri,
    dataHash,
  });

  return {
    publicProfile: input.publicProfile,
    privateWorldview: input.privateWorldview,
    privateWorldviewSummary: summarizePrivateWorldview(input.privateWorldview),
    publicUri: input.publicUri,
    publicHash: input.publicHash,
    privateUri: input.privateUri,
    dataHash,
    mintCalldata,
    mintTransaction: {
      to: parseContractAddress(env.NEXT_PUBLIC_CONTRACT_ADDRESS),
      data: mintCalldata,
      chainId: Number(env.NEXT_PUBLIC_CHAIN_ID ?? 16602),
    },
  };
}

export function createChildMintArtifact(
  input: StoredAgentArtifactInput & {
    parentTokenIdA: bigint | number | string;
    parentTokenIdB: bigint | number | string;
  },
  env: Record<string, string | undefined> = process.env
): ChildMintArtifact {
  const dataHash = normalizeStoredAgentDataHash(input.dataHash);
  const mintCalldata = encodeMintChildCalldata({
    publicUri: input.publicUri,
    privateUri: input.privateUri,
    dataHash,
    parentTokenIdA: input.parentTokenIdA,
    parentTokenIdB: input.parentTokenIdB,
  });

  return {
    publicProfile: input.publicProfile,
    privateWorldview: input.privateWorldview,
    privateWorldviewSummary: summarizePrivateWorldview(input.privateWorldview),
    publicUri: input.publicUri,
    publicHash: input.publicHash,
    privateUri: input.privateUri,
    dataHash,
    mintCalldata,
    mintTransaction: {
      to: parseContractAddress(env.NEXT_PUBLIC_CONTRACT_ADDRESS),
      data: mintCalldata,
      chainId: Number(env.NEXT_PUBLIC_CHAIN_ID ?? 16602),
    },
  };
}

export function createStoredAgentPointers(input: {
  publicUri: string;
  privateUri: string;
  dataHash: string;
}): StoredAgentPointers {
  return {
    publicUri: input.publicUri,
    privateUri: input.privateUri,
    dataHash: normalizeStoredAgentDataHash(input.dataHash),
  };
}

export function normalizeStoredAgentDataHash(value: string): `0x${string}` {
  return normalizeBytes32(value);
}

function parseContractAddress(value: string | undefined): `0x${string}` | null {
  if (!value) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`Invalid contract address: ${value}`);
  }
  return value as `0x${string}`;
}

function summarizePrivateWorldview(
  worldview: PrivateWorldview | undefined
): PrivateWorldviewSummary | undefined {
  if (!worldview?.operatingModel) return undefined;

  const model = worldview.operatingModel;
  const firstTradeoff = model.decisionMaking.tradeoffRules[0];
  const decisionMaking = firstTradeoff
    ? `Prefers ${firstTradeoff.prefer} over ${firstTradeoff.over} when ${firstTradeoff.when.toLowerCase()}.`
    : sentenceFromList(model.worldview.coreBeliefs, worldview.heuristics);

  return {
    identity: model.identity.role,
    decisionMaking,
    style: summarizeStyle(worldview),
    contradictions: summarizeContradictions(worldview),
    confidence: summarizeConfidence(model.decisionMaking.confidenceModel),
    boundaries: summarizeBoundaries(model.boundaries),
  };
}

function summarizeStyle(worldview: PrivateWorldview): string | undefined {
  const style = worldview.styleModel;
  if (!style) return undefined;
  const principle = style.voicePrinciples[0];
  const move = style.rhetoricalMoves[0];
  if (principle && move) return `${principle}; often uses ${move.toLowerCase()}.`;
  return principle ?? move;
}

function summarizeContradictions(
  worldview: PrivateWorldview
): string | undefined {
  const tension = worldview.operatingModel?.worldview.tensions?.[0];
  if (!tension) return undefined;
  return `${asSentence(tension.tension)} Resolved by ${asSentence(
    tension.howToResolve.toLowerCase()
  )}`;
}

function summarizeConfidence(input: {
  highConfidenceWhen: string[];
  lowConfidenceWhen: string[];
  askClarifyingQuestionsWhen: string[];
}): string {
  const high = normalizeCondition(input.highConfidenceWhen[0]);
  const ask = combineConditions([
    input.lowConfidenceWhen[0],
    input.askClarifyingQuestionsWhen[0],
  ]);
  if (high && ask) {
    return `High confidence with ${high}; asks for clarification when ${ask}.`;
  }
  if (high) return `High confidence with ${high}.`;
  if (ask) return `Asks for clarification when ${ask}.`;
  return "Confidence depends on source specificity and fit to the agent boundary.";
}

function summarizeBoundaries(input: {
  refuses: string[];
  escalates: string[];
  asksClarifyingQuestionsWhen: string[];
}): string {
  const refuse = input.refuses[0];
  if (refuse) return `Does not ${toGerundPhrase(refuse).toLowerCase()}.`;
  const escalate = input.escalates[0];
  if (escalate) return `Escalates ${escalate.toLowerCase()}.`;
  return "Asks for clarification when the request falls outside its evidence boundary.";
}

function sentenceFromList(primary: string[], fallback: string[]): string {
  return primary[0] ?? fallback[0] ?? "Uses source-grounded heuristics.";
}

function toGerundPhrase(value: string): string {
  return value.replace(/^guaranteeing\b/i, "guarantee");
}

function normalizeCondition(value: string | undefined): string | undefined {
  return value
    ?.trim()
    .replace(/\s+are present$/i, "")
    .replace(/\s+is present$/i, "")
    .toLowerCase();
}

function combineConditions(values: Array<string | undefined>): string | undefined {
  const normalized = values
    .map(normalizeCondition)
    .filter((value): value is string => Boolean(value));
  if (normalized.length === 0) return undefined;
  if (normalized.length === 1) return normalized[0];

  const simplified = normalized.map((value) =>
    value.replace(/\s+is unclear$/i, "").replace(/\s+are unclear$/i, "")
  );
  return `${simplified.join(" or ")} are unclear`;
}

function asSentence(value: string): string {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
