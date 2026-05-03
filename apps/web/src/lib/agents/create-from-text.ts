import type { LLMProvider } from "@thoughtline/shared";
import { privateWorldviewSchema } from "@thoughtline/shared";
import { z } from "zod";
import { extractStructured } from "../llm/extract-structured";
import type { AgentArchive } from "../agent-archive/index";
import { forgeAgent, type ForgedAgent } from "../forge/forge-agent";
import type { EncryptionKey } from "../crypto/index";
import { synthesizeGenesisSkills } from "../skills/synthesis";
import { emitProgress, type ProgressEmitter } from "../progress";

export interface TextSource {
  label?: string;
  text: string;
}

export interface CreateFromTextInput {
  name: string;
  sources: TextSource[];
  encryptionKey: EncryptionKey;
  expertiseType?: string;
  sourceLabels?: string[];
  desiredCapabilities?: string[];
}

export interface CreateFromTextDeps {
  llm: LLMProvider;
  archive: AgentArchive;
  emit?: ProgressEmitter;
}

const RAW_SOURCE_TOTAL_CHARS = 80_000;
const SOURCE_CHUNK_CHARS = 24_000;
const CHUNK_EXTRACTION_CONCURRENCY = 1;

const agentExtractionSchema = z.object({
  privateWorldview: privateWorldviewSchema,
});

const chunkExtractionSchema = z.object({
  claims: z.array(z.string().min(1).max(500)).max(20),
  heuristics: z.array(z.string().min(1).max(500)).max(20),
  tradeoffs: z
    .array(
      z.object({
        when: z.string().min(1).max(500),
        prefer: z.string().min(1).max(500),
        over: z.string().min(1).max(500),
        evidence: z.string().min(1).max(700),
      })
    )
    .max(12),
  vocabulary: z.object({
    uses: z.array(z.string().min(1).max(120)).max(30),
    avoids: z.array(z.string().min(1).max(120)).max(30),
  }),
  examples: z
    .array(
      z.object({
        situation: z.string().min(1).max(500),
        judgment: z.string().min(1).max(500),
        reasoning: z.string().min(1).max(700),
      })
    )
    .max(10),
  contradictions: z.array(z.string().min(1).max(500)).max(10),
  influences: z.array(z.string().min(1).max(240)).max(12),
  voice: z.array(z.string().min(1).max(300)).max(12),
  evidenceLabels: z
    .array(z.string().min(1).max(500))
    .max(10)
    .transform((labels) =>
      labels.map((label) => label.trim().slice(0, 100)).filter(Boolean)
    ),
});

export async function createAgentFromText(
  input: CreateFromTextInput,
  deps: CreateFromTextDeps
): Promise<ForgedAgent> {
  const { name, sources, encryptionKey } = input;
  const { llm, archive } = deps;

  if (sources.length === 0) throw new Error("At least one source is required");

  return forgeAgent(
    {
      name,
      parents: null,
      encryptionKey,
      publicMetadata: {
        ...optionalText("expertiseType", input.expertiseType),
        ...optionalText("positioning", input.expertiseType),
        sourceLabels: normalizeSourceLabels(input.sourceLabels),
        sourceCount: sources.length,
        desiredCapabilities: normalizeDesiredCapabilities(
          input.desiredCapabilities
        ),
      },
      emit: deps.emit,
      synthesizeGenome: async () => {
        const sourcesText = await prepareSourcesText(llm, sources, deps.emit);
        const expertiseContext = [
          input.expertiseType
            ? `Expertise type / positioning: ${input.expertiseType}`
            : null,
          input.sourceLabels && input.sourceLabels.length > 0
            ? `Source labels: ${input.sourceLabels.join(", ")}`
            : null,
          input.desiredCapabilities && input.desiredCapabilities.length > 0
            ? `Desired capabilities: ${input.desiredCapabilities.join("; ")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n");
        await emitProgress(deps.emit, "synthesizing-worldview");
        const extracted = await extractStructured(
          llm,
          [
            {
              role: "user",
              content: `Extract the private worldview for a ThoughtLine expertise agent from the following source evidence. The source evidence may be raw text for smaller inputs or chunk-level extracts for larger inputs. Preserve specific judgment, voice, contradictions, named influences, and calibration examples. The output should be specific enough to predict the agent's take on a new topic, not a generic summary.

${expertiseContext}

${sourcesText}

Respond with a JSON object:
{
  "privateWorldview": {
    "values": string[] (1-10 core values or professional standards identified in the text),
    "heuristics": string[] (1-10 decision-making rules, operating principles, or capability patterns),
    "blindspots": string[] (0-10 biases, gaps, or situations where the expertise may not apply),
    "decisionStyle": "analytical" | "intuitive" | "deliberative" | "adaptive" | "contrarian",
    "freeform": string (a rich private operating model synthesized from the sources, max 5000 chars),
    "operatingModel": {
      "identity": {
        "role": string (the agent's specific expert role),
        "background": string (what the source material suggests this judgment is grounded in),
        "expertiseBoundary": string (where this agent is credible and where it is not),
        "influences": string[] optional (named people, schools, texts, companies, contexts, or source traditions that visibly shape judgment)
      },
      "worldview": {
        "coreBeliefs": string[] (1-10 beliefs that shape judgment),
        "defaultAssumptions": string[] (0-10 assumptions this agent starts from),
        "tensions": [
          {
            "tension": string (a real contradiction, balancing act, or unresolved pressure in the source material),
            "poles": [string, string],
            "howToResolve": string,
            "evidenceLabels": string[] optional
          }
        ] optional
      },
      "decisionMaking": {
        "tradeoffRules": [
          {
            "when": string,
            "prefer": string,
            "over": string,
            "rationale": string,
            "evidenceLabels": string[] optional
          }
        ],
        "rubrics": [
          {
            "domain": string,
            "criteria": string[],
            "redFlags": string[],
            "greenFlags": string[],
            "evidenceLabels": string[] optional
          }
        ],
        "confidenceModel": {
          "highConfidenceWhen": string[],
          "lowConfidenceWhen": string[],
          "askClarifyingQuestionsWhen": string[]
        }
      },
      "persona": {
        "tone": string,
        "temperament": string,
        "communicationStyle": string
      },
      "boundaries": {
        "refuses": string[],
        "escalates": string[],
        "asksClarifyingQuestionsWhen": string[]
      },
      "examples": {
        "decisionExamples": [
          {
            "situation": string,
            "judgment": string,
            "reasoning": string,
            "evidenceLabels": string[] optional
          }
        ],
        "phrasingExamples": string[]
      }
    },
    "styleModel": {
      "voicePrinciples": string[] (1-10 concrete style rules),
      "vocabulary": {
        "uses": string[],
        "avoids": string[]
      },
      "rhetoricalMoves": string[] (moves like aphorism, counterexample, calibrated caveat, first-principles reduction),
      "toneShifts": [
        {
          "context": string,
          "tone": string
        }
      ],
      "antiPatterns": string[] (ways this agent should not sound),
      "examples": {
        "good": [
          {
            "text": string,
            "why": string,
            "evidenceLabels": string[] optional
          }
        ],
        "bad": [
          {
            "text": string,
            "why": string
          }
        ]
      },
      "platformNotes": string[] optional
    } optional
  }
}

Operating model rules:
- Extract decision machinery, not just personality traits.
- Preserve real tensions and contradictions instead of smoothing them into bland consistency.
- Capture named influences only when the source evidence supports them.
- Build the style model from repeated phrasing, vocabulary, rhetorical moves, and calibration examples. Do not invent catchphrases.
- Source text is evidence; expertise type and desired capabilities are positioning.
- Use evidenceLabels only from source labels, file labels, or obvious source names in the prompt.
- If evidence is thin, record narrower expertiseBoundary, lowConfidenceWhen, or asksClarifyingQuestionsWhen rather than inventing confidence.

Respond ONLY with valid JSON, no other text.`,
            },
          ],
          agentExtractionSchema
        );

        await emitProgress(deps.emit, "synthesizing-skills");
        const skills = await synthesizeGenesisSkills(llm, {
          agentName: name,
          sourcesText,
          privateWorldview: extracted.privateWorldview,
          expertiseType: input.expertiseType,
          sourceLabels: input.sourceLabels,
          desiredCapabilities: input.desiredCapabilities,
        });

        return { privateWorldview: extracted.privateWorldview, skills };
      },
    },
    { llm, archive }
  );
}

function normalizeSourceLabels(labels: string[] | undefined): string[] | undefined {
  const normalized = labels
    ?.map((label) => label.trim())
    .filter((label, index, all) => label.length > 0 && all.indexOf(label) === index)
    .slice(0, 20);
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeDesiredCapabilities(
  capabilities: string[] | undefined
): string[] | undefined {
  const normalized = capabilities
    ?.map((capability) => capability.trim())
    .filter(
      (capability, index, all) =>
        capability.length > 0 && all.indexOf(capability) === index
    )
    .slice(0, 5);
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function optionalText<K extends "expertiseType" | "positioning">(
  key: K,
  value: string | undefined
): Pick<PublicProfileMetadata, K> | Record<string, never> {
  const trimmed = value?.trim();
  return trimmed ? ({ [key]: trimmed } as Pick<PublicProfileMetadata, K>) : {};
}

type PublicProfileMetadata = {
  expertiseType?: string;
  desiredCapabilities?: string[];
  positioning?: string;
};

async function prepareSourcesText(
  llm: LLMProvider,
  sources: TextSource[],
  emit?: ProgressEmitter
): Promise<string> {
  const totalChars = sources.reduce((sum, s) => sum + s.text.length, 0);

  if (totalChars <= RAW_SOURCE_TOTAL_CHARS) {
    await emitProgress(emit, "preparing-sources", {
      mode: "raw",
      sourceCount: sources.length,
      totalChars,
    });
    return sources
      .map((s, i) => {
        const label = s.label ? ` (${s.label})` : "";
        return `--- Source ${i + 1}${label} ---\n${s.text}`;
      })
      .join("\n\n");
  }

  const chunkTasks = sources.flatMap((source, sourceIndex) => {
    const chunks = splitTextIntoChunks(source.text, SOURCE_CHUNK_CHARS);
    return chunks.map((chunk, chunkIndex) => async () => {
      const label = source.label ? ` (${source.label})` : "";
      await emitProgress(emit, "extracting-source-chunk", {
        sourceIndex: sourceIndex + 1,
        chunkIndex: chunkIndex + 1,
        chunkCount: chunks.length,
        label: source.label,
      });
      const extracted = await extractStructured(
        llm,
        [
          {
            role: "user",
            content: `Extract source-grounded evidence from this chunk for a ThoughtLine private worldview and style model. Preserve specifics; do not summarize into generic advice.

Source ${sourceIndex + 1}${label}, chunk ${chunkIndex + 1} of ${chunks.length}

Chunk text:
${chunk}

Respond ONLY with JSON:
{
  "claims": string[],
  "heuristics": string[],
  "tradeoffs": [{"when": string, "prefer": string, "over": string, "evidence": string}],
  "vocabulary": {"uses": string[], "avoids": string[]},
  "examples": [{"situation": string, "judgment": string, "reasoning": string}],
  "contradictions": string[],
  "influences": string[],
  "voice": string[],
  "evidenceLabels": string[]
}`,
          },
        ],
        chunkExtractionSchema
      );
      return {
        sourceIndex,
        chunkIndex,
        label,
        extracted,
      };
    });
  });
  const chunkExtracts = await runWithConcurrency(
    chunkTasks,
    CHUNK_EXTRACTION_CONCURRENCY
  );

  return chunkExtracts
    .sort(
      (a, b) =>
        a.sourceIndex - b.sourceIndex || a.chunkIndex - b.chunkIndex
    )
    .map(
      ({ sourceIndex, chunkIndex, label, extracted }) =>
        `--- Source ${sourceIndex + 1}${label}, chunk ${chunkIndex + 1} extract ---\n${JSON.stringify(
          extracted,
          null,
          2
        )}`
    )
    .join("\n\n");
}

export function splitTextIntoChunks(text: string, chunkChars: number): string[] {
  if (chunkChars <= 0) throw new Error("chunkChars must be positive");
  const chunks: string[] = [];
  let offset = 0;

  while (offset < text.length) {
    const hardEnd = Math.min(offset + chunkChars, text.length);
    let end = hardEnd;

    if (hardEnd < text.length) {
      const newline = text.lastIndexOf("\n\n", hardEnd);
      const sentence = text.lastIndexOf(". ", hardEnd);
      const candidate = Math.max(newline, sentence);
      if (candidate > offset + Math.floor(chunkChars * 0.6)) {
        end = candidate + (candidate === sentence ? 1 : 0);
      }
    }

    chunks.push(text.slice(offset, end).trim());
    offset = end;
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  if (concurrency <= 0) throw new Error("concurrency must be positive");
  const results: T[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const taskIndex = nextIndex;
      nextIndex += 1;
      results[taskIndex] = await tasks[taskIndex]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  );
  return results;
}
