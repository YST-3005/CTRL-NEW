import { answerAboutProduct } from "@/lib/chat/grounded";
import type { ChatMessage, DietaryPreferences, ProductRecord } from "@/types";

export async function askLabel(params: {
  question: string;
  product: ProductRecord | null;
  compareWith?: ProductRecord | null;
  prefs?: DietaryPreferences;
}): Promise<ChatMessage> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return answerAboutProduct(params.question, params.product, {
      compareWith: params.compareWith,
      prefs: params.prefs,
    });
  }
  try {
    const grounded = answerAboutProduct(params.question, params.product, params);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "Answer only from the provided label JSON. If missing, say so. Never invent citations, ingredients, or diagnoses. Distinguish label facts vs general education.",
          },
          {
            role: "user",
            content: JSON.stringify({
              question: params.question,
              product: params.product,
              localDraft: grounded.content,
            }),
          },
        ],
      }),
    });
    if (!res.ok) return grounded;
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return grounded;
    return { ...grounded, content };
  } catch {
    return answerAboutProduct(params.question, params.product, params);
  }
}
