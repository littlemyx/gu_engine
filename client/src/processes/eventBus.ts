import { create } from 'zustand';

import { projectId } from '@/project/projectScope';

import { stampEvent } from './events';
import { defaultSink } from './eventSink';
import { IDLE, applyCommand, applyEvent } from './runMachine';

import type { NewEvent, PipelineEvent } from './events';
import type { EventSink } from './eventSink';
import type { RunCommand, RunState } from './runMachine';

/**
 * Шина событий конвейера: зеркало в памяти для интерфейса плюс журнал на диске.
 *
 * Зеркало короткое — «Лента» показывает хвост, а не всю историю прогона.
 * Полная лента живёт в журнале и поднимается оттуда, когда её открывают.
 * Машина прогона двигается прямо здесь: состояние прогона — производная от
 * потока событий, и держать его отдельным стором значило бы завести второй
 * источник правды.
 */

/** Сколько событий держим перед глазами. */
export const MIRROR_CAPACITY = 500;

type EventBusState = {
  recent: PipelineEvent[];
  run: RunState;

  emit: (event: NewEvent) => PipelineEvent;
  command: (command: RunCommand) => void;
  /** Поднять хвост журнала в зеркало — при открытии «Ленты». */
  hydrate: (n?: number) => Promise<void>;
  clear: () => Promise<void>;
};

let sink: EventSink = defaultSink(projectId ?? 'unbound');

/** Подменить журнал (тесты, миграция хранилища). */
export function setEventSink(next: EventSink): void {
  sink = next;
}

export const useEventBus = create<EventBusState>()((set, get) => ({
  recent: [],
  run: IDLE,

  emit: event => {
    const stamped = stampEvent(event);
    sink.append(stamped);

    set(s => {
      const recent = [...s.recent, stamped];
      return {
        recent: recent.length > MIRROR_CAPACITY ? recent.slice(-MIRROR_CAPACITY) : recent,
        run: applyEvent(s.run, stamped),
      };
    });

    return stamped;
  },

  command: command => set(s => ({ run: applyCommand(s.run, command) })),

  hydrate: async (n = MIRROR_CAPACITY) => {
    const events = await sink.tail(n);
    // Живые события приоритетнее поднятых: пока журнал читался, прогон мог
    // сделать ещё несколько шагов, и затирать их архивом нельзя.
    const known = new Set(get().recent.map(e => e.id));
    const restored = events.filter(e => !known.has(e.id));
    set(s => ({ recent: [...restored, ...s.recent].slice(-MIRROR_CAPACITY) }));
  },

  clear: async () => {
    await sink.clear();
    set({ recent: [] });
  },
}));

/** Издать событие вне React — из calendarRunner и прочей не-компонентной кухни. */
export function emitPipelineEvent(event: NewEvent): PipelineEvent {
  return useEventBus.getState().emit(event);
}

export function runCommand(command: RunCommand): void {
  useEventBus.getState().command(command);
}
