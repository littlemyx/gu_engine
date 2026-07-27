import { beforeEach, describe, expect, it } from 'vitest';

import { appendRunLog, clearRunLog, useRunLog } from '@/narrative/runLog';

import { resetProjectStores } from './newProject';

describe('resetProjectStores', () => {
  beforeEach(() => clearRunLog());

  it('очищает консоль прогона — лог относится к сессии проекта', () => {
    appendRunLog('ok', 'бандл собран · Осенние тени университета');

    resetProjectStores();

    expect(useRunLog.getState().lines).toEqual([]);
  });
});
