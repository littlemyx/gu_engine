import { describe, expect, it } from 'vitest';
import { validateCastPlan } from './validateCastPlan';
import { buildStubCastPlan } from './castPlanStub';
import { DEFAULT_DAYPARTS } from './calendarTypes';
import type { CastMember, CastPlan } from './calendarTypes';
import { SAMPLE_BRIEF } from './sampleBrief';
import type { Brief } from './types';

const brief: Brief = SAMPLE_BRIEF; // LI: kira, yuki, asel

/** Лестница из N ступеней без пропусков. */
const goals = (memberId: string, stageCount = 3) =>
  Array.from({ length: stageCount }, (_, i) => i + 1).map(stage => ({
    id: `${memberId}_g${stage}`,
    description: `цель ${stage}`,
    arcStage: stage,
  }));

const member = (id: string, patch?: Partial<CastMember['agenda']>): CastMember => ({
  id,
  isLI: true,
  agenda: {
    goals: goals(id),
    idealRelationship: 'идеал этого персонажа',
    worstRelationship: 'худший исход для него',
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

  it('дыра в лестнице — ЗАМЕЧАНИЕ, не ошибка: 4 ступени лучше стаба с нулём', () => {
    // Регресс живого прогона: пока это была ошибка, модель (она уверенно даёт
    // 4 из 5 и спотыкается на последней) трижды проваливала стадию, и та
    // роняла каст в стаб — а у стаба целей НЕТ ВООБЩЕ. Из-за одной ступени
    // терялась вся арка. Дожимать до N — дело фидбека, а не ультиматума.
    const issues = validateCastPlan(validPlan(), brief, 5);
    expect(issues.filter(i => i.severity === 'error')).toEqual([]);

    const warns = issues.filter(i => i.severity === 'warning' && i.scope === 'members/kira/goals');
    expect(warns.some(i => i.message.includes('ступень близости 4'))).toBe(true);
    expect(warns.some(i => i.message.includes('ступень близости 5'))).toBe(true);
  });

  it('целей нет вовсе — ошибка: арки не существует', () => {
    const plan = validPlan();
    plan.members[0] = member('kira', { goals: [] });
    expect(errorsOf(plan).some(i => i.scope === 'members/kira/goals')).toBe(true);
  });

  it('план на 5 ступеней против N=5 проходит', () => {
    const plan: CastPlan = { members: brief.loveInterests.map(li => member(li.id, { goals: goals(li.id, 5) })) };
    expect(validateCastPlan(plan, brief, 5).filter(i => i.severity === 'error')).toEqual([]);
  });

  it('без ideal/worst — warning: концовки останутся обезличенными', () => {
    const plan = validPlan();
    plan.members[0] = member('kira', { idealRelationship: '', worstRelationship: undefined });
    const warns = validateCastPlan(plan, brief).filter(i => i.severity === 'warning');
    expect(warns.some(i => i.scope === 'members/kira/idealRelationship')).toBe(true);
    expect(warns.some(i => i.scope === 'members/kira/worstRelationship')).toBe(true);
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

  it('непокрытая ступень лестницы — warning на каждую дыру (в фидбек, но не в блок)', () => {
    const plan = validPlan();
    plan.members[0] = member('kira', {
      goals: [{ id: 'g1', description: 'только знакомство', arcStage: 1 }],
    });
    const warns = validateCastPlan(plan, brief).filter(
      i => i.severity === 'warning' && i.scope === 'members/kira/goals',
    );
    expect(warns.some(i => i.message.includes('ступень близости 2'))).toBe(true);
    expect(warns.some(i => i.message.includes('ступень близости 3'))).toBe(true);
    // Но план принимаем: одна ступень — плохая арка, ноль ступеней — никакой.
    expect(errorsOf(plan)).toEqual([]);
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

  it('стаб-план валиден по всем проверкам, кроме пустых goals и ideal/worst', () => {
    // Стаб остаётся фолбэком LLM-стадии: паттерны и теги полны, но целей и
    // персонального представления об отношениях у него нет — их даёт LLM.
    const issues = validateCastPlan(buildStubCastPlan(brief), brief);
    expect(issues.every(i => /\/(goals|idealRelationship|worstRelationship)$/.test(i.scope))).toBe(true);
    expect(issues.filter(i => i.severity === 'error').every(i => i.scope.endsWith('/goals'))).toBe(true);
  });
});
