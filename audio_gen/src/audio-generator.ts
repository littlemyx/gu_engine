import * as fs from 'node:fs';
import * as path from 'node:path';
import { uploadFileToStorage } from 'gu-engine-gen-shared';
import type { BatchState, GenerateMelodyRequest, GenerateVariationRequest, GenerateSfxRequest, ItemState } from './types.js';
import { generateTrack, generateCover, generateSound, pollUntilComplete, downloadAudio } from './suno-client.js';
import { uploadForSunoHandoff } from './s3-upload.js';
import { logger } from './logger.js';

const RESULT_DIR = path.resolve('result_audio');
fs.mkdirSync(RESULT_DIR, { recursive: true });

const AUDIO_SERVER_BASE = process.env.AUDIO_SERVER_URL || 'http://localhost:3008';

function safeName(part: string): string {
  return path.basename(part).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function uploadToAudioServer(filePath: string, originalName: string): Promise<string> {
  return uploadFileToStorage({
    baseUrl: AUDIO_SERVER_BASE,
    route: '/audio',
    fieldName: 'audio',
    filePath,
    originalName,
    mimeType: 'audio/mpeg',
  });
}

/** Скачать трек Suno → залить в audio_server → удалить локальную копию. */
async function deliverTrack(audioUrl: string, localName: string, uploadName: string): Promise<string> {
  const localPath = path.join(RESULT_DIR, safeName(localName));
  await downloadAudio(audioUrl, localPath);
  try {
    return await uploadToAudioServer(localPath, uploadName);
  } finally {
    fs.promises.unlink(localPath).catch(() => {});
  }
}

/**
 * Suno может вернуть меньше треков, чем ожидалось (или пустой payload при
 * SUCCESS). Item-ы, оставшиеся в processing, обязаны стать failed — иначе
 * /status никогда не отдаст done=true и клиент поллит вечно.
 */
function failLeftoverItems(items: ItemState[], tracksCount: number): void {
  for (const item of items) {
    if (item.status === 'processing') {
      item.status = 'failed';
      item.error = `Suno вернул ${tracksCount} треков вместо ${items.length}`;
    }
  }
}

export async function processMelodyBatch(
  batch: BatchState,
  request: GenerateMelodyRequest,
): Promise<void> {
  const items = Object.values(batch.items);
  try {
    for (const item of items) {
      item.status = 'processing';
    }

    logger.log(`[melody] generating track with style="${request.style}"`);
    const taskId = await generateTrack(request.style, request.instrumental);
    batch.taskId = taskId;
    logger.log(`[melody] taskId=${taskId}`);

    const tracks = await pollUntilComplete(taskId);
    logger.log(`[melody] got ${tracks.length} tracks`);

    for (let i = 0; i < items.length && i < tracks.length; i++) {
      try {
        const fileName = await deliverTrack(
          tracks[i].audioUrl,
          `melody_${Date.now()}_${i}.mp3`,
          `melody_${i}.mp3`,
        );
        items[i].fileName = fileName;
        items[i].status = 'completed';
        logger.log(`[melody] variant ${i} uploaded as ${fileName}`);
      } catch (err) {
        items[i].status = 'failed';
        items[i].error = err instanceof Error ? err.message : String(err);
        logger.error(`[melody] variant ${i} failed: ${items[i].error}`);
      }
    }
    failLeftoverItems(items, tracks.length);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[melody] batch failed: ${msg}${batch.taskId ? ` (taskId=${batch.taskId})` : ''}`);
    for (const item of items) {
      if (item.status !== 'completed') {
        item.status = 'failed';
        item.error = msg;
      }
    }
  }
}

export async function processVariationBatch(
  batch: BatchState,
  request: GenerateVariationRequest,
): Promise<void> {
  const items = Object.values(batch.items);
  try {
    for (const item of items) {
      item.status = 'processing';
    }

    // Suno скачивает исходник со своих серверов — localhost недостижим.
    // Гоним базовый трек через S3 (DO Spaces) и отдаём presigned URL.
    const baseName = safeName(request.baseAudioName);
    const baseRes = await fetch(`${AUDIO_SERVER_BASE}/audio/${encodeURIComponent(request.baseAudioName)}`);
    if (!baseRes.ok) {
      throw new Error(`Базовый трек ${request.baseAudioName} недоступен на audio_server: ${baseRes.status}`);
    }
    const baseBuffer = Buffer.from(await baseRes.arrayBuffer());
    const publicUrl = await uploadForSunoHandoff(baseBuffer, baseName);
    logger.log(`[variation] restyling ${request.baseAudioName} with style="${request.toneStyle}" (${request.variationType})`);

    const taskId = await generateCover(publicUrl, request.toneStyle);
    batch.taskId = taskId;
    logger.log(`[variation] taskId=${taskId}`);

    const tracks = await pollUntilComplete(taskId);
    logger.log(`[variation] got ${tracks.length} tracks`);

    for (let i = 0; i < items.length && i < tracks.length; i++) {
      try {
        const fileName = await deliverTrack(
          tracks[i].audioUrl,
          `${request.variationType}_${Date.now()}_${i}.mp3`,
          `${request.variationType}_${i}.mp3`,
        );
        items[i].fileName = fileName;
        items[i].status = 'completed';
        logger.log(`[variation] variant ${i} uploaded as ${fileName}`);
      } catch (err) {
        items[i].status = 'failed';
        items[i].error = err instanceof Error ? err.message : String(err);
        logger.error(`[variation] variant ${i} failed: ${items[i].error}`);
      }
    }
    failLeftoverItems(items, tracks.length);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[variation] batch failed: ${msg}${batch.taskId ? ` (taskId=${batch.taskId})` : ''}`);
    for (const item of items) {
      if (item.status !== 'completed') {
        item.status = 'failed';
        item.error = msg;
      }
    }
  }
}

export async function processSfxBatch(
  batch: BatchState,
  request: GenerateSfxRequest,
): Promise<void> {
  for (const sfxItem of request.items) {
    const item = batch.items[sfxItem.id];
    if (!item) continue;

    item.status = 'processing';
    try {
      logger.log(`[sfx] generating "${sfxItem.id}" prompt="${sfxItem.prompt}"`);
      const taskId = await generateSound(sfxItem.prompt, sfxItem.soundLoop ?? false);
      batch.taskId = taskId;
      logger.log(`[sfx] ${sfxItem.id} taskId=${taskId}`);

      const tracks = await pollUntilComplete(taskId);
      if (tracks.length === 0) throw new Error('No tracks returned');

      const fileName = await deliverTrack(
        tracks[0].audioUrl,
        `sfx_${sfxItem.id}_${Date.now()}.mp3`,
        `sfx_${safeName(sfxItem.id)}.mp3`,
      );
      item.fileName = fileName;
      item.status = 'completed';
      logger.log(`[sfx] ${sfxItem.id} uploaded as ${fileName}`);
    } catch (err) {
      item.status = 'failed';
      item.error = err instanceof Error ? err.message : String(err);
      logger.error(`[sfx] ${sfxItem.id} failed: ${item.error}`);
    }
  }
}
