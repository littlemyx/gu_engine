import { describe, expect, it } from 'vitest';
import { buildSeedIssues } from './qaSeeds';
import type { SegmentIssue } from './types';
import type { EventUnit } from './calendarTypes';

const issue = (scope: string, message = 'msg', severity: SegmentIssue['severity'] = 'warning'): SegmentIssue => ({
  severity,
  scope,
  message,
});

const unit = (id: string, liId: string): EventUnit => ({ id, participants: [liId] } as unknown as EventUnit);

const LI_IDS = ['kira', 'yuki', 'asel'];

describe('buildSeedIssues', () => {
  it('sim/greedy-li сидируется в хребет и пул своего LI', () => {
    const seeds = buildSeedIssues([issue('sim/greedy-li:kira', 'мёртвых слотов 8 из 12')], [], LI_IDS);
    expect(seeds?.spine).toHaveLength(1);
    expect(Object.keys(seeds?.eventPool ?? {})).toEqual(['kira']);
  });

  it('общие политики (round-robin, seeded-random) сидируются в пулы всех LI', () => {
    const seeds = buildSeedIssues([issue('sim/round-robin'), issue('sim/seeded-random:1')], [], LI_IDS);
    expect(Object.keys(seeds?.eventPool ?? {}).sort()).toEqual(['asel', 'kira', 'yuki']);
    expect(seeds?.eventPool?.kira).toHaveLength(2);
    expect(seeds?.spine).toHaveLength(2);
  });

  it('sim/spine-only не трогает пулы', () => {
    const seeds = buildSeedIssues([issue('sim/spine-only')], [], LI_IDS);
    expect(seeds?.eventPool).toBeUndefined();
    expect(seeds?.spine).toHaveLength(1);
  });

  it('qa/deadContent сидируется в хребет и пулы владельцев мёртвых юнитов', () => {
    const units = [unit('evt_asel_secret', 'asel'), unit('evt_kira_lecture', 'kira'), unit('evt_yuki_walk', 'yuki')];
    const seeds = buildSeedIssues(
      [issue('qa/deadContent', '2 юнитов недостижимы: evt_asel_secret, evt_yuki_walk')],
      units,
      LI_IDS,
    );
    expect(seeds?.spine).toHaveLength(1);
    expect(Object.keys(seeds?.eventPool ?? {}).sort()).toEqual(['asel', 'yuki']);
  });

  it('dialogue-issues группируются по unitId, spine/leaf идут в хребет', () => {
    const seeds = buildSeedIssues(
      [
        issue('dialogue/evt_kira_lecture/n1/choice/c1', 'рассинхрон текста и kind'),
        issue('spine/structure', 'плохой бит'),
        issue('leaf/good:kira', 'скомканный финал'),
      ],
      [],
      LI_IDS,
    );
    expect(seeds?.dialogue).toEqual({
      evt_kira_lecture: ['[warning] dialogue/evt_kira_lecture/n1/choice/c1: рассинхрон текста и kind'],
    });
    expect(seeds?.spine).toHaveLength(2);
    expect(seeds?.eventPool).toBeUndefined();
  });

  it('coverage/<li> сидируется в пул своего LI (не в хребет)', () => {
    const seeds = buildSeedIssues([issue('coverage/yuki', 'заговорить нечем')], [], LI_IDS);
    expect(Object.keys(seeds?.eventPool ?? {})).toEqual(['yuki']);
    expect(seeds?.spine).toBeUndefined();
  });

  it('прочие группы (calendar/units/qa-prose) не сидируются; пусто → undefined', () => {
    expect(
      buildSeedIssues([issue('calendar/slots'), issue('units/window'), issue('qa/prose/evt_x')], [], LI_IDS),
    ).toBeUndefined();
    expect(buildSeedIssues([], [], LI_IDS)).toBeUndefined();
  });
});
