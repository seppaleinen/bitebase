import { createOpenAI } from "@ai-sdk/openai";

export function createLocalAI() {
  return createOpenAI({
    baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
    apiKey: "ollama",
  });
}

export function getModel(modelId?: string) {
  const ai = createLocalAI();
  return ai(modelId ?? process.env.OLLAMA_MODEL ?? "llama3.2");
}
