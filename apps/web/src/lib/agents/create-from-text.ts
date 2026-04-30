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
      emit: deps.emit,
      synthesizeGenome: async () => {
        const sourcesText = await prepareSourcesText(llm, sources);
        await emitProgress(deps.emit, "synthesizing-worldview");
        const extracted = await extractStructured(
          llm,
          [
            {
              role: "user",
              content: `Extract the private worldview for a ThoughtLine agent from the following sources. The text describes a person's values, decision-making approach, perspective, and concrete capabilities.

${sourcesText}

Respond with a JSON object:
{
  "privateWorldview": {
    "values": string[] (1-10 core values identified in the text),
    "heuristics": string[] (1-10 decision-making rules or principles),
    "blindspots": string[] (0-10 biases or gaps in reasoning),
    "decisionStyle": "analytical" | "intuitive" | "deliberative" | "adaptive" | "contrarian",
    "freeform": string (a rich persona description synthesized from the sources, max 5000 chars)
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
        });

        return { privateWorldview: extracted.privateWorldview, skills };
      },
    },
    { llm, archive }
  );
}

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
