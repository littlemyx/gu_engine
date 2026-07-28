import { appendRunLog } from '@/narrative/runLog';

import { eventText, eventTone } from './events';
import { useEventBus } from './eventBus';

import type { PipelineEvent } from './events';

/**
 * Мост «событие → строка консоли».
 *
 * Переезд на типизированные события идёт постепенно: `calendarRunner` большой,
 * и переписывать все его точки логирования разом — верный способ уронить
 * прогон. Мост позволяет менять их по одной: та, что уже издаёт событие,
 * попадает в консоль через него, та, что ещё зовёт appendRunLog напрямую, —
 * как раньше. Когда прямых вызовов не останется, консоль станет просто ещё
 * одним видом на ленту.
 */

/**
 * Что из зеркала ещё не проговорено в консоль. Считается по идентификатору, а
 * не по длине: зеркало кольцевое, и после переполнения длина перестаёт расти,
 * хотя события идут.
 */
export function eventsAfter(recent: PipelineEvent[], lastId: string | null): PipelineEvent[] {
  if (lastId === null) return recent;
  const index = recent.findIndex(e => e.id === lastId);
  // Хвост уже вытеснен из кольца — всё, что осталось, ещё не проговорено.
  return index === -1 ? recent : recent.slice(index + 1);
}

let unsubscribe: (() => void) | null = null;

export function bridgeEventsToConsole(): () => void {
  if (unsubscribe) return unsubscribe;

  let lastId: string | null = useEventBus.getState().recent.at(-1)?.id ?? null;

  const stop = useEventBus.subscribe(state => {
    const fresh = eventsAfter(state.recent, lastId);
    if (fresh.length === 0) return;

    for (const event of fresh) appendRunLog(eventTone(event.phase), eventText(event));
    lastId = fresh.at(-1)?.id ?? lastId;
  });

  unsubscribe = () => {
    stop();
    unsubscribe = null;
  };
  return unsubscribe;
}

export function stopConsoleBridge(): void {
  unsubscribe?.();
}
