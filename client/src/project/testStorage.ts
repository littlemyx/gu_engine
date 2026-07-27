import { vi } from 'vitest';

/**
 * Хранилище и адрес вкладки для тестов.
 *
 * localStorage НЕ подменяется: zustand запоминает storage по умолчанию при
 * первом импорте своего middleware, поэтому подмена из теста до сторов уже не
 * доезжает. Хранилище ставит vitest.setup.ts, а тесты его только чистят.
 *
 * Модуль лежит в src (а не рядом с одним тестом), потому что им пользуются
 * тесты из разных папок; в бандл он не попадает — импортируется только из
 * *.test.ts.
 */

/** Чистое хранилище перед тестом: ключи проектов копятся между случаями. */
export function resetLocalStorage(): void {
  localStorage.clear();
}

export function storageKeys(): string[] {
  return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) as string);
}

/**
 * Вкладка, открытая на ?project=<id>. Без id — непривязанная вкладка.
 *
 * localStorage кладётся на подменённый window намеренно: persist в zustand
 * читает именно `window.localStorage`, и окно без него отключило бы
 * персист — ровно то, что эти тесты и проверяют.
 */
export function stubTabUrl(id: string | null): void {
  vi.stubGlobal('window', {
    location: { search: id == null ? '' : `?project=${encodeURIComponent(id)}` },
    localStorage,
  });
}
