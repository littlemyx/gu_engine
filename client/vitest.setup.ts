/**
 * Тестовое окружение — node, а браузерного localStorage там нет. Раньше это
 * сходило с рук: сторы просто не персистились. С пер-проектными ключами
 * персист стал предметом проверки, и хранилище нужно настоящее.
 *
 * Полифилл ставится здесь, а не в самих тестах, потому что zustand
 * запоминает storage по умолчанию при первом импорте zustand/middleware —
 * то есть раньше, чем выполнится тело любого теста. setupFiles выполняются
 * до импорта тестового файла, и только так подмена успевает.
 */

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), writable: false });
}

/**
 * Web Locks в тестах — вредны, и убрать их надо здесь же, до первого импорта.
 *
 * Замок календарного прогона существует ради одной вещи: чтобы за один прогон
 * платила одна вкладка браузера. Node ≥22 даёт `navigator.locks` по-настоящему,
 * а vitest крутит файлы тестов в воркерах ОДНОГО процесса — значит два файла,
 * трогающих прогон, делят замок как две вкладки. Второй получает «занято»,
 * молча становится наблюдателем и не делает ничего: тест падает на пустом
 * состоянии, причём только в общем прогоне сьюта, а поодиночке — зелёный.
 *
 * Каждый файл тестов — это отдельная «вкладка», и мешать им нельзя. Раннер без
 * Web Locks деградирует к внутрифайловому module-guard, а его хватает.
 */
if (typeof globalThis.navigator !== 'undefined' && 'locks' in globalThis.navigator) {
  Object.defineProperty(globalThis.navigator, 'locks', { value: undefined, configurable: true });
}
