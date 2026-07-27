/**
 * Область видимости проекта во вкладке. Одна вкладка = один JS-контекст =
 * один проект: модульные синглтоны сторов уже пер-вкладочные, остаётся дать
 * им разные ключи в localStorage.
 *
 * Идентификатор читается ОДИН РАЗ при загрузке документа из ?project=<id> и
 * дальше неизменен. Смена проекта внутри вкладки — всегда жёсткая навигация
 * (location.assign), а не переподключение persist на лету: живой прогон держит
 * Web Lock, промисы генерации и подписку на storage-события, и подмена ключей
 * под ними оставила бы половину записей в старом проекте.
 *
 * ВАЖНО: модуль обязан оставаться без зависимостей. Он вычисляется при импорте
 * раньше сторов — любой импорт стора отсюда развернёт цикл инициализации.
 */

export const PROJECT_PARAM = 'project';

/** Куда пишет вкладка, не привязанная к проекту: сторы там ничего не создают. */
export const UNBOUND_NAMESPACE = '__unbound__';

export const projectId: string | null =
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(PROJECT_PARAM) || null;

/** Вкладка привязана к проекту? Если нет — вместо студии показывается пикер. */
export const isBound = projectId != null;

/** 'gu-narrative-state' → 'gu-narrative-state:<id>'. */
export const storageKey = (base: string): string => `${base}:${projectId ?? UNBOUND_NAMESPACE}`;

/** Адрес студии для проекта: единственный способ строить ссылки на неё. */
export const studioUrl = (id: string): string => `/studio?${PROJECT_PARAM}=${encodeURIComponent(id)}`;

export const newProjectId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : // http:// на LAN-адресе — не secure context, randomUUID там нет.
      `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Ключи эпохи «один проект на браузер». Миграции нет намеренно: угадать, к
 * какому из нескольких проектов относилось глобальное состояние, невозможно,
 * а держать их занятыми — только зря тратить квоту localStorage.
 */
const LEGACY_FLAT_KEYS = [
  'gu-narrative-state',
  'gu-narrative-brief',
  'gu-run-log',
  'gu-run-cost',
  'gu-draft-archive',
] as const;

export function cleanupLegacyKeys(): void {
  if (typeof localStorage === 'undefined') return;
  for (const key of LEGACY_FLAT_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Приватный режим/переполненное хранилище: чистка не критична.
    }
  }
}
