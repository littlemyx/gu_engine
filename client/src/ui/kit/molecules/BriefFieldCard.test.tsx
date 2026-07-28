/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BriefFieldCard, { type BriefFieldCardState } from './BriefFieldCard';

afterEach(cleanup);

const STATES: BriefFieldCardState[] = ['empty', 'auto', 'filling', 'proposed', 'done'];

describe.each(STATES)('BriefFieldCard, состояние %s', state => {
  it('показывает кикер поля', () => {
    render(<BriefFieldCard kicker="ЛОГЛАЙН И ТОН" state={state} value="летняя история" />);
    expect(screen.getByText(text => text.startsWith('ЛОГЛАЙН И ТОН'))).toBeTruthy();
  });
});

describe('BriefFieldCard, состояние «пусто»', () => {
  it('показывает плейсхолдер вместо значения', () => {
    render(<BriefFieldCard kicker="КАСТ" state="empty" placeholder="заполните каст" value="не должно показаться" />);
    expect(screen.getByText('заполните каст')).toBeTruthy();
    expect(screen.queryByText('не должно показаться')).toBeNull();
  });
});

describe('BriefFieldCard, состояние «авто»', () => {
  it('без значения — только пояснение про генератор', () => {
    render(<BriefFieldCard kicker="СТИЛЬ КАДРА" state="auto" />);
    expect(screen.getByText('⚙ авто')).toBeTruthy();
    expect(screen.queryByText('решено в прогоне:')).toBeNull();
  });

  it('со значением — показывает решённое в прогоне', () => {
    render(<BriefFieldCard kicker="СТИЛЬ КАДРА" state="auto" value="акварель" />);
    expect(screen.getByText('решено в прогоне:')).toBeTruthy();
    expect(screen.getByText('акварель')).toBeTruthy();
  });
});

describe('BriefFieldCard, состояние «заполняется»', () => {
  it('показывает текущее значение потока', () => {
    render(<BriefFieldCard kicker="ЛОГЛАЙН И ТОН" state="filling" value="летняя история о" />);
    expect(screen.getByText(/летняя история о/)).toBeTruthy();
  });
});

describe('BriefFieldCard, состояние «предложено»', () => {
  it('показывает бейдж генератора и значение', () => {
    render(<BriefFieldCard kicker="ЛОГЛАЙН И ТОН" state="proposed" value="летняя история о возвращении" />);
    expect(screen.getByText('⚙ предложено')).toBeTruthy();
    expect(screen.getByText('летняя история о возвращении')).toBeTruthy();
  });
});

describe('BriefFieldCard, состояние «готово»', () => {
  it('показывает галочку и значение', () => {
    render(<BriefFieldCard kicker="ЛОГЛАЙН И ТОН" state="done" value="летняя история" />);
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('летняя история')).toBeTruthy();
  });
});

describe('BriefFieldCard, директива и подсказка', () => {
  it('показывает директиву из заметок, когда она задана', () => {
    render(<BriefFieldCard kicker="ТОН" state="done" value="тёплый" directive="без иронии" />);
    expect(screen.getByText('→ из заметок: «без иронии»')).toBeTruthy();
  });

  it('не показывает директиву, когда она пустая', () => {
    render(<BriefFieldCard kicker="ТОН" state="done" value="тёплый" />);
    expect(screen.queryByText(/из заметок/)).toBeNull();
  });

  it('показывает подсказку, когда она задана', () => {
    render(<BriefFieldCard kicker="ТОН" state="done" value="тёплый" hint="видно в чек-листе зоны" />);
    expect(screen.getByText('видно в чек-листе зоны')).toBeTruthy();
  });
});

describe('BriefFieldCard, вид «календарь»', () => {
  it('показывает степперы дней/частей и формулу слотов', () => {
    render(<BriefFieldCard kicker="КАЛЕНДАРЬ" state="done" kind="calendar" days={7} parts={3} />);
    expect(screen.getByText('дней')).toBeTruthy();
    expect(screen.getByText('частей в дне')).toBeTruthy();
    expect(screen.getByText('= 7 × 3 слотов')).toBeTruthy();
  });

  it('вызывает onDaysChange/onPartsChange по клику на степперы', () => {
    const onDaysChange = vi.fn();
    const onPartsChange = vi.fn();
    render(
      <BriefFieldCard
        kicker="КАЛЕНДАРЬ"
        state="done"
        kind="calendar"
        days={7}
        parts={3}
        onDaysChange={onDaysChange}
        onPartsChange={onPartsChange}
      />,
    );
    const [daysUp, partsUp] = screen.getAllByRole('button', { name: 'больше' });
    fireEvent.click(daysUp);
    fireEvent.click(partsUp);
    expect(onDaysChange).toHaveBeenCalledWith(8);
    expect(onPartsChange).toHaveBeenCalledWith(4);
  });

  it('вид «текст» не рендерит степперы', () => {
    render(<BriefFieldCard kicker="ЛОГЛАЙН И ТОН" state="done" kind="text" value="история" />);
    expect(screen.queryByText('дней')).toBeNull();
  });
});
