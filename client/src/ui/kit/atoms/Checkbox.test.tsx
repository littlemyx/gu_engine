/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Checkbox from './Checkbox';

afterEach(cleanup);

describe('Checkbox, варианты', () => {
  it('unchecked несёт aria-checked=false и без галочки', () => {
    render(<Checkbox label="автосохранение" checked={false} onChange={() => {}} />);

    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-checked')).toBe('false');
    expect(box.textContent).not.toContain('✓');
  });

  it('checked несёт aria-checked=true и рисует галочку', () => {
    render(<Checkbox label="автосохранение" checked onChange={() => {}} />);

    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-checked')).toBe('true');
    expect(box.textContent).toContain('✓');
  });

  it('disabled-dashed отключает кнопку и не пускает клик', () => {
    const onChange = vi.fn();
    render(<Checkbox label="автосохранение" checked disabled onChange={onChange} />);

    const box = screen.getByRole('checkbox') as HTMLButtonElement;
    expect(box.disabled).toBe(true);
    fireEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Checkbox, взаимодействие', () => {
  it('клик переключает состояние наружу через onChange', () => {
    const onChange = vi.fn();
    render(<Checkbox label="автосохранение" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('без onChange рендерится неинтерактивный индикатор, не кнопка', () => {
    render(<Checkbox label="автосохранение" checked />);

    expect(screen.queryByRole('button')).toBeNull();
    const box = screen.getByRole('checkbox');
    expect(box.tagName).toBe('SPAN');
  });

  it('showLabel=false прячет подпись, но не сам квадрат', () => {
    render(<Checkbox label="автосохранение" showLabel={false} onChange={() => {}} />);

    expect(screen.queryByText('автосохранение')).toBeNull();
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('подпись приходит пропсом, а не хардкодом', () => {
    render(<Checkbox label="звук эффектов" onChange={() => {}} />);

    expect(screen.getByText('звук эффектов')).toBeTruthy();
  });
});

describe('Checkbox, тёмный хром', () => {
  it('на тёмном получает отдельный класс', () => {
    const { container: light } = render(<Checkbox label="автосохранение" checked onChange={() => {}} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Checkbox label="автосохранение" checked onDark onChange={() => {}} />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});
