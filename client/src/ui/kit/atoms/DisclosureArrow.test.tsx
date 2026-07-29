/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DisclosureArrow from './DisclosureArrow';

afterEach(cleanup);

describe('DisclosureArrow, варианты', () => {
  it('collapsed показывает ▸', () => {
    render(<DisclosureArrow expanded={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Раскрыть' }).textContent).toBe('▸');
  });

  it('expanded показывает ▾ и aria-expanded=true', () => {
    render(<DisclosureArrow expanded onToggle={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Раскрыть' });
    expect(btn.textContent).toBe('▾');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('DisclosureArrow, клик', () => {
  it('зовёт onToggle с обратным состоянием', () => {
    const onToggle = vi.fn();
    render(<DisclosureArrow expanded={false} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: 'Раскрыть' }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('без onToggle рендерит неинтерактивный span', () => {
    render(<DisclosureArrow expanded />);

    expect(screen.queryByRole('button')).toBeNull();
    const node = screen.getByText('▾');
    expect(node.tagName).toBe('SPAN');
    expect(node.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('DisclosureArrow, размер', () => {
  it('по умолчанию 10px и бокс 17px', () => {
    render(<DisclosureArrow onToggle={() => {}} />);
    const btn = screen.getByRole('button') as HTMLButtonElement;

    expect(btn.style.fontSize).toBe('10px');
    expect(btn.style.width).toBe('17px');
    expect(btn.style.height).toBe('17px');
  });

  it('переопределяется пропом size', () => {
    render(<DisclosureArrow size={14} onToggle={() => {}} />);
    const btn = screen.getByRole('button') as HTMLButtonElement;

    expect(btn.style.fontSize).toBe('14px');
    expect(btn.style.width).toBe('24px');
    expect(btn.style.height).toBe('24px');
  });
});

describe('DisclosureArrow, подпись', () => {
  it('label переопределяет доступное имя кнопки', () => {
    render(<DisclosureArrow onToggle={() => {}} label="Показать детали" />);
    expect(screen.getByRole('button', { name: 'Показать детали' })).toBeTruthy();
  });
});

describe('DisclosureArrow, направление', () => {
  it('по умолчанию (down) поведение не меняется', () => {
    render(<DisclosureArrow expanded={false} onToggle={() => {}} />);
    expect(screen.getByRole('button').textContent).toBe('▸');
  });

  it('right: свёрнуто ▸, развёрнуто ◂', () => {
    const { rerender } = render(<DisclosureArrow direction="right" expanded={false} onToggle={() => {}} />);
    expect(screen.getByRole('button').textContent).toBe('▸');

    rerender(<DisclosureArrow direction="right" expanded onToggle={() => {}} />);
    expect(screen.getByRole('button').textContent).toBe('◂');
  });

  it('left: свёрнуто ◂, развёрнуто ▸', () => {
    const { rerender } = render(<DisclosureArrow direction="left" expanded={false} onToggle={() => {}} />);
    expect(screen.getByRole('button').textContent).toBe('◂');

    rerender(<DisclosureArrow direction="left" expanded onToggle={() => {}} />);
    expect(screen.getByRole('button').textContent).toBe('▸');
  });

  it('немая стрелка (без onToggle) тоже учитывает direction', () => {
    render(<DisclosureArrow direction="left" expanded={false} />);
    const node = screen.getByText('◂');
    expect(node.tagName).toBe('SPAN');
  });
});

describe('DisclosureArrow на тёмном', () => {
  it('получает отдельный класс, а не тот же, что на светлом', () => {
    const { container: light } = render(<DisclosureArrow onToggle={() => {}} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<DisclosureArrow onDark onToggle={() => {}} />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});
