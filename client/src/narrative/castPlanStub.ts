import type { Brief } from './types';
import type { CastPlan } from './calendarTypes';
import { DEFAULT_DAYPARTS } from './calendarTypes';

/**
 * Детерминированный стаб стадии castPlan (фаза 1 календарного пайплайна):
 * без LLM-вызова каждому LI выдаются три базовых тега локаций и общий
 * weekly-паттерн. LLM-агенды с целями по стадиям арки приходят в фазе 4 —
 * до тех пор goals пусты, а стаб служит входом для worldCalendar (tagMap)
 * и buildScheduleStub.
 */

const [MORNING, DAY, EVENING] = DEFAULT_DAYPARTS;

export function buildStubCastPlan(brief: Brief): CastPlan {
  return {
    members: brief.loveInterests.map(li => ({
      id: li.id,
      isLI: true,
      agenda: {
        goals: [],
        weeklyPattern: {
          [MORNING]: [{ tag: 'workplace', weight: 2 }],
          [DAY]: [
            { tag: 'workplace', weight: 1 },
            { tag: 'hangout', weight: 1 },
          ],
          [EVENING]: [
            { tag: 'hangout', weight: 2 },
            { tag: 'home', weight: 1 },
          ],
        },
        locationTags: {
          workplace: li.roleInWorld || 'место занятий',
          hangout: 'место отдыха и встреч',
          home: 'дом/личное пространство',
        },
      },
    })),
  };
}
