import { GoogleGenAI } from "@google/genai";

let _gemini: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (_gemini) return _gemini;
  const apiKey = process.env.AI_INTEGRATIONS_GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_INTEGRATIONS_GOOGLE_API_KEY must be set. Did you forget to provision the Google AI integration?"
    );
  }
  const vertexai = process.env.AI_INTEGRATIONS_GOOGLE_VERTEXAI === "true";
  _gemini = new GoogleGenAI({
    apiKey,
    vertexai,
    ...(vertexai
      ? {
          project: process.env.AI_INTEGRATIONS_GOOGLE_PROJECT_ID,
          location: process.env.AI_INTEGRATIONS_GOOGLE_LOCATION,
        }
      : {}),
  });
  return _gemini;
}

export const gemini = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    return (getGeminiClient() as any)[prop];
  },
});
