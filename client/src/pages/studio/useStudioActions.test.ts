import { describe, expect, it } from 'vitest';

import { computeExportGate } from './useStudioActions';

import type { SegmentIssue } from '@/narrative/types';

const full = {
  hasSpine: true,
  hasCalendar: true,
  hasSchedule: true,
  hasWorld: true,
  qaErrors: [] as SegmentIssue[],
};

const error: SegmentIssue = {
  severity: 'error',
  scope: 'qa/prose/enc_kira',
  message: 'достижимый юнит без прозы',
};

describe('гейт экспорта', () => {
  it('полный стек без ошибок QA — качаем сразу', () => {
    expect(computeExportGate(full)).toEqual({ ok: true });
  });

  it('неполный стек называет первую недостающую часть', () => {
    expect(computeExportGate({ ...full, hasSpine: false })).toEqual({
      ok: false,
      stackReason: 'нет хребта — сначала прогон',
    });
    expect(computeExportGate({ ...full, hasWorld: false })).toEqual({
      ok: false,
      stackReason: 'нет модели мира',
    });
  });

  it('ошибки QA блокируют экспорт и уезжают в модалку', () => {
    expect(computeExportGate({ ...full, qaErrors: [error] })).toEqual({ ok: false, errors: [error] });
  });

  it('нехватка артефактов важнее ошибок QA: их нечем чинить', () => {
    const gate = computeExportGate({ ...full, hasCalendar: false, qaErrors: [error] });

    expect(gate).toEqual({ ok: false, stackReason: 'нет календаря' });
  });
});
