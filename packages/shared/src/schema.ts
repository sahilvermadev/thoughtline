import { z } from "zod";

export const decisionStyleSchema = z.enum([
  "analytical",
  "intuitive",
  "deliberative",
  "adaptive",
  "contrarian",
]);

export type DecisionStyle = z.infer<typeof decisionStyleSchema>;

export const privateWorldviewSchema = z.object({
  values: z.array(z.string()).min(1).max(10),
  heuristics: z.array(z.string()).min(1).max(10),
  blindspots: z.array(z.string()).max(10),
  decisionStyle: decisionStyleSchema,
  freeform: z.string().max(5000),
});

export type PrivateWorldview = z.infer<typeof privateWorldviewSchema>;

export const skillSourceSchema = z.enum([
  "genesis",
  "inherited",
  "adapted",
  "synthesized",
]);

export type SkillSource = z.infer<typeof skillSourceSchema>;

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
