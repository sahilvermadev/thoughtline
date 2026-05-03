import { z } from "zod";

export const decisionStyleSchema = z.enum([
  "analytical",
  "intuitive",
  "deliberative",
  "adaptive",
  "contrarian",
]);

export type DecisionStyle = z.infer<typeof decisionStyleSchema>;

function boundedString(maxChars: number) {
  return z
    .string()
    .transform((value) => value.trim().slice(0, maxChars))
    .pipe(z.string().min(1));
}

function boundedArray<T extends z.ZodTypeAny>(
  itemSchema: T,
  maxItems: number
) {
  return z.array(itemSchema).transform((items) => items.slice(0, maxItems));
}

const evidenceLabelsSchema = boundedArray(boundedString(100), 10).optional();

export const operatingModelSchema = z.object({
  identity: z.object({
    role: boundedString(240),
    background: boundedString(1000),
    expertiseBoundary: boundedString(1000),
    influences: boundedArray(boundedString(240), 12).optional(),
  }),
  worldview: z.object({
    coreBeliefs: boundedArray(boundedString(400), 10).pipe(
      z.array(z.string().min(1)).min(1)
    ),
    defaultAssumptions: boundedArray(boundedString(400), 10),
    tensions: boundedArray(
      z.object({
        tension: boundedString(500),
        poles: z.tuple([boundedString(240), boundedString(240)]),
        howToResolve: boundedString(700),
        evidenceLabels: evidenceLabelsSchema,
      }),
      8
    ).optional(),
  }),
  decisionMaking: z.object({
    tradeoffRules: boundedArray(
      z.object({
        when: boundedString(500),
        prefer: boundedString(500),
        over: boundedString(500),
        rationale: boundedString(1000),
        evidenceLabels: evidenceLabelsSchema,
      }),
      8
    ),
    rubrics: boundedArray(
      z.object({
        domain: boundedString(240),
        criteria: boundedArray(boundedString(240), 10).pipe(
          z.array(z.string().min(1)).min(1)
        ),
        redFlags: boundedArray(boundedString(240), 10),
        greenFlags: boundedArray(boundedString(240), 10),
        evidenceLabels: evidenceLabelsSchema,
      }),
      6
    ),
    confidenceModel: z.object({
      highConfidenceWhen: boundedArray(boundedString(240), 8),
      lowConfidenceWhen: boundedArray(boundedString(240), 8),
      askClarifyingQuestionsWhen: boundedArray(boundedString(240), 8),
    }),
  }),
  persona: z.object({
    tone: boundedString(160),
    temperament: boundedString(160),
    communicationStyle: boundedString(320),
  }),
  boundaries: z.object({
    refuses: boundedArray(boundedString(240), 10),
    escalates: boundedArray(boundedString(240), 10),
    asksClarifyingQuestionsWhen: boundedArray(boundedString(240), 10),
  }),
  examples: z.object({
    decisionExamples: boundedArray(
      z.object({
        situation: boundedString(700),
        judgment: boundedString(700),
        reasoning: boundedString(1000),
        evidenceLabels: evidenceLabelsSchema,
      }),
      6
    ),
    phrasingExamples: boundedArray(boundedString(300), 8),
  }),
});

export type OperatingModel = z.infer<typeof operatingModelSchema>;

export const styleModelSchema = z.object({
  voicePrinciples: boundedArray(boundedString(300), 10).pipe(
    z.array(z.string().min(1)).min(1)
  ),
  vocabulary: z.object({
    uses: boundedArray(boundedString(120), 30),
    avoids: boundedArray(boundedString(120), 30),
  }),
  rhetoricalMoves: boundedArray(boundedString(300), 12),
  toneShifts: boundedArray(
    z.object({
      context: boundedString(240),
      tone: boundedString(240),
    }),
    8
  ),
  antiPatterns: boundedArray(boundedString(300), 12),
  examples: z.object({
    good: boundedArray(
      z.object({
        text: boundedString(700),
        why: boundedString(500),
        evidenceLabels: evidenceLabelsSchema,
      }),
      8
    ),
    bad: boundedArray(
      z.object({
        text: boundedString(700),
        why: boundedString(500),
      }),
      8
    ),
  }),
  platformNotes: boundedArray(boundedString(300), 8).optional(),
});

export type StyleModel = z.infer<typeof styleModelSchema>;

export const privateWorldviewSchema = z.object({
  values: boundedArray(boundedString(400), 10).pipe(
    z.array(z.string().min(1)).min(1)
  ),
  heuristics: boundedArray(boundedString(500), 10).pipe(
    z.array(z.string().min(1)).min(1)
  ),
  blindspots: boundedArray(boundedString(500), 10),
  decisionStyle: decisionStyleSchema,
  freeform: boundedString(5000),
  operatingModel: operatingModelSchema.optional(),
  styleModel: styleModelSchema.optional(),
});

export type PrivateWorldview = z.infer<typeof privateWorldviewSchema>;

export const skillSourceSchema = z.enum([
  "genesis",
  "inherited",
  "adapted",
  "synthesized",
]);

export type SkillSource = z.infer<typeof skillSourceSchema>;

export const skillCreationBasisSchema = z.enum([
  "user-guided",
  "llm-discovered",
  "merged",
]);

export type SkillCreationBasis = z.infer<typeof skillCreationBasisSchema>;

export const skillPackageSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  skillMarkdown: z.string().min(1).max(8000),
  source: skillSourceSchema,
  parentSkillIds: z.array(z.string()).max(10),
  creationBasis: skillCreationBasisSchema.optional(),
});

export type SkillPackage = z.infer<typeof skillPackageSchema>;

export const publicProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  skills: z.array(skillPackageSchema).min(1).max(8),
  parentIds: z.tuple([z.string(), z.string()]).nullable(),
  generation: z.number().int().min(0),
  createdAt: z.string().datetime(),
  expertiseType: z.string().min(1).max(200).optional(),
  sourceLabels: z.array(z.string().min(1).max(100)).max(20).optional(),
  sourceCount: z.number().int().min(0).optional(),
  desiredCapabilities: z.array(z.string().min(1).max(160)).max(5).optional(),
  positioning: z.string().min(1).max(1000).optional(),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;

export const agentMetadataSchema = z.object({
  publicProfile: publicProfileSchema,
  privateWorldview: privateWorldviewSchema,
});

export type AgentMetadata = z.infer<typeof agentMetadataSchema>;

// Backwards-compatible aliases while the web app moves to the split genome.
export const worldviewSchema = privateWorldviewSchema;
export type Worldview = PrivateWorldview;
