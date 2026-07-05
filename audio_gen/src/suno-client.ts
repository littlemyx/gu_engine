import { createRateLimiter } from 'gu-engine-gen-shared';
import { logger } from './logger.js';

const SUNO_BASE = 'https://api.sunoapi.org';
const SUNO_API_KEY = process.env.SUNO_API_KEY;

if (!SUNO_API_KEY) {
  logger.error('SUNO_API_KEY environment variable is required');
  process.exit(1);
}

const HEADERS = {
  'Authorization': `Bearer ${SUNO_API_KEY}`,
  'Content-Type': 'application/json',
};

// Rate limiter: 20 requests per 10 seconds
const waitForRateLimit = createRateLimiter({
  maxRequests: 20,
  windowMs: 10_000,
  onWait: waitMs => logger.log(`[rate-limit] waiting ${waitMs}ms`),
});

type SunoTaskStatus = 'PENDING' | 'TEXT_SUCCESS' | 'FIRST_SUCCESS' | 'SUCCESS'
  | 'CREATE_TASK_FAILED' | 'GENERATE_AUDIO_FAILED' | 'CALLBACK_EXCEPTION' | 'SENSITIVE_WORD_ERROR';

interface SunoTrack {
  audioUrl: string;
  streamAudioUrl: string;
  imageUrl: string;
  duration: number;
  title: string;
}

interface SunoRecordInfo {
  code: number;
  data: {
    taskId: string;
    status: SunoTaskStatus;
    response?: {
      sunoData?: SunoTrack[];
    };
  };
}

export async function generateTrack(
  style: string,
  instrumental: boolean,
): Promise<string> {
  await waitForRateLimit();

  const body = {
    customMode: true,
    instrumental,
    model: 'V5',
    style,
    title: `gu_${Date.now()}`,
    prompt: instrumental ? '' : style,
  };

  const res = await fetch(`${SUNO_BASE}/api/v1/generate`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Suno generate failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { data: { taskId: string } };
  return data.data.taskId;
}

export async function generateCover(
  audioFileUrl: string,
  style: string,
): Promise<string> {
  await waitForRateLimit();

  // Suno upload-cover требует параметр `uploadUrl` — публично достижимый URL
  // исходного трека (серверы Suno скачивают его сами).
  const body = {
    uploadUrl: audioFileUrl,
    model: 'V5',
    customMode: true,
    instrumental: true,
    style,
    title: `gu_var_${Date.now()}`,
  };

  const res = await fetch(`${SUNO_BASE}/api/v1/generate/upload-cover`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Suno upload-cover failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { data: { taskId: string } };
  return data.data.taskId;
}

export async function generateSound(
  prompt: string,
  soundLoop: boolean,
): Promise<string> {
  await waitForRateLimit();

  const body = {
    prompt,
    model: 'V5',
    soundLoop,
  };

  const res = await fetch(`${SUNO_BASE}/api/v1/generate/sounds`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Suno generate/sounds failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { data: { taskId: string } };
  return data.data.taskId;
}

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 300_000;
const MAX_CONSECUTIVE_POLL_FAILURES = 5;

export async function pollUntilComplete(taskId: string): Promise<SunoTrack[]> {
  const start = Date.now();
  let consecutiveFailures = 0;

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await waitForRateLimit();

    let info: SunoRecordInfo;
    try {
      const res = await fetch(
        `${SUNO_BASE}/api/v1/generate/record-info?taskId=${taskId}`,
        { headers: HEADERS },
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      info = (await res.json()) as SunoRecordInfo;
      consecutiveFailures = 0;
    } catch (err) {
      // Транзиентный сбой (сеть, 5xx) не должен убивать оплаченный батч —
      // задача на стороне Suno продолжает выполняться.
      consecutiveFailures++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[poll] status check failed for ${taskId} (${consecutiveFailures}/${MAX_CONSECUTIVE_POLL_FAILURES}): ${msg}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        throw new Error(`Suno poll failed ${MAX_CONSECUTIVE_POLL_FAILURES} times in a row for task ${taskId}: ${msg}`);
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    if (info.code !== 200 || !info.data) {
      throw new Error(`Suno record-info error for task ${taskId}: code=${info.code}`);
    }

    const status = info.data.status;

    if (status === 'SUCCESS') {
      return info.data.response?.sunoData ?? [];
    }

    if (
      status === 'CREATE_TASK_FAILED' ||
      status === 'GENERATE_AUDIO_FAILED' ||
      status === 'SENSITIVE_WORD_ERROR' ||
      status === 'CALLBACK_EXCEPTION'
    ) {
      throw new Error(`Suno task ${taskId} failed with status: ${status}`);
    }

    logger.log(`[poll] task=${taskId} status=${status}`);
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Suno task ${taskId} timed out after ${POLL_TIMEOUT_MS}ms`);
}

export async function downloadAudio(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download audio: ${url} (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const { writeFile } = await import('node:fs/promises');
  await writeFile(destPath, buffer);
}
