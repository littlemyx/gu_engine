/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FxParam from './FxParam';

afterEach(cleanup);

describe('FxParam, контент', () => {
  it('показывает подпись и значение в процентах', () => {
    render(<FxParam label="реверб" value={18} />);

    expect(screen.getByText('реверб')).toBeTruthy();
    expect(screen.getByText('18%')).toBeTruthy();
  });

  it('по умолчанию значение — 18%', () => {
    render(<FxParam label="дилэй" />);

    expect(screen.getByText('18%')).toBeTruthy();
  });

  it('трек доступен как role=slider с подписью', () => {
    render(<FxParam label="хорус" value={40} />);

    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuenow')).toBe('40');
    expect(slider.getAttribute('aria-label')).toBe('хорус');
  });
});

describe('FxParam, изменение значения', () => {
  it('стрелка вправо на треке двигает значение, обновляет подпись и вызывает onChange', () => {
    const onChange = vi.fn();
    render(<FxParam label="реверб" value={18} onChange={onChange} />);

    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith(19);
    expect(screen.getByText('19%')).toBeTruthy();
    expect(screen.queryByText('18%')).toBeNull();
  });

  it('Shift+стрелка двигает значение на 10', () => {
    const onChange = vi.fn();
    render(<FxParam label="реверб" value={18} onChange={onChange} />);

    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });

    expect(onChange).toHaveBeenCalledWith(28);
    expect(screen.getByText('28%')).toBeTruthy();
  });
});

describe('FxParam, disabled', () => {
  it('трек получает aria-disabled и не реагирует на клавиатуру', () => {
    const onChange = vi.fn();
    render(<FxParam label="реверб" value={18} disabled onChange={onChange} />);

    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-disabled')).toBe('true');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('18%')).toBeTruthy();
  });
});
