/**
 * Реестр проектов — единственный глобальный (не скоупленный) индекс историй,
 * лежащих в localStorage этого браузера. Нужен ровно для двух вещей: показать
 * пикер во вкладке без ?project= и дать способ удалить проект целиком.
 *
 * Без реестра пер-проектные ключи копились бы вечно: узнать, какие id вообще
 * существуют, можно было бы только перебором localStorage, а имя проекта —
 * ниоткуда. Поэтому запись сюда — обязанность каждой точки, где проект
 * создаётся, открывается или сохраняется.
 */

const REGISTRY_KEY = 'gu-projects';

/**
 * Базовые имена всех пер-проектных ключей. Список — точка истины для удаления:
 * новый скоупленный стор обязан появиться здесь, иначе удаление проекта
 * оставит его данные висеть в хранилище навсегда.
 */
export const PROJECT_KEY_BASES = [
  'gu-narrative-state',
  'gu-narrative-brief',
  'gu-run-log',
  'gu-run-cost',
  'gu-draft-archive',
  'gu-studio-project',
] as const;

export type ProjectMeta = {
  id: string;
  name: string;
  updatedAt: number;
};

export const UNNAMED_PROJECT = 'без названия';

const isMeta = (v: unknown): v is ProjectMeta =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as ProjectMeta).id === 'string' &&
  typeof (v as ProjectMeta).name === 'string' &&
  typeof (v as ProjectMeta).updatedAt === 'number';

function readRegistry(): ProjectMeta[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(REGISTRY_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isMeta) : [];
  } catch {
    // Битый реестр не должен запирать редактор: считаем, что проектов нет.
    return [];
  }
}

function writeRegistry(list: ProjectMeta[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(list));
  } catch {
    // Переполненная квота: реестр — метаданные, терять из-за них работу нельзя.
  }
}

/** Проекты от свежих к старым — порядок пикера. */
export function listProjects(): ProjectMeta[] {
  return readRegistry().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id: string): ProjectMeta | null {
  return readRegistry().find(p => p.id === id) ?? null;
}

/**
 * Отметить проект живым: обновляет updatedAt и, если имя передано, название.
 * Имя необязательно — на буте вкладки заголовок истории может быть ещё пустым,
 * и затирать им уже известное название проекта не надо.
 */
export function upsertProject(id: string, name?: string): void {
  const list = readRegistry();
  const existing = list.find(p => p.id === id);
  const updatedAt = Date.now();
  if (existing) {
    if (name) existing.name = name;
    existing.updatedAt = updatedAt;
    writeRegistry(list);
    return;
  }
  writeRegistry([...list, { id, name: name || UNNAMED_PROJECT, updatedAt }]);
}

/** Удалить проект: запись реестра и все его ключи в localStorage. */
export function deleteProject(id: string): void {
  writeRegistry(readRegistry().filter(p => p.id !== id));
  if (typeof localStorage === 'undefined') return;
  for (const base of PROJECT_KEY_BASES) {
    try {
      localStorage.removeItem(`${base}:${id}`);
    } catch {
      // Одно неудалённое поле не повод бросать остальные.
    }
  }
}
