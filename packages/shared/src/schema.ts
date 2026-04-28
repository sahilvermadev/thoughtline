import { z } from "zod";

export const decisionStyleSchema = z.enum([
  "analytical",
  "intuitive",
  "deliberative",
  "adaptive",
  "contrarian",
]);

export type DecisionStyle = z.infer<typeof decisionStyleSchema>;

export const worldviewSchema = z.object({
  values: z.array(z.string()).min(1).max(10),
  heuristics: z.array(z.string()).min(1).max(10),
  blindspots: z.array(z.string()).max(10),
  decisionStyle: decisionStyleSchema,
  freeform: z.string().max(5000),
});

export type Worldview = z.infer<typeof worldviewSchema>;

export const agentMetadataSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  worldview: worldviewSchema,
  parentIds: z.tuple([z.string(), z.string()]).nullable(),
  generation: z.number().int().min(0),
  createdAt: z.string().datetime(),
});

export type AgentMetadata = z.infer<typeof agentMetadataSchema>;
