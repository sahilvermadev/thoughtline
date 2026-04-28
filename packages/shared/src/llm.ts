export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LLMProvider {
  chat(messages: LLMMessage[]): Promise<LLMResponse>;
  chatStream(
    messages: LLMMessage[]
  ): AsyncIterable<{ content: string; done: boolean }>;
}
