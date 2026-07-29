/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import HatchFill from './HatchFill';

afterEach(cleanup);

describe('HatchFill', () => {
  it('без содержимого показывает note-заглушку', () => {
    const { getByText } = render(<HatchFill note="прозы нет" />);
    expect(getByText('прозы нет')).toBeTruthy();
  });

  it('с children note не рисует', () => {
    const { getByText, queryByText } = render(
      <HatchFill note="прозы нет">
        <span>кадр</span>
      </HatchFill>,
    );
    expect(getByText('кадр')).toBeTruthy();
    expect(queryByText('прозы нет')).toBeNull();
  });

  it('пустая note ничего не рисует', () => {
    const { container } = render(<HatchFill note="" />);
    expect(container.querySelector('span')).toBeNull();
  });

  it('на тёмном получает отдельный класс от светлого', () => {
    const { container: light } = render(<HatchFill />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<HatchFill onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });

  it('проп step идёт в custom property штриховки', () => {
    const { container } = render(<HatchFill step={20} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--hf-step')).toBe('20px');
  });

  it('дефолтный шаг штриховки зависит от context', () => {
    const { container: light } = render(<HatchFill />);
    const lightRoot = light.firstElementChild as HTMLElement;
    expect(lightRoot.style.getPropertyValue('--hf-step')).toBe('8px');
    cleanup();

    const { container: dark } = render(<HatchFill onDark />);
    const darkRoot = dark.firstElementChild as HTMLElement;
    expect(darkRoot.style.getPropertyValue('--hf-step')).toBe('14px');
  });

  it('дефолтный тон — neutral, класс не меняется без tone', () => {
    const { container: implicit } = render(<HatchFill />);
    const implicitClass = implicit.firstElementChild?.className ?? '';
    cleanup();

    const { container: explicit } = render(<HatchFill tone="neutral" />);
    const explicitClass = explicit.firstElementChild?.className ?? '';

    expect(explicitClass).toBe(implicitClass);
  });

  it('тон accent получает отдельный класс от neutral', () => {
    const { container: neutral } = render(<HatchFill tone="neutral" />);
    const neutralClass = neutral.firstElementChild?.className ?? '';
    cleanup();

    const { container: accent } = render(<HatchFill tone="accent" />);
    const accentClass = accent.firstElementChild?.className ?? '';

    expect(accentClass).not.toBe(neutralClass);
    expect(accentClass.length).toBeGreaterThan(neutralClass.length);
  });

  it('тон accent сочетается с onDark, не ломая рендер', () => {
    const { container, getByText } = render(<HatchFill tone="accent" onDark note="ещё нет" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('onDark');
    expect(getByText('ещё нет')).toBeTruthy();
  });
});
