import { beforeEach, describe, expect, it } from 'vitest';

import { appendRunLog, clearRunLog, formatLogTime, RUN_LOG_CAPACITY, useRunLog } from './runLog';

describe('runLog', () => {
  beforeEach(() => clearRunLog());

  it('копит строки в порядке добавления', () => {
    appendRunLog('run', 'старт');
    appendRunLog('ok', 'cast ✓');

    expect(useRunLog.getState().lines.map(l => [l.tone, l.text])).toEqual([
      ['run', 'старт'],
      ['ok', 'cast ✓'],
    ]);
  });

  it('кольцевой буфер держит только последние RUN_LOG_CAPACITY строк', () => {
    for (let i = 0; i < RUN_LOG_CAPACITY + 25; i += 1) appendRunLog('info', `строка ${i}`);

    const { lines } = useRunLog.getState();
    expect(lines).toHaveLength(RUN_LOG_CAPACITY);
    expect(lines[0].text).toBe('строка 25');
    expect(lines[lines.length - 1].text).toBe(`строка ${RUN_LOG_CAPACITY + 24}`);
  });

  it('формат времени — часы:минуты:секунды с ведущими нулями', () => {
    const t = new Date(2026, 6, 23, 9, 4, 7).getTime();
    expect(formatLogTime(t)).toBe('09:04:07');
  });
});
