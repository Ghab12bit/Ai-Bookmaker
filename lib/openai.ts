import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function callOpenAI(params: {
  model: "gpt-4o" | "gpt-4o-mini";
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: "json" | "text";
  maxTokens?: number;
}): Promise<string> {
  const response = await client.chat.completions.create({
    model: params.model,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userPrompt },
    ],
    response_format:
      params.responseFormat === "json"
        ? { type: "json_object" }
        : { type: "text" },
    max_tokens: params.maxTokens || 4000,
    temperature: params.responseFormat === "json" ? 0.7 : 0.85,
  });

  return response.choices[0].message.content || "";
}
