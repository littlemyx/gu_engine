/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useBriefStore } from '@/narrative/briefStore';
import { useNarrativeStore } from '@/narrative/narrativeStore';

import QaZone from './QaZone';

import type { Brief, SegmentIssue } from '@/narrative/types';
import type { SpineEnding, SpinePlan } from '@/narrative/calendarTypes';
import type { PolicyReport } from '@/narrative/storyQA';

afterEach(() => {
  cleanup();
  useNarrativeStore.setState({ spine: null, storyQA: null });
});

// jest-dom в проекте нет — смотрим сам DOM (текстовое содержимое).

const brief = {
  loveInterests: [{ id: 'kira', name: 'Кира' }],
} as unknown as Brief;

function ending(id: string, kind: SpineEnding['kind'], liId: string | null): SpineEnding {
  return { id, kind, liId, guard: { allOf: [] } } as unknown as SpineEnding;
}

function spine(endings: SpineEnding[]): SpinePlan {
  return { title: 'т', logline: '', beats: [], endings } as unknown as SpinePlan;
}

function issue(scope: string, message: string, severity: SegmentIssue['severity'] = 'error'): SegmentIssue {
  return { severity, scope, message };
}

function policy(overrides: Partial<PolicyReport>): PolicyReport {
  return {
    policy: 'spine-only',
    seed: 1,
    reachedFinale: true,
    endingSatisfied: null,
    firedBeats: [],
    firedUnits: [],
    deadSlots: [],
    actsPlayed: 0,
    relFinal: {},
    slotCount: 10,
    ...overrides,
  };
}

describe('QaZone — QA ещё не запускался', () => {
  it('честно называет пустоту, ничего не выдумывая', () => {
    useBriefStore.setState({ brief });
    render(<QaZone />);

    expect(screen.getByText('Проверка')).toBeTruthy();
    expect(screen.getByText(/Story QA ещё не запускался/)).toBeTruthy();
    expect(screen.getByText('Прогонов ещё не было.')).toBeTruthy();
    expect(screen.getByText('Политики ещё не прогонялись.')).toBeTruthy();
    expect(screen.getByText('В хребте пока нет ни одной концовки.')).toBeTruthy();
  });

  it('без концовок в хребте — KPI показывает 0 из 0, а не NaN', () => {
    useBriefStore.setState({ brief });
    render(<QaZone />);

    expect(screen.getByText('0/0')).toBeTruthy();
  });

  it('концовки в хребте уже есть, а прогонов симуляции — нет: чек-лист висит в pending', () => {
    useBriefStore.setState({ brief });
    useNarrativeStore.setState({ spine: spine([ending('e_good', 'good', 'kira'), ending('e_bad', 'bad', null)]) });
    render(<QaZone />);

    // Заголовок появляется и в чек-листе, и в карте достижимости — оба тона одной концовки.
    expect(screen.getAllByText('хорошая · Кира').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('плохая').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('нет прогонов симуляции')).toHaveLength(2);
  });
});

describe('QaZone — заполненный отчёт', () => {
  const endings = [ending('e_good', 'good', 'kira'), ending('e_bad', 'bad', null)];

  const issues: SegmentIssue[] = [
    issue('spine/beat_1', 'бит "beat_1" не удаётся расположить в окне акта', 'error'),
    issue('dialogue/unit_kira_pier/positive', 'реплика повторяется дословно', 'warning'),
  ];

  const policyReports: PolicyReport[] = [
    policy({ policy: 'spine-only', seed: 1, endingSatisfied: 'e_good', firedBeats: ['b1', 'b2'] }),
    policy({ policy: 'round-robin', seed: 2, endingSatisfied: 'e_good', firedBeats: ['b1'] }),
    policy({ policy: 'seeded-random:1', seed: 3, reachedFinale: false, slotCount: 8 }),
  ];

  function setUp() {
    useBriefStore.setState({ brief });
    useNarrativeStore.setState({
      spine: spine(endings),
      storyQA: { state: 'done', issues, policyReports },
    });
  }

  it('KPI считает блокеров, предупреждений и достижимых концовок', () => {
    setUp();
    render(<QaZone />);

    // Один error и один warning среди issues — оба KPI-пункта показывают «1».
    expect(screen.getAllByText('1')).toHaveLength(2);
    // «e_bad» ни разу не выполнен ни одной политикой — достижима только одна из двух.
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByText('Проблемы · 2')).toBeTruthy();
  });

  // Петля фидбека: кнопка живёт под списком проблем и требует и отчёта, и колбэка.
  it('кнопка «Перегенерировать с фидбеком QA» зовёт колбэк', () => {
    setUp();
    const onRegenerate = vi.fn();
    render(<QaZone onRegenerate={onRegenerate} />);

    (screen.getByRole('button', { name: 'Перегенерировать с фидбеком QA' }) as HTMLButtonElement).click();
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('без колбэка кнопки нет — зона остаётся витриной', () => {
    setUp();
    render(<QaZone />);

    expect(screen.queryByRole('button', { name: 'Перегенерировать с фидбеком QA' })).toBeNull();
  });

  it('список проблем: блокер и предупреждение видны с маршрутом действия', () => {
    setUp();
    render(<QaZone />);

    expect(screen.getByText(/бит "beat_1"/)).toBeTruthy();
    expect(screen.getByText(/реплика повторяется дословно/)).toBeTruthy();
    expect(screen.getByText('→ Структура')).toBeTruthy();
    expect(screen.getByText('→ Генерация')).toBeTruthy();
  });

  it('клик по проблеме открывает цитату и маршрут, повторный клик — закрывает', () => {
    setUp();
    render(<QaZone />);

    // Строка списка — кликабельная кнопка; держим одну ссылку на неё, потому что
    // после открытия детали текст проблемы дублируется и в цитате.
    const row = screen.getByRole('button', { name: /бит "beat_1"/ });
    fireEvent.click(row);

    expect(screen.getByText(/цитата:/)).toBeTruthy();
    expect(screen.getAllByText(/бит "beat_1" не удаётся расположить/).length).toBe(2);
    expect(screen.getByText(/источник: spine\/beat_1/)).toBeTruthy();
    expect(screen.getByText('Структура')).toBeTruthy();
    expect(screen.getByText('Хребет')).toBeTruthy();

    fireEvent.click(row);
    expect(screen.queryByText(/цитата:/)).toBeFalsy();
  });

  it('второй юнит-маршрут ведёт в сценарий, с id юнита', () => {
    setUp();
    render(<QaZone />);

    fireEvent.click(screen.getByText(/реплика повторяется дословно/));

    // id юнита виден и в scope-сноске цитаты, и в маршруте.
    expect(screen.getAllByText(/unit_kira_pier/).length).toBeGreaterThanOrEqual(2);
  });

  it('симуляция политик: провал финала — ошибка, выполненная концовка — ок', () => {
    setUp();
    render(<QaZone />);

    expect(screen.getByText('spine-only · seed 1')).toBeTruthy();
    // Обе успешные политики сошлись на одной и той же концовке.
    expect(screen.getAllByText(/концовка «хорошая · Кира»/)).toHaveLength(2);
    expect(screen.getByText(/финал не достигнут за 8 слотов/)).toBeTruthy();
  });

  it('чек-лист достижимости: недостижимая концовка отличима от достижимой по мете', () => {
    setUp();
    render(<QaZone />);

    expect(screen.getByText('2/3 прогонов · 67%')).toBeTruthy(); // e_good
    expect(screen.getByText('0/3 прогонов · 0%')).toBeTruthy(); // e_bad, никогда не выполнена
  });

  it('карта достижимости озаглавлена числом прогонов', () => {
    setUp();
    render(<QaZone />);

    expect(screen.getByText('ДОСТИЖИМОСТЬ КОНЦОВОК · 3 ПРОГОНОВ')).toBeTruthy();
  });
});
