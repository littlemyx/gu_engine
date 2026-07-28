/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import IconRail, { type IconRailItem } from './IconRail';

afterEach(cleanup);

const ITEMS: IconRailItem[] = [
  { glyph: '≡', label: 'Иерархия — открывается оверлеем' },
  { glyph: '◐', label: 'Префабы' },
  { glyph: '▦', label: 'Ассеты' },
  { glyph: '✓', label: 'QA' },
];

describe('IconRail, состав', () => {
  it('рисует кнопку на каждый пункт с его подписью', () => {
    render(<IconRail items={ITEMS} onSelect={() => {}} />);

    ITEMS.forEach(item => {
      expect(screen.getByRole('button', { name: item.label })).toBeTruthy();
    });
  });

  it('без onSelect кнопок нет — пункты не интерактивны', () => {
    render(<IconRail items={ITEMS} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    ITEMS.forEach(item => {
      expect(screen.getByLabelText(item.label)).toBeTruthy();
    });
  });
});

describe('IconRail, активный пункт', () => {
  it('по умолчанию активен нулевой индекс', () => {
    render(<IconRail items={ITEMS} onSelect={() => {}} />);

    const first = screen.getByRole('button', { name: ITEMS[0].label });
    expect(first.parentElement?.className).toMatch(/selected/);
  });

  it('active переключает подсветку на нужный пункт', () => {
    render(<IconRail items={ITEMS} active={2} onSelect={() => {}} />);

    const active = screen.getByRole('button', { name: ITEMS[2].label });
    const others = ITEMS.filter((_, index) => index !== 2).map(item =>
      screen.getByRole('button', { name: item.label }),
    );

    expect(active.parentElement?.className).toMatch(/selected/);
    others.forEach(btn => expect(btn.parentElement?.className).not.toMatch(/selected/));
  });

  it('клик по пункту вызывает onSelect с индексом и пунктом', () => {
    const onSelect = vi.fn();
    render(<IconRail items={ITEMS} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: ITEMS[1].label }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(1, ITEMS[1]);
  });

  it('disabled-пункт не пускает клик', () => {
    const onSelect = vi.fn();
    const items: IconRailItem[] = [...ITEMS.slice(0, 2), { ...ITEMS[2], disabled: true }, ITEMS[3]];
    render(<IconRail items={items} onSelect={onSelect} />);

    const disabledButton = screen.getByRole('button', { name: ITEMS[2].label }) as HTMLButtonElement;
    expect(disabledButton.disabled).toBe(true);

    fireEvent.click(disabledButton);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('IconRail, подпись у подножия', () => {
  it('без note подписи нет', () => {
    render(<IconRail items={ITEMS} />);

    expect(screen.queryByText('v2')).toBeNull();
  });

  it('с note подпись рисуется', () => {
    render(<IconRail items={ITEMS} note="v2" />);

    expect(screen.getByText('v2')).toBeTruthy();
  });
});
