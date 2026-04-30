import {
  createThoughtLineChainReader,
  type ThoughtLineChainReaderEnv,
} from "../chain/reader";
import type { PublicAgentSource } from "./public-agents";

export type ChainPublicAgentSourceEnv = ThoughtLineChainReaderEnv;

export function createChainPublicAgentSource(
  env: ChainPublicAgentSourceEnv = process.env
): PublicAgentSource {
  return createThoughtLineChainReader(env);
}
