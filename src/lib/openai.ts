import OpenAI from "openai";
import { env, requireOpenAIEnv } from "@/lib/env";

export function createOpenAIClient() {
  requireOpenAIEnv();
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];
  const client = createOpenAIClient();
  const response = await client.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}

export async function embedText(text: string) {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

export async function generateTextResponse(input: string, model = env.OPENAI_ANSWER_MODEL) {
  const client = createOpenAIClient();
  const response = await client.responses.create({
    model,
    input,
  });

  return (response as { output_text: string }).output_text;
}

export async function generateStructuredTextResponse(input: string, schema: Record<string, unknown>, model = env.OPENAI_ANSWER_MODEL) {
  const client = createOpenAIClient();
  const response = await client.responses.create({
    model,
    input,
    text: {
      format: {
        type: "json_schema",
        name: "clinical_rag_answer",
        strict: true,
        schema,
      },
    },
  } as Parameters<typeof client.responses.create>[0]);

  return (response as { output_text: string }).output_text;
}

export async function captionImageFromBase64(args: { base64: string; mimeType: string; nearbyText?: string }) {
  const client = createOpenAIClient();
  const response = await client.responses.create({
    model: env.OPENAI_VISION_MODEL,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Generate a concise, clinically useful caption for this extracted guideline image. " +
              "Mention visible table/figure purpose, key labels, and any medication/risk/monitoring details. " +
              "Do not infer patient-specific advice. Nearby text: " +
              (args.nearbyText ?? "not available"),
          },
          {
            type: "input_image",
            image_url: `data:${args.mimeType};base64,${args.base64}`,
            detail: "auto",
          },
        ],
      },
    ],
  });

  return response.output_text.trim();
}
