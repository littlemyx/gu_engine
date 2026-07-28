/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Stepper from './Stepper';

afterEach(cleanup);

describe('Stepper, значение', () => {
  it('показывает подпись и значение по умолчанию', () => {
    render(<Stepper label="слотов" />);

    expect(screen.getByText('слотов')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('без showLabel подпись не рендерится', () => {
    render(<Stepper label="слотов" showLabel={false} />);

    expect(screen.queryByText('слотов')).toBeNull();
  });

  it('печатает единицу рядом со значением', () => {
    render(<Stepper value={7} unit="сек" />);

    expect(screen.getByText('7 сек')).toBeTruthy();
  });

  it('кнопка «больше» увеличивает значение на step и вызывает onChange', () => {
    const onChange = vi.fn();
    render(<Stepper value={4} step={2} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'больше' }));

    expect(screen.getByText('6')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('кнопка «меньше» уменьшает значение на step', () => {
    const onChange = vi.fn();
    render(<Stepper value={4} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'меньше' }));

    expect(screen.getByText('3')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('не выходит за границы max', () => {
    const onChange = vi.fn();
    render(<Stepper value={9} max={9} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'больше' }));

    expect(screen.getByText('9')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith(9);
  });

  it('не выходит за границы min', () => {
    const onChange = vi.fn();
    render(<Stepper value={0} min={0} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'меньше' }));

    expect(screen.getByText('0')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith(0);
  });
});

describe('Stepper, состояния', () => {
  it('получает фокус по клавиатуре (focus-visible через CSS)', () => {
    render(<Stepper />);

    const btn = screen.getByRole('button', { name: 'больше' });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('disabled отключает обе кнопки и не вызывает onChange', () => {
    const onChange = vi.fn();
    render(<Stepper value={4} disabled onChange={onChange} />);

    const up = screen.getByRole('button', { name: 'больше' }) as HTMLButtonElement;
    const down = screen.getByRole('button', { name: 'меньше' }) as HTMLButtonElement;
    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(true);

    fireEvent.click(up);
    fireEvent.click(down);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('4')).toBeTruthy();
  });
});
