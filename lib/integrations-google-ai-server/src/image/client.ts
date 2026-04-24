import { Buffer } from "node:buffer";
import { GoogleGenAI } from "@google/genai";
import { gemini } from "../client";

export type ImageSize = "1024x1024" | "512x512" | "1792x1024" | "1024x1792";

function mapSize(size: ImageSize): { width: number; height: number } {
  switch (size) {
    case "1024x1024":
      return { width: 1024, height: 1024 };
    case "512x512":
      return { width: 512, height: 512 };
    case "1792x1024":
      return { width: 1792, height: 1024 };
    case "1024x1792":
      return { width: 1024, height: 1792 };
  }
}

export async function generateImageBuffer(
  prompt: string,
  size: ImageSize = "1024x1024"
): Promise<Buffer> {
  const dimensions = mapSize(size);
  const response = await (gemini as unknown as { models: { generateImages: Function } }).models.generateImages({
    model: "gemini-2.0-flash-preview",
    prompt,
    config: {
      numberOfImages: 1,
      outputDimensions: dimensions,
    },
  });

  const imageData = response.images?.[0];
  if (!imageData?.image?.imageBytes) {
    throw new Error("No image data in response. Gemini may have hit safety filters.");
  }

  return Buffer.from(imageData.image.imageBytes, "base64");
}
