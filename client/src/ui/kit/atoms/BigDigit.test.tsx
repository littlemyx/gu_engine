/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import BigDigit, { type BigDigitTone } from './BigDigit';

afterEach(cleanup);

const TONES: BigDigitTone[] = ['normal', 'accent', 'quiet'];

describe.each(TONES)('BigDigit, тон %s', tone => {
  it('показывает значение', () => {
    render(<BigDigit value="14" tone={tone} />);

    expect(screen.getByText('14')).toBeTruthy();
  });

  it('на тёмном получает отдельный класс', () => {
    const { container: light } = render(<BigDigit value="14" tone={tone} />);
    const lightClass = screen.getByText('14').className;
    cleanup();

    render(<BigDigit value="14" tone={tone} onDark />);
    const darkClass = screen.getByText('14').className;

    expect(darkClass).not.toBe(lightClass);
    expect(light).toBeTruthy();
  });
});

describe('BigDigit, единица измерения', () => {
  it('не рисует единицу, если она не передана', () => {
    render(<BigDigit value="14" />);

    expect(screen.queryByText('битов')).toBeNull();
  });

  it('рисует единицу рядом со значением', () => {
    render(<BigDigit value="14" unit="битов" />);

    expect(screen.getByText('битов')).toBeTruthy();
  });

  it('единица получает свой кегль, масштабированный от кегля цифры', () => {
    render(<BigDigit value="14" unit="битов" size={50} />);

    const unitEl = screen.getByText('битов') as HTMLElement;
    expect(unitEl.style.fontSize).toBe('16px');
  });

  it('кегль единицы не опускается ниже 10px на маленьких размерах', () => {
    render(<BigDigit value="14" unit="битов" size={24} />);

    const unitEl = screen.getByText('битов') as HTMLElement;
    expect(unitEl.style.fontSize).toBe('10px');
  });
});

describe('BigDigit, доп. пропсы', () => {
  it('не кликабелен — кнопки не рендерит', () => {
    render(<BigDigit value="14" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('кегль цифры передаётся инлайн-стилем', () => {
    render(<BigDigit value="14" size={48} />);

    const el = screen.getByText('14') as HTMLElement;
    expect(el.style.fontSize).toBe('48px');
  });

  it('кегль цифры по умолчанию — 34px', () => {
    render(<BigDigit value="14" />);

    const el = screen.getByText('14') as HTMLElement;
    expect(el.style.fontSize).toBe('34px');
  });
});
