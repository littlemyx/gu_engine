import type { PipelineEvent } from './events';

/**
 * Куда пишется лента событий.
 *
 * Событий за прогон тысячи, и в localStorage им не место: он синхронный,
 * маленький и делится со всеми сторами проекта. IndexedDB асинхронна и
 * вмещает ленту целиком, но её нет ни в тестах, ни в первый момент загрузки —
 * поэтому сток абстрагирован, а память служит и запасным вариантом, и
 * реализацией для тестов.
 */
export interface EventSink {
  append: (event: PipelineEvent) => void;
  /** Последние n событий, старые первыми. */
  tail: (n: number) => Promise<PipelineEvent[]>;
  clear: () => Promise<void>;
}

export function memorySink(capacity = 5000): EventSink {
  let events: PipelineEvent[] = [];

  return {
    append: event => {
      events.push(event);
      if (events.length > capacity) events = events.slice(-capacity);
    },
    tail: async n => events.slice(-n),
    clear: async () => {
      events = [];
    },
  };
}

const DB_NAME = 'gu-events';
const STORE = 'events';

function openDb(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Журнал в IndexedDB. Запись не ждут: событие уже лежит в зеркале в памяти, и
 * тормозить прогон ради журнала незачем. Сбой записи гасится — потерять строку
 * ленты не страшно, уронить прогон из-за неё страшно.
 */
export function idbSink(projectId: string): EventSink {
  const dbName = `${DB_NAME}:${projectId}`;
  let db: Promise<IDBDatabase> | null = null;

  const connect = () => {
    db ??= openDb(dbName);
    return db;
  };

  return {
    append: event => {
      void connect()
        .then(handle => handle.transaction(STORE, 'readwrite').objectStore(STORE).put(event))
        .catch(() => undefined);
    },

    tail: async n => {
      try {
        const handle = await connect();
        const all = await new Promise<PipelineEvent[]>((resolve, reject) => {
          const request = handle.transaction(STORE, 'readonly').objectStore(STORE).getAll();
          request.onsuccess = () => resolve(request.result as PipelineEvent[]);
          request.onerror = () => reject(request.error);
        });
        return all.sort((a, b) => a.ts - b.ts).slice(-n);
      } catch {
        return [];
      }
    },

    clear: async () => {
      try {
        const handle = await connect();
        handle.transaction(STORE, 'readwrite').objectStore(STORE).clear();
      } catch {
        // Нечего чистить — значит, и жаловаться не на что.
      }
    },
  };
}

/** В браузере — IndexedDB, где её нет (тесты, приватный режим) — память. */
export function defaultSink(projectId: string): EventSink {
  return typeof indexedDB === 'undefined' ? memorySink() : idbSink(projectId);
}
