import type { BeatPlan, Brief, EncounterSlot, SegmentIssue, StoryOutlinePlan } from './types';
import { ARCHETYPES } from './archetypes';
import { topoOrderAnchors } from './anchorOrder';

/** Порядок позиций битов вдоль арки — для проверки очерёдности. */
const POSITION_ORDER: Record<string, number> = {
  before_obstacle_reveal: 0,
  obstacle_reveal: 1,
  after_obstacle_reveal: 2,
  before_crisis: 3,
  crisis: 4,
  after_crisis: 5,
};

/** Максимум встреч на якорь финального акта (защита от перегрузки развязки). */
const FINAL_ACT_ENCOUNTER_CAP = 3;

export function validateBeatPlan(
  plan: BeatPlan,
  outline: StoryOutlinePlan,
  brief: Brief,
  slots: EncounterSlot[],
): SegmentIssue[] {
  const issues: SegmentIssue[] = [];

  const slotByAnchor = new Map(slots.map(s => [s.anchorId, new Set(s.liIds)]));
  const topoIndex = new Map(topoOrderAnchors(outline).map((a, i) => [a.id, i]));
  const anchorById = new Map(outline.anchors.map(a => [a.id, a]));
  const maxAct = Math.max(...outline.anchors.map(a => a.act), 1);

  // 1. Слоты и дубли.
  const seenPairs = new Set<string>();
  for (const enc of plan.encounters) {
    const key = `${enc.liId}:${enc.anchorId}`;
    const allowed = slotByAnchor.get(enc.anchorId);
    if (!allowed || !allowed.has(enc.liId)) {
      issues.push({
        severity: 'error',
        scope: `slot/${key}`,
        message: `пара (${enc.liId}, ${enc.anchorId}) не входит в допустимые encounterSlots`,
      });
    }
    if (seenPairs.has(key)) {
      issues.push({
        severity: 'error',
        scope: `duplicate/${key}`,
        message: `встреча (${enc.liId}, ${enc.anchorId}) назначена дважды`,
      });
    }
    seenPairs.add(key);

    if (!enc.goal.trim() || enc.goal.length > 250) {
      issues.push({
        severity: 'error',
        scope: `goal/${key}`,
        message: 'goal пуст или длиннее 250 символов — нужно 1 конкретное предложение',
      });
    }
  }

  // 2. Покрытие и биты per LI.
  for (const li of brief.loveInterests) {
    const liSlots = slots.filter(s => s.liIds.includes(li.id));
    const liEncounters = plan.encounters
      .filter(e => e.liId === li.id)
      .sort((a, b) => (topoIndex.get(a.anchorId) ?? 0) - (topoIndex.get(b.anchorId) ?? 0));

    if (liSlots.length >= 2 && liEncounters.length < 2) {
      issues.push({
        severity: 'error',
        scope: `coverage/${li.id}`,
        message: `у ${li.id} только ${liEncounters.length} встреч при ${liSlots.length} доступных слотах — нужно минимум 2`,
      });
    }

    const profile = ARCHETYPES[li.archetype];
    const requiredTypes = profile.requiredBeats.map(b => b.type);
    const placed = liEncounters.filter(e => e.beatType !== null).map(e => e.beatType as string);

    for (const t of requiredTypes) {
      const count = placed.filter(p => p === t).length;
      if (count === 0) {
        issues.push({
          severity: 'error',
          scope: `beats/${li.id}`,
          message: `required beat "${t}" архетипа ${li.archetype} не размещён`,
        });
      } else if (count > 1) {
        issues.push({
          severity: 'error',
          scope: `beats/${li.id}`,
          message: `required beat "${t}" размещён ${count} раз — должен быть ровно один`,
        });
      }
    }
    for (const p of placed) {
      if (!requiredTypes.includes(p as never)) {
        issues.push({
          severity: 'error',
          scope: `beats/${li.id}`,
          message: `beatType "${p}" не принадлежит архетипу ${li.archetype}`,
        });
      }
    }

    // Порядок битов вдоль арки (warning).
    const placedWithPos = liEncounters
      .filter(e => e.beatType !== null)
      .map(e => ({
        enc: e,
        order: POSITION_ORDER[profile.requiredBeats.find(b => b.type === e.beatType)?.position ?? ''] ?? 0,
      }));
    for (let i = 1; i < placedWithPos.length; i++) {
      if (placedWithPos[i].order < placedWithPos[i - 1].order) {
        issues.push({
          severity: 'warning',
          scope: `order/${li.id}`,
          message: `бит "${placedWithPos[i].enc.beatType}" стоит раньше "${
            placedWithPos[i - 1].enc.beatType
          }", нарушая позиции арки`,
        });
      }
    }

    // Финальный акт: не более 1 встречи на LI (warning).
    const finalActEnc = liEncounters.filter(e => (anchorById.get(e.anchorId)?.act ?? 1) === maxAct);
    if (finalActEnc.length > 1) {
      issues.push({
        severity: 'warning',
        scope: `crowding/${li.id}`,
        message: `${finalActEnc.length} встреч ${li.id} в финальном акте — не более одной`,
      });
    }
  }

  // 3. Перегрузка якорей финального акта (warning).
  for (const anchor of outline.anchors) {
    if (anchor.act !== maxAct) continue;
    const count = plan.encounters.filter(e => e.anchorId === anchor.id).length;
    if (count > FINAL_ACT_ENCOUNTER_CAP) {
      issues.push({
        severity: 'warning',
        scope: `crowding/${anchor.id}`,
        message: `${count} встреч на якоре финального акта "${anchor.id}" (порог ${FINAL_ACT_ENCOUNTER_CAP})`,
      });
    }
  }

  return issues;
}
