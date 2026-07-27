import { describe, expect, it } from 'vitest';

import { breakpointOf, isNarrow, isReadonly } from './useBreakpoint';

describe('брейкпойнты шелла', () => {
  it('границы включают нижнее значение диапазона', () => {
    expect(breakpointOf(1600)).toBe('canon');
    expect(breakpointOf(1440)).toBe('canon');
    expect(breakpointOf(1439)).toBe('compact');
    expect(breakpointOf(1280)).toBe('compact');
    expect(breakpointOf(1279)).toBe('narrow');
    expect(breakpointOf(1024)).toBe('narrow');
    expect(breakpointOf(1023)).toBe('readonly');
    expect(breakpointOf(360)).toBe('readonly');
  });

  it('узкий режим включает и режим чтения: рейл там тоже свёрнут', () => {
    expect(isNarrow('narrow')).toBe(true);
    expect(isNarrow('readonly')).toBe(true);
    expect(isNarrow('compact')).toBe(false);
  });

  it('запрет действий — только на самом узком экране', () => {
    expect(isReadonly('readonly')).toBe(true);
    expect(isReadonly('narrow')).toBe(false);
  });
});
