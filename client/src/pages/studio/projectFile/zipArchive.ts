import { unzip, zip } from 'fflate';

import type { Unzipped, Zippable } from 'fflate';

/**
 * fflate обёрнут промисами в одном месте: колбэчный API дальше по коду не
 * нужен. Асинхронные версии выбраны намеренно — они уходят в воркер и не
 * держат интерфейс во время упаковки десятков мегабайт аудио.
 */

export function zipAsync(entries: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(entries, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

export function unzipAsync(data: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(data, (err, files) => (err ? reject(err) : resolve(files)));
  });
}
