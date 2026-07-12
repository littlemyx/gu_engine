import { describe, expect, it } from 'vitest';
import { validateCastPlan } from './validateCastPlan';
import { buildStubCastPlan } from './castPlanStub';
import { DEFAULT_DAYPARTS } from './calendarTypes';
import type { CastMember, CastPlan } from './calendarTypes';
import { SAMPLE_BRIEF } from './sampleBrief';
import type { Brief } from './types';

const brief: Brief = SAMPLE_BRIEF; // LI: kira, yuki, asel

const goals = (memberId: string) =>
  [1, 2, 3].map(stage => ({ id: `${memberId}_g${stage}`, description: `цель ${stage}`, arcStage: stage }));

const member = (id: string, patch?: Partial<CastMember['agenda']>): CastMember => ({
  id,
  isLI: true,
  agenda: {
    goals: goals(id),
    weeklyPattern: {
      [DEFAULT_DAYPARTS[0]]: [{ tag: 'workplace', weight: 2 }],
      [DEFAULT_DAYPARTS[1]]: [{ tag: 'hangout', weight: 1 }],
      [DEFAULT_DAYPARTS[2]]: [
        { tag: 'hangout', weight: 2 },
        { tag: 'home', weight: 1 },
      ],
    },
    locationTags: { workplace: 'работа', hangout: 'отдых', home: 'дом' },
    ...patch,
  },
});

const validPlan = (): CastPlan => ({ members: brief.loveInterests.map(li => member(li.id)) });

const errorsOf = (plan: CastPlan) => validateCastPlan(plan, brief).filter(i => i.severity === 'error');

describe('validateCastPlan', () => {
  it('валидный план проходит без ошибок', () => {
    expect(validateCastPlan(validPlan(), brief)).toEqual([]);
  });

  it('пропущенный LI брифа — error', () => {
    const plan = validPlan();
    plan.members = plan.members.filter(m => m.id !== 'yuki');
    const errs = errorsOf(plan);
    expect(errs.some(i => i.message.includes('"yuki"') && i.message.includes('отсутствует'))).toBe(true);
  });

  it('лишний member вне брифа — error', () => {
    const plan = validPlan();
    plan.members.push(member('stranger'));
    expect(errorsOf(plan).some(i => i.message.includes('"stranger"'))).toBe(true);
  });

  it('пустые goals — error', () => {
    const plan = validPlan();
    plan.members[0] = member('kira', { goals: [] });
    expect(errorsOf(plan).some(i => i.scope === 'members/kira/goals')).toBe(true);
  });

  it('непокрытая стадия арки — error на каждую дыру', () => {
    const plan = validPlan();
    plan.members[0] = member('kira', {
      goals: [{ id: 'g1', description: 'только знакомство', arcStage: 1 }],
    });
    const errs = errorsOf(plan).filter(i => i.scope === 'members/kira/goals');
    expect(errs.some(i => i.message.includes('стадию арки 2'))).toBe(true);
    expect(errs.some(i => i.message.includes('стадию арки 3'))).toBe(true);
  });

  it('часть дня без записей weeklyPattern — error', () => {
    const plan = validPlan();
    const agenda = plan.members[0].agenda;
    plan.members[0] = member('kira', {
      weeklyPattern: { ...agenda.weeklyPattern, [DEFAULT_DAYPARTS[1]]: [] },
    });
    expect(errorsOf(plan).some(i => i.scope === 'members/kira/weeklyPattern' && i.message.includes('день'))).toBe(true);
  });

  it('тег паттерна вне locationTags — error; неположительный вес — warning', () => {
    const plan = validPlan();
    plan.members[0] = member('kira', {
      weeklyPattern: {
        [DEFAULT_DAYPARTS[0]]: [{ tag: 'ghost_tag', weight: 0 }],
        [DEFAULT_DAYPARTS[1]]: [{ tag: 'hangout', weight: 1 }],
        [DEFAULT_DAYPARTS[2]]: [{ tag: 'home', weight: 1 }],
      },
    });
    const issues = validateCastPlan(plan, brief);
    expect(issues.some(i => i.severity === 'error' && i.message.includes('"ghost_tag"'))).toBe(true);
    expect(issues.some(i => i.severity === 'warning' && i.message.includes('вес'))).toBe(true);
  });

  it('стаб-план валиден по всем проверкам, кроме пустых goals', () => {
    // Стаб остаётся фолбэком LLM-стадии: паттерны и теги полны, но целей нет.
    const issues = validateCastPlan(buildStubCastPlan(brief), brief);
    expect(issues.every(i => i.scope.endsWith('/goals'))).toBe(true);
  });
});
