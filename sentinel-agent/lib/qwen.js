import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.QWEN_API_KEY,
  baseURL: process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
});

/**
 * Query Qwen for text-only analysis (threat reasoning).
 * Uses qwen-plus for deep reasoning tasks.
 */
export async function queryQwenText(systemPrompt, userPrompt) {
  const response = await client.chat.completions.create({
    model: 'qwen-plus',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
  });

  const raw = response.choices[0].message.content;
  try {
    const jsonStr = raw.match(/```(?:json)?\n([\s\S]*?)```/)?.[1] || raw;
    return JSON.parse(jsonStr.trim());
  } catch {
    console.error('Failed to parse Qwen JSON response:', raw);
    return { threatType: 'unknown', indicators: [], confidence: 0, reasoning: raw };
  }
}

/**
 * Query Qwen for multimodal analysis (screenshots + text).
 * Uses qwen-vl-plus for vision tasks.
 */
export async function queryQwenVision(systemPrompt, userPrompt, imageBase64Array = []) {
  const userContent = [
    { type: 'text', text: userPrompt },
    ...imageBase64Array.map((b64) => ({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${b64}` },
    })),
  ];

  const response = await client.chat.completions.create({
    model: 'qwen-vl-plus',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.1,
  });

  const raw = response.choices[0].message.content;
  try {
    return JSON.parse(raw);
  } catch {
    return { analysis: raw };
  }
}

/**
 * Quick classification using qwen-turbo (cheap, fast).
 * Good for simple yes/no or categorization tasks.
 */
export async function queryQwenFlash(systemPrompt, userPrompt) {
  const response = await client.chat.completions.create({
    model: 'qwen-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  const raw = response.choices[0].message.content;
  try {
    return JSON.parse(raw);
  } catch {
    return { result: raw };
  }
}
