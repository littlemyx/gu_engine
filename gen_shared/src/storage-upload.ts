import * as fs from 'node:fs';

/**
 * Загрузка локального файла в storage-сервис (image_server/audio_server):
 * multipart POST на `${baseUrl}${route}`, возвращает имя файла на сервере.
 */
export async function uploadFileToStorage(opts: {
  baseUrl: string;
  route: string;
  fieldName: string;
  filePath: string;
  originalName: string;
  mimeType: string;
}): Promise<string> {
  const fileBuffer = fs.readFileSync(opts.filePath);
  const blob = new Blob([fileBuffer], { type: opts.mimeType });
  const formData = new FormData();
  formData.append(opts.fieldName, blob, opts.originalName);

  const res = await fetch(`${opts.baseUrl}${opts.route}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload to storage server: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { name: string };
  return data.name;
}
