import type { LLMProvider } from "@thoughtline/shared";
import { privateWorldviewSchema, skillPackageSchema } from "@thoughtline/shared";
import { z } from "zod";
import { extractStructured } from "../llm/extract-structured.js";
import type { AgentArchive } from "../agent-archive/index.js";
import { forgeAgent, type ForgedAgent } from "../forge/forge-agent.js";
import type { EncryptionKey } from "../crypto/index.js";

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
}

const MAX_TOTAL_CHARS = 50_000;

const agentExtractionSchema = z.object({
  privateWorldview: privateWorldviewSchema,
  skills: z.array(skillPackageSchema).min(1).max(5),
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
      synthesizeGenome: async () => {
        const sourcesText = await prepareSourcesText(llm, sources);
        const extracted = await extractStructured(
          llm,
          [
            {
              role: "user",
              content: `Extract a ThoughtLine agent genome from the following sources. The text describes a person's values, decision-making approach, perspective, and concrete capabilities.

${sourcesText}

Respond with a JSON object:
{
  "privateWorldview": {
    "values": string[] (1-10 core values identified in the text),
    "heuristics": string[] (1-10 decision-making rules or principles),
    "blindspots": string[] (0-10 biases or gaps in reasoning),
    "decisionStyle": "analytical" | "intuitive" | "deliberative" | "adaptive" | "contrarian",
    "freeform": string (a rich persona description synthesized from the sources, max 5000 chars)
  },
  "skills": SkillPackage[] (3-5 public SKILL.md-style capability packages)
}

Each skill package must have:
- id: kebab-case stable id
- name: human-readable capability name
- description: short public description
- skillMarkdown: markdown with frontmatter, "When to Use", "Inputs", "Procedure", and "Output" sections
- source: "genesis"
- parentSkillIds: []

Respond ONLY with valid JSON, no other text.`,
            },
          ],
          agentExtractionSchema
        );

        return {
          privateWorldview: extracted.privateWorldview,
          skills: extracted.skills.map((skill) => ({
            ...skill,
            source: "genesis" as const,
            parentSkillIds: [],
          })),
        };
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
