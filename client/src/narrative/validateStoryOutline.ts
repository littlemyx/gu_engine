import type { Brief, SegmentIssue, StoryOutlinePlan } from './types';
import { directPredecessors, outgoingOf, topoOrderAnchors } from './anchorOrder';
import { computeOutlineTargets } from './buildOutlineRequest';

/**
 * Семантическая валидация story-outline: структура (setup/climax/resolution),
 * DAG-ность, связность, монотонность актов, покрытие LI и бюджеты
 * (количество якорей, распределение по актам, доля «чисто сюжетных»).
 *
 * Ошибки блокируют использование outline (retry-with-feedback), warnings
 * показываются автору.
 */
export function validateStoryOutline(outline: StoryOutlinePlan, brief: Brief): SegmentIssue[] {
  const issues: SegmentIssue[] = [];
  const anchors = outline.anchors;
  const ids = anchors.map(a => a.id);
  const idSet = new Set(ids);

  // Дубли id.
  if (idSet.size !== ids.length) {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        issues.push({ severity: 'error', scope: 'ids', message: `дублирующийся id якоря "${id}"` });
      }
      seen.add(id);
    }
  }

  // Рёбра ссылаются на существующие якоря.
  for (const e of outline.anchorEdges) {
    if (!idSet.has(e.from) || !idSet.has(e.to)) {
      issues.push({
        severity: 'error',
        scope: `edges/${e.from}->${e.to}`,
        message: 'ребро ссылается на несуществующий якорь',
      });
    }
  }

  // Структура: ровно один setup без входящих; >=1 climax; ровно один
  // resolution без исходящих (этого требует разводка концовок).
  const setups = anchors.filter(a => a.type === 'setup');
  if (setups.length !== 1) {
    issues.push({
      severity: 'error',
      scope: 'structure/setup',
      message: `якорей типа setup: ${setups.length}, должен быть ровно один`,
    });
  } else if (directPredecessors(outline, setups[0].id).length > 0) {
    issues.push({
      severity: 'error',
      scope: 'structure/setup',
      message: `setup-якорь "${setups[0].id}" имеет входящие рёбра — он должен быть стартом игры`,
    });
  }

  if (!anchors.some(a => a.type === 'climax')) {
    issues.push({
      severity: 'error',
      scope: 'structure/climax',
      message: 'нет ни одного climax-якоря',
    });
  }

  const resolutions = anchors.filter(a => a.type === 'resolution');
  if (resolutions.length !== 1) {
    issues.push({
      severity: 'error',
      scope: 'structure/resolution',
      message: `якорей типа resolution: ${resolutions.length}, должен быть ровно один`,
    });
  } else if (outgoingOf(outline, resolutions[0].id).length > 0) {
    issues.push({
      severity: 'error',
      scope: 'structure/resolution',
      message: `resolution-якорь "${resolutions[0].id}" имеет исходящие рёбра — он должен быть финалом`,
    });
  }

  // DAG-ность: Кан покрывает все якоря ⇔ циклов нет.
  const topo = topoOrderAnchors(outline);
  if (topo.length === anchors.length) {
    const topoIds = new Set<string>();
    let acyclic = true;
    const topoIndex = new Map(topo.map((a, i) => [a.id, i]));
    for (const e of outline.anchorEdges) {
      const fi = topoIndex.get(e.from);
      const ti = topoIndex.get(e.to);
      if (fi !== undefined && ti !== undefined && fi >= ti) acyclic = false;
      topoIds.add(e.from);
    }
    if (!acyclic) {
      issues.push({ severity: 'error', scope: 'dag', message: 'рёбра якорей образуют цикл' });
    }
  }

  // Связность: каждый якорь достижим от setup и достигает resolution.
  if (setups.length === 1 && resolutions.length === 1) {
    const forward = new Map<string, string[]>();
    const backward = new Map<string, string[]>();
    for (const e of outline.anchorEdges) {
      forward.set(e.from, [...(forward.get(e.from) ?? []), e.to]);
      backward.set(e.to, [...(backward.get(e.to) ?? []), e.from]);
    }
    const bfs = (start: string, adj: Map<string, string[]>): Set<string> => {
      const seen = new Set<string>();
      const stack = [start];
      while (stack.length) {
        const cur = stack.pop()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        stack.push(...(adj.get(cur) ?? []));
      }
      return seen;
    };
    const fromSetup = bfs(setups[0].id, forward);
    const toResolution = bfs(resolutions[0].id, backward);
    for (const a of anchors) {
      if (!fromSetup.has(a.id)) {
        issues.push({
          severity: 'error',
          scope: `connectivity/${a.id}`,
          message: 'якорь недостижим от setup',
        });
      } else if (!toResolution.has(a.id)) {
        issues.push({
          severity: 'error',
          scope: `connectivity/${a.id}`,
          message: 'из якоря недостижим resolution',
        });
      }
    }
  }

  // Акты: не убывают вдоль рёбер, покрывают 1..brief.scale.acts.
  const anchorById = new Map(anchors.map(a => [a.id, a]));
  for (const e of outline.anchorEdges) {
    const from = anchorById.get(e.from);
    const to = anchorById.get(e.to);
    if (from && to && from.act > to.act) {
      issues.push({
        severity: 'error',
        scope: `acts/monotone/${e.from}->${e.to}`,
        message: `ребро понижает акт: ${from.act} → ${to.act}`,
      });
    }
  }
  const actsPresent = new Set(anchors.map(a => a.act));
  for (let act = 1; act <= brief.scale.acts; act++) {
    if (!actsPresent.has(act)) {
      issues.push({
        severity: 'error',
        scope: 'acts/coverage',
        message: `в акте ${act} нет ни одного якоря (brief.scale.acts = ${brief.scale.acts})`,
      });
    }
  }
  for (const a of anchors) {
    if (a.act < 1 || a.act > brief.scale.acts) {
      issues.push({
        severity: 'error',
        scope: `acts/range/${a.id}`,
        message: `act ${a.act} вне диапазона 1..${brief.scale.acts}`,
      });
    }
  }

  // LI: каждый в >=2 якорях; неизвестные id — ошибка.
  const knownLIs = new Set(brief.loveInterests.map(li => li.id));
  const liAnchorCount = new Map<string, number>();
  for (const a of anchors) {
    for (const liId of a.availableLIs) {
      if (!knownLIs.has(liId)) {
        issues.push({
          severity: 'error',
          scope: `li/unknown/${liId}`,
          message: `availableLIs якоря "${a.id}" содержит неизвестный id "${liId}"`,
        });
      }
      liAnchorCount.set(liId, (liAnchorCount.get(liId) ?? 0) + 1);
    }
  }
  for (const li of brief.loveInterests) {
    if ((liAnchorCount.get(li.id) ?? 0) < 2) {
      issues.push({
        severity: 'error',
        scope: `li/${li.id}`,
        message: `${li.id} доступен только в ${liAnchorCount.get(li.id) ?? 0} якорях — нужно минимум 2`,
      });
    }
  }

  // ── Бюджеты (warnings) ─────────────────────────────────────────────────
  const targets = computeOutlineTargets(brief);

  if (Math.abs(anchors.length - targets.anchorCount) > 2) {
    issues.push({
      severity: 'warning',
      scope: 'budget/anchors',
      message: `якорей ${anchors.length} при целевых ${targets.anchorCount} (${brief.scale.targetDurationMinutes} мин)`,
    });
  }

  const perAct = new Map<number, number>();
  for (const a of anchors) perAct.set(a.act, (perAct.get(a.act) ?? 0) + 1);
  targets.anchorsPerAct.forEach((target, i) => {
    const act = i + 1;
    const actual = perAct.get(act) ?? 0;
    if (target > 0 && (actual > target * 1.5 + 1 || actual < target / 1.5 - 1)) {
      issues.push({
        severity: 'warning',
        scope: `budget/act/${act}`,
        message: `в акте ${act} якорей ${actual} при целевых ~${target}`,
      });
    }
  });

  const plotOnly = anchors.filter(a => a.availableLIs.length === 0).length;
  if (Math.abs(plotOnly - targets.plotOnlyAnchorCount) > 2) {
    issues.push({
      severity: 'warning',
      scope: 'budget/plot',
      message: `«чисто сюжетных» якорей (без LI) ${plotOnly} при целевых ~${targets.plotOnlyAnchorCount} (commonRouteShare = ${brief.scale.commonRouteShare})`,
    });
  }

  const maxAct = Math.max(...anchors.map(a => a.act), 1);
  for (const a of anchors) {
    if (a.type === 'climax' && a.availableLIs.length > 2) {
      issues.push({
        severity: 'warning',
        scope: `budget/climax/${a.id}`,
        message: `climax-якорь с ${a.availableLIs.length} LI — развязка раздувается (рекомендуется ≤ 2)`,
      });
    }
  }
  // Прогноз доли финального акта: рёбра × ~5 web-сцен + слоты × ~9 сцен диалогов.
  const edgesInAct = (act: number) =>
    outline.anchorEdges.filter(e => (anchorById.get(e.from)?.act ?? 1) === act).length;
  const slotsInAct = (act: number) =>
    anchors.filter(a => a.act === act).reduce((sum, a) => sum + a.availableLIs.length, 0);
  const projected = (act: number) => edgesInAct(act) * 5 + slotsInAct(act) * 9;
  const totalProjected = Array.from({ length: maxAct }, (_, i) => projected(i + 1)).reduce((a, b) => a + b, 0);
  if (totalProjected > 0 && projected(maxAct) / totalProjected > 0.4) {
    issues.push({
      severity: 'warning',
      scope: 'budget/finale',
      message: `прогнозируемая доля финального акта ${Math.round(
        (100 * projected(maxAct)) / totalProjected,
      )}% сцен (порог 40%) — перенесите встречи в середину`,
    });
  }

  return issues;
}
