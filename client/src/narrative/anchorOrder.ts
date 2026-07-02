import type { StoryAnchor, StoryOutlinePlan } from './types';

/**
 * Топологический порядок якорей story-outline (алгоритм Кана).
 *
 * Тай-брейк — исходный индекс в outline.anchors, чтобы порядок был
 * детерминированным и близким к авторскому. Если в рёбрах есть цикл
 * (валидатор outline это ловит отдельно), функция деградирует к исходному
 * порядку anchors[] — потребители не должны падать на битых данных.
 */
export function topoOrderAnchors(outline: StoryOutlinePlan): StoryAnchor[] {
  const anchors = outline.anchors;
  const indexOf = new Map(anchors.map((a, i) => [a.id, i]));
  const incoming = new Map<string, number>(anchors.map(a => [a.id, 0]));
  const outgoing = new Map<string, string[]>(anchors.map(a => [a.id, []]));

  for (const e of outline.anchorEdges) {
    if (!indexOf.has(e.from) || !indexOf.has(e.to)) continue;
    incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
    outgoing.get(e.from)!.push(e.to);
  }

  const ready = anchors.filter(a => (incoming.get(a.id) ?? 0) === 0).map(a => a.id);
  const result: StoryAnchor[] = [];
  const byId = new Map(anchors.map(a => [a.id, a]));

  while (ready.length > 0) {
    ready.sort((a, b) => indexOf.get(a)! - indexOf.get(b)!);
    const id = ready.shift()!;
    result.push(byId.get(id)!);
    for (const next of outgoing.get(id) ?? []) {
      const left = (incoming.get(next) ?? 0) - 1;
      incoming.set(next, left);
      if (left === 0) ready.push(next);
    }
  }

  // Цикл: часть якорей не вышла в result — деградация к авторскому порядку.
  if (result.length !== anchors.length) return [...anchors];
  return result;
}

/** id якорей, в которые ведут рёбра из anchorId. */
export function outgoingOf(outline: StoryOutlinePlan, anchorId: string): string[] {
  return outline.anchorEdges.filter(e => e.from === anchorId).map(e => e.to);
}

/** id прямых предков anchorId. */
export function directPredecessors(outline: StoryOutlinePlan, anchorId: string): string[] {
  return outline.anchorEdges.filter(e => e.to === anchorId).map(e => e.from);
}

/**
 * Все предки anchorId в топологическом порядке (от старта к якорю,
 * сам якорь не включён).
 */
export function ancestorChain(outline: StoryOutlinePlan, anchorId: string): StoryAnchor[] {
  const ancestors = new Set<string>();
  const stack = [...directPredecessors(outline, anchorId)];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (ancestors.has(cur)) continue;
    ancestors.add(cur);
    stack.push(...directPredecessors(outline, cur));
  }
  return topoOrderAnchors(outline).filter(a => ancestors.has(a.id));
}
