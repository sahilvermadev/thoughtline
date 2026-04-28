import type {
  LLMProvider,
  StorageProvider,
  AgentMetadata,
  Worldview,
} from "@thoughtline/shared";
import { worldviewSchema } from "@thoughtline/shared";
import { extractStructured } from "../llm/extract-structured.js";

export interface TextSource {
  label?: string;
  text: string;
}

export interface CreateFromTextInput {
  name: string;
  sources: TextSource[];
}

export interface CreateFromTextDeps {
  llm: LLMProvider;
  storage: StorageProvider;
}

export interface CreatedAgent {
  name: string;
  description: string;
  worldview: Worldview;
  generation: number;
  parentIds: null;
  storageUri: string;
}

const MAX_TOTAL_CHARS = 50_000;

export async function createAgentFromText(
  input: CreateFromTextInput,
  deps: CreateFromTextDeps
): Promise<CreatedAgent> {
  const { name, sources } = input;
  const { llm, storage } = deps;

  if (!name.trim()) throw new Error("Name is required");
  if (sources.length === 0) throw new Error("At least one source is required");

  const totalChars = sources.reduce((sum, s) => sum + s.text.length, 0);
  const needsSummarization = totalChars > MAX_TOTAL_CHARS;

  let sourcesText: string;

  if (needsSummarization) {
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
    sourcesText = summaries.join("\n\n");
  } else {
    sourcesText = sources
      .map((s, i) => {
        const label = s.label ? ` (${s.label})` : "";
        return `--- Source ${i + 1}${label} ---\n${s.text}`;
      })
      .join("\n\n");
  }

  const worldview = await extractStructured(
    llm,
    [
      {
        role: "user",
        content: `Extract a structured worldview from the following sources. The text describes a person's values, decision-making approach, and perspective.

${sourcesText}

Extract a worldview JSON object with:
- values: string[] (1-10 core values identified in the text)
- heuristics: string[] (1-10 decision-making rules or principles)
- blindspots: string[] (0-10 biases or gaps in reasoning)
- decisionStyle: "analytical" | "intuitive" | "deliberative" | "adaptive" | "contrarian"
- freeform: string (a rich persona description synthesized from the sources, max 5000 chars)

Respond ONLY with valid JSON, no other text.`,
      },
    ],
    worldviewSchema
  );

  const descriptionResponse = await llm.chat([
    {
      role: "system",
      content:
        "Write a concise description (1-2 sentences, max 500 chars) of this AI advisor agent based on their worldview. No JSON, just plain text.",
    },
    {
      role: "user",
      content: `Agent name: ${name}\n\nWorldview:\n${JSON.stringify(worldview, null, 2)}`,
    },
  ]);

  const description = descriptionResponse.content.trim();

  const metadata: AgentMetadata = {
    name,
    description,
    worldview,
    parentIds: null,
    generation: 0,
    createdAt: new Date().toISOString(),
  };

  const storageUri = await storage.upload(metadata);

  return {
    name,
    description,
    worldview,
    generation: 0,
    parentIds: null,
    storageUri,
  };
}
