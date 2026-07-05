import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger.js';

// DigitalOcean Spaces (S3-совместимый). Бакет остаётся приватным:
// Suno получает presigned GET URL с ограниченным TTL.
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;

const PRESIGN_TTL_SECONDS = 3600;

let client: S3Client | null = null;

export function isS3Configured(): boolean {
  return Boolean(S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);
}

function getClient(): S3Client {
  if (!isS3Configured()) {
    throw new Error(
      'S3 не сконфигурирован: заполните S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY в audio_gen/.env',
    );
  }
  if (!client) {
    client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID!,
        secretAccessKey: S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

/**
 * Заливает аудио-буфер во временную зону бакета и возвращает presigned GET URL,
 * по которому серверы Suno смогут скачать файл (upload-cover требует публично
 * достижимый uploadUrl).
 */
export async function uploadForSunoHandoff(buffer: Buffer, name: string): Promise<string> {
  const s3 = getClient();
  const key = `suno-handoff/${Date.now()}_${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'audio/mpeg',
    }),
  );
  logger.log(`[s3] uploaded handoff object ${key}`);

  return getSignedUrl(s3, new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), {
    expiresIn: PRESIGN_TTL_SECONDS,
  });
}
