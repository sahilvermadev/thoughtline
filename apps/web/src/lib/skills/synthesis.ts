import type {
  LLMProvider,
  PrivateWorldview,
  PublicProfile,
  SkillPackage,
} from "@thoughtline/shared";
import { skillPackageSchema } from "@thoughtline/shared";
import { z } from "zod";
import { extractStructured } from "../llm/extract-structured.js";

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
}

export interface SkillParentInput {
  id: string;
  publicProfile: PublicProfile;
  privateWorldview: PrivateWorldview;
}

export interface SynthesizeChildSkillsInput {
  childName: string;
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
        content: `Create 3-5 public skill packages for a new ThoughtLine advisor agent.

Agent name: ${input.agentName}

Private worldview summary for grounding only. Do not copy private wording into public skill markdown:
${JSON.stringify(input.privateWorldview, null, 2)}

Source text:
${input.sourcesText}

Each skill package must have:
- id: kebab-case stable id
- name: human-readable capability name
- description: short public description
- skillMarkdown: SKILL.md-style markdown with frontmatter, "When to Use", "Inputs", "Procedure", and "Output" sections
- source: "genesis"
- parentSkillIds: []

Respond ONLY with JSON: {"skills": SkillPackage[]}.`,
      },
    ],
    genesisSkillsSchema
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
        content: `Create 3-6 public skill packages for a bred ThoughtLine child agent.

Child name: ${input.childName}
Child private worldview for grounding only. Do not copy private wording into public skill markdown:
${JSON.stringify(input.childWorldview, null, 2)}

Parent A public profile:
${JSON.stringify(input.parentA.publicProfile, null, 2)}

Parent B public profile:
${JSON.stringify(input.parentB.publicProfile, null, 2)}

Rules:
- Do NOT automatically union parent skills.
- Choose skills that fit the child worldview.
- Each child skill source must be one of "inherited", "adapted", or "synthesized".
- Use parentSkillIds to cite parent skills that influenced each child skill.
- At least one skill should be "adapted" or "synthesized" when parent skills differ meaningfully.
- skillMarkdown must be SKILL.md-style markdown with frontmatter, "When to Use", "Inputs", "Procedure", and "Output" sections.
- Public skill markdown must not reveal private worldview text.

Respond ONLY with JSON: {"skills": SkillPackage[]}.`,
      },
    ],
    childSkillsSchema
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
    ...worldview.values,
    ...worldview.heuristics,
    ...worldview.blindspots,
    worldview.freeform,
  ];

  return values
    .map(normalize)
    .filter((value) => value.length >= 24)
    .map((value) => value.slice(0, 80));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
