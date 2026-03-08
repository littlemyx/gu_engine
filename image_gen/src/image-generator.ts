import { GoogleGenAI } from '@google/genai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GenerateItem, BatchState } from './types.js';

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error('GOOGLE_API_KEY environment variable is required');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const RESULT_DIR = path.resolve('result_images');
fs.mkdirSync(RESULT_DIR, { recursive: true });

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`);
  const contentType = res.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString('base64'), mimeType: contentType };
}

function buildPrompt(item: GenerateItem, masterPrompt?: string, negativePrompt?: string): string {
  const parts: string[] = [];
  if (masterPrompt) parts.push(masterPrompt);
  parts.push(item.description);
  if (negativePrompt) parts.push(`Avoid the following: ${negativePrompt}`);
  return parts.join('\n\n');
}

export async function generateImage(
  item: GenerateItem,
  masterPrompt?: string,
  negativePrompt?: string,
): Promise<string> {
  const promptText = buildPrompt(item, masterPrompt, negativePrompt);

  const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  contentParts.push({ text: promptText });

  if (item.referenceImages?.length) {
    for (const url of item.referenceImages) {
      const img = await fetchImageAsBase64(url);
      contentParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: contentParts,
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error('No response parts from API');

  for (const part of parts) {
    if ((part as any).inlineData) {
      const imageData = (part as any).inlineData.data;
      const filePath = path.join(RESULT_DIR, `${item.id}.png`);
      fs.writeFileSync(filePath, Buffer.from(imageData, 'base64'));
      return filePath;
    }
  }

  throw new Error('No image data in API response');
}

export async function processBatch(
  batch: BatchState,
  items: GenerateItem[],
  masterPrompt?: string,
  negativePrompt?: string,
) {
  for (const item of items) {
    batch.items[item.id].status = 'processing';
    try {
      const filePath = await generateImage(item, masterPrompt, negativePrompt);
      batch.items[item.id].status = 'completed';
      batch.items[item.id].filePath = filePath;
    } catch (err: any) {
      batch.items[item.id].status = 'failed';
      batch.items[item.id].error = err.message ?? String(err);
    }
  }
}
