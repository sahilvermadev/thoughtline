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
}

export interface CreateFromTextDeps {
  llm: LLMProvider;
  archive: AgentArchive;
  emit?: ProgressEmitter;
}

const MAX_TOTAL_CHARS = 50_000;

const agentExtractionSchema = z.object({
  privateWorldview: privateWorldviewSchema,
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
      },
      emit: deps.emit,
      synthesizeGenome: async () => {
        const sourcesText = await prepareSourcesText(llm, sources);
        const expertiseContext = [
          input.expertiseType
            ? `Expertise type / positioning: ${input.expertiseType}`
            : null,
          input.sourceLabels && input.sourceLabels.length > 0
            ? `Source labels: ${input.sourceLabels.join(", ")}`
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
              content: `Extract the private worldview for a ThoughtLine expertise agent from the following sources. The text may include expertise notes, examples, work samples, source excerpts, decision-making approach, and concrete capabilities.

${expertiseContext}

${sourcesText}

Respond with a JSON object:
{
  "privateWorldview": {
    "values": string[] (1-10 core values or professional standards identified in the text),
    "heuristics": string[] (1-10 decision-making rules, operating principles, or capability patterns),
    "blindspots": string[] (0-10 biases, gaps, or situations where the expertise may not apply),
    "decisionStyle": "analytical" | "intuitive" | "deliberative" | "adaptive" | "contrarian",
    "freeform": string (a rich private operating model synthesized from the sources, max 5000 chars)
  }
}

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

function optionalText<K extends "expertiseType" | "positioning">(
  key: K,
  value: string | undefined
): Pick<PublicProfileMetadata, K> | Record<string, never> {
  const trimmed = value?.trim();
  return trimmed ? ({ [key]: trimmed } as Pick<PublicProfileMetadata, K>) : {};
}

type PublicProfileMetadata = {
  expertiseType?: string;
  positioning?: string;
};

async function prepareSourcesText(
  llm: LLMProvider,
  sources: TextSource[]
): Promise<string> {
  const totalChars = sources.reduce((sum, s) => sum + s.text.length, 0);

  if (totalChars <= MAX_TOTAL_CHARS) {
    return sources
      .map((s, i) => {
        const label = s.label ? ` (${s.label})` : "";
        return `--- Source ${i + 1}${label} ---\n${s.text}`;
      })
      .join("\n\n");
  }

  const summaries = await Promise.all(
    sources.map(async (s, i) => {
      const label = s.label ? ` (${s.label})` : "";
      const res = await llm.chat([
        {
          role: "system",
          content:
            "Summarize the following text, preserving the author's values, decision-making principles, worldview, and personality. Be concise but capture the essence.",
        },
        { role: "user", content: s.text },
      ]);
      return `--- Source ${i + 1}${label} ---\n${res.content}`;
    })
  );

  return summaries.join("\n\n");
}
