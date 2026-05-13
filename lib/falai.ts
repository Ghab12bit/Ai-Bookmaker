import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function generateCover(params: {
  title: string;
  setting: string;
  detectiveHobby: string;
}): Promise<string> {
  const prompt = `Cozy mystery novel book cover, "${params.title}".
Setting: ${params.setting}.
Visual elements suggesting: ${params.detectiveHobby}.
Style: warm, inviting, slightly mysterious. Color palette: muted teals, cream, soft amber.
Genre conventions: small town silhouette, hint of intrigue but not scary.
Professional book cover design, title space at top, author name space at bottom.
NO text in image — text will be added separately.
NO scary or violent imagery. NO gore. Cozy and warm.`;

  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt: prompt,
      image_size: "portrait_4_3",
      num_inference_steps: 4,
    },
  });

  const data = result.data as { images: { url: string }[] };
  return data.images[0].url;
}
