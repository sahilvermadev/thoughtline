import type {
  LLMProvider,
  PrivateWorldview,
  PublicProfile,
  SkillPackage,
} from "@thoughtline/shared";
import { skillPackageSchema } from "@thoughtline/shared";
import { z } from "zod";
import { extractStructured } from "../llm/extract-structured";

const genesisSkillsSchema = z.object({
  skills: z.array(skillPackageSchema).min(1).max(5),
});

const childSkillsSchema = z.object({
  skills: z.array(skillPackageSchema).min(1).max(6),
});

export interface SynthesizeGenesisSkillsInput {
  agentName: string;
  sourcesText: string;
  privateWorldview: PrivateWorldview;
  expertiseType?: string;
  sourceLabels?: string[];
  desiredCapabilities?: string[];
}

export interface SkillParentInput {
  id: string;
  publicProfile: PublicProfile;
  privateWorldview: PrivateWorldview;
}

export interface SynthesizeChildSkillsInput {
  childName: string;
  childBrief?: string;
  childWorldview: PrivateWorldview;
  parentA: SkillParentInput;
  parentB: SkillParentInput;
}

export async function synthesizeGenesisSkills(
  llm: LLMProvider,
  input: SynthesizeGenesisSkillsInput
): Promise<SkillPackage[]> {
  const result = await extractStructured(
    llm,
    [
      {
        role: "user",
        content: `Create 3-5 public skill packages for a new ThoughtLine expertise agent. The skills must read as concrete buyer-facing capabilities, not generic advice categories.

Agent name: ${input.agentName}
Expertise type / positioning: ${input.expertiseType ?? "Not specified"}
Source labels: ${
          input.sourceLabels && input.sourceLabels.length > 0
            ? input.sourceLabels.join(", ")
            : "Not specified"
        }
Desired capabilities from creator: ${
          input.desiredCapabilities && input.desiredCapabilities.length > 0
            ? input.desiredCapabilities.join("; ")
            : "Not specified"
        }

Private worldview and style model for grounding only. Do not copy private wording into public skill markdown:
${JSON.stringify(input.privateWorldview, null, 2)}

Operating model summary for capability coherence:
${summarizeOperatingModelForPrompt(input.privateWorldview)}

Source evidence. For large inputs this contains chunk-level extracts rather than raw oversized text:
${input.sourcesText}

Each skill package must have:
- id: kebab-case stable id
- name: human-readable capability name framed around an outcome a buyer would recognize
- description: short public description with clear input and output expectations
- skillMarkdown: SKILL.md-style markdown with frontmatter, "When to Use", "Inputs", "Procedure", and "Output" sections. The Inputs and Output sections must be specific enough for a buyer to understand what to provide and what they receive.
- source: "genesis"
- parentSkillIds: []
- creationBasis: "user-guided" when the skill directly follows a desired capability, "llm-discovered" when inferred from source material, or "merged" when combining creator intent with an LLM-discovered capability.
- Avoid generic "advisor", "coach", or "strategy" skills unless the source text supports a narrower capability.
- Desired capabilities are soft guidance. Preserve creator intent where source material supports it, but merge, rename, or drop weak capabilities when needed.
- Let source-grounded style and judgment patterns influence procedure wording, but describe the agent as derived from sources or source patterns. Do not claim the agent literally is a source author or real person.

Respond ONLY with JSON: {"skills": SkillPackage[]}.`,
      },
    ],
    genesisSkillsSchema,
    { maxRetries: 4 }
  );

  return assertNoPrivateWorldviewLeakage(
    result.skills.map((skill) => ({
      ...skill,
      source: "genesis" as const,
      parentSkillIds: [],
    })),
    [input.privateWorldview]
  );
}

export async function synthesizeChildSkills(
  llm: LLMProvider,
  input: SynthesizeChildSkillsInput
): Promise<SkillPackage[]> {
  const result = await extractStructured(
    llm,
    [
      {
        role: "user",
        content: `Create 3-6 public skill packages for a bred ThoughtLine child expertise agent. The skills must be concrete buyer-facing capabilities for the child's intended purpose.

Child name: ${input.childName}
Child brief / intended marketable purpose: ${input.childBrief ?? "Not specified"}
Child private worldview for grounding only. Do not copy private wording into public skill markdown:
${JSON.stringify(input.childWorldview, null, 2)}

Parent A public profile:
${JSON.stringify(input.parentA.publicProfile, null, 2)}

Parent B public profile:
${JSON.stringify(input.parentB.publicProfile, null, 2)}

Rules:
- Do NOT automatically union parent skills.
- Choose skills that fit the child worldview and the child brief.
- Each child skill source must be one of "inherited", "adapted", or "synthesized".
- Use parentSkillIds to cite parent skills that influenced each child skill.
- At least one skill should be "adapted" or "synthesized" when parent skills differ meaningfully.
- skillMarkdown must be SKILL.md-style markdown with frontmatter, "When to Use", "Inputs", "Procedure", and "Output" sections. Inputs and outputs must be specific, inspectable, and useful to a potential buyer.
- Public skill markdown must not reveal private worldview text.

Respond ONLY with JSON: {"skills": SkillPackage[]}.`,
      },
    ],
    childSkillsSchema,
    { maxRetries: 4 }
  );

  return assertNoPrivateWorldviewLeakage(result.skills, [
    input.parentA.privateWorldview,
    input.parentB.privateWorldview,
    input.childWorldview,
  ]);
}

export function assertNoPrivateWorldviewLeakage(
  skills: SkillPackage[],
  privateWorldviews: PrivateWorldview[]
): SkillPackage[] {
  const privateSnippets = privateWorldviews.flatMap(extractPrivateSnippets);

  for (const skill of skills) {
    const publicText = [
      skill.name,
      skill.description,
      skill.skillMarkdown,
    ].join("\n");
    const normalizedPublic = normalize(publicText);

    for (const snippet of privateSnippets) {
      if (normalizedPublic.includes(snippet)) {
        throw new Error(
          `Public skill package "${skill.id}" leaks private worldview text`
        );
      }
    }
  }

  return skills;
}

function extractPrivateSnippets(worldview: PrivateWorldview): string[] {
  const values = [
    worldview.freeform,
    ...worldview.blindspots,
    ...extractLongPrivateLeafStrings(worldview.operatingModel),
    ...extractLongPrivateLeafStrings(worldview.styleModel),
  ];

  return values
    .map(normalize)
    .filter((value) => value.length >= 80);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractLongPrivateLeafStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(extractLongPrivateLeafStrings);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(extractLongPrivateLeafStrings);
  }
  return [];
}

function summarizeOperatingModelForPrompt(worldview: PrivateWorldview): string {
  const model = worldview.operatingModel;
  if (!model) {
    return "Not provided. Use the values, heuristics, decision style, and source text.";
  }

  return JSON.stringify(
    {
      identity: model.identity,
      coreBeliefs: model.worldview.coreBeliefs,
      tradeoffRules: model.decisionMaking.tradeoffRules,
      rubrics: model.decisionMaking.rubrics,
      confidenceModel: model.decisionMaking.confidenceModel,
      persona: model.persona,
      boundaries: model.boundaries,
      decisionExamples: model.examples.decisionExamples,
    },
    null,
    2
  );
}
