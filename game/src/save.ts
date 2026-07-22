import { DirectorSnapshot, hashSeed } from "gu-engine-story-core";

/**
 * Сейв прохождения.
 *
 * В графовой модели сохранять было нечего и негде: позиция игрока — это узел
 * графа плюс размазанные по нему переменные. В storylet-модели состояние и так
 * данные (слот, фаза, локация, отношения, флаги, лог сыгранного, поток ГПСЧ),
 * поэтому сейв — просто JSON, а восстановление точно воспроизводит и будущие
 * розыгрыши селектора.
 *
 * Точка сохранения — хаб: сцены не рвутся посередине, они короткие.
 */

const PREFIX = "gu.save.";

const keyFor = (title: string): string => `${PREFIX}${hashSeed(title).toString(36)}`;

export function saveGame(title: string, snap: DirectorSnapshot): void {
  try {
    localStorage.setItem(keyFor(title), JSON.stringify({ title, savedAt: Date.now(), snap }));
  } catch {
    // Приватный режим/переполнение — сейв не критичен, игра продолжается.
  }
}

export function loadGame(title: string): DirectorSnapshot | null {
  try {
    const raw = localStorage.getItem(keyFor(title));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { snap?: DirectorSnapshot };
    return parsed.snap ?? null;
  } catch {
    return null;
  }
}

export function clearGame(title: string): void {
  try {
    localStorage.removeItem(keyFor(title));
  } catch {
    /* см. saveGame */
  }
}

export function hasSave(title: string): boolean {
  return loadGame(title) !== null;
}
