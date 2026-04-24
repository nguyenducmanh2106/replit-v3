import { openai } from "@workspace/integrations-openai-ai-server";
import { gemini } from "@workspace/integrations-google-ai-server";

export type AIProvider = "openai" | "googleai";

export const PROVIDER = (process.env.AI_PROVIDER ?? "openai") as AIProvider;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  jsonMode?: boolean;
}

export async function chat(
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<string> {
  const { model, maxTokens, jsonMode } = opts;

  if (PROVIDER === "googleai") {
    const last = messages[messages.length - 1];
    const history = messages.slice(0, -1);
    const contents: Array<{ parts: Array<{ text: string }> }> = [
      ...history.map((m) => ({
        parts: [{ text: `${m.role === "system" ? "system" : m.role}: ${m.content}` }],
      })),
      { parts: [{ text: last.content }] },
    ];

    const config: Record<string, unknown> = {};
    if (maxTokens) config.maxOutputTokens = maxTokens;
    if (jsonMode) config.generateContentConfig = { responseMimeType: "application/json" };

    const modelName = model ?? "gemini-2.5-flash-lite";
    console.log({
      model: modelName,
      contents,
      config,
    })
    const response = await (gemini as any).models.generateContent({
      model: modelName,
      contents,
      config,
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  const openaiMessages = messages.map((m) =>
    m.role === "system"
      ? ({ role: "system" as const, content: m.content })
      : ({ role: m.role as "user" | "assistant", content: m.content })
  );

  const response = await openai.chat.completions.create({
    model: model ?? "gpt-5-mini",
    max_completion_tokens: maxTokens,
    messages: openaiMessages,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  });

  return response.choices[0]?.message?.content ?? "";
}
