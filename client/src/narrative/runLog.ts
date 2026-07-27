import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { storageKey } from '@/project/projectScope';

export type RunLogTone = 'info' | 'ok' | 'error' | 'run' | 'pending';

export type RunLogLine = {
  /** Время события; форматируется при рендере. */
  t: number;
  tone: RunLogTone;
  text: string;
};

/** Сколько строк держим в памяти и сколько переживает перезагрузку. */
export const RUN_LOG_CAPACITY = 300;
const PERSIST_CAPACITY = 100;

type RunLogState = {
  lines: RunLogLine[];
  append: (tone: RunLogTone, text: string) => void;
  clear: () => void;
};

/**
 * Кольцевой буфер «Консоли генерации». Живёт рядом с прогоном, а не в React:
 * писать в него можно из calendarRunner, который работает вне компонентов.
 */
export const useRunLog = create<RunLogState>()(
  persist(
    set => ({
      lines: [],
      append: (tone, text) =>
        set(s => {
          const lines = [...s.lines, { t: Date.now(), tone, text }];
          return { lines: lines.length > RUN_LOG_CAPACITY ? lines.slice(-RUN_LOG_CAPACITY) : lines };
        }),
      clear: () => set({ lines: [] }),
    }),
    {
      name: storageKey('gu-run-log'),
      partialize: s => ({ lines: s.lines.slice(-PERSIST_CAPACITY) }),
    },
  ),
);

/** Дописать строку в консоль прогона. */
export function appendRunLog(tone: RunLogTone, text: string): void {
  useRunLog.getState().append(tone, text);
}

export function clearRunLog(): void {
  useRunLog.getState().clear();
}

/** «12:41:19» — как в макете консоли. */
export function formatLogTime(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
