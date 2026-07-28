/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import InspectorHeader from './InspectorHeader';

afterEach(cleanup);

describe('InspectorHeader', () => {
  it('показывает кикер и заголовок', () => {
    render(<InspectorHeader kicker="ИНСПЕКТОР · beat_prose / b5" title="Проза бита Б5 «Ссора»" />);

    expect(screen.getByText('ИНСПЕКТОР · beat_prose / b5')).toBeTruthy();
    expect(screen.getByText('Проза бита Б5 «Ссора»')).toBeTruthy();
  });

  it('заголовок остаётся в исходном регистре, а не капслочится', () => {
    render(<InspectorHeader kicker="k" title="Проза бита" />);
    const heading = screen.getByText('Проза бита');
    expect(heading.className).not.toContain('uppercase');
  });

  it('заголовок держит размер 15px из макета', () => {
    render(<InspectorHeader kicker="k" title="Проза бита" />);
    const heading = screen.getByText('Проза бита') as HTMLElement;
    expect(heading.style.fontSize).toBe('15px');
  });

  it('кикер держит размер 8.5px из макета', () => {
    render(<InspectorHeader kicker="ИНСПЕКТОР · b5" title="t" />);
    const kicker = screen.getByText('ИНСПЕКТОР · b5') as HTMLElement;
    expect(kicker.style.fontSize).toBe('8.5px');
  });

  it('на тёмном хроме кикер и заголовок получают отдельные от светлых классы', () => {
    const { container: light } = render(<InspectorHeader kicker="k" title="t" />);
    const lightKickerClass = screen.getByText('k').className;
    const lightTitleClass = screen.getByText('t').className;
    cleanup();

    const { container: dark } = render(<InspectorHeader kicker="k" title="t" onDark />);
    const darkKickerClass = screen.getByText('k').className;
    const darkTitleClass = screen.getByText('t').className;

    expect(darkKickerClass).not.toBe(lightKickerClass);
    expect(darkTitleClass).not.toBe(lightTitleClass);
    expect(light).toBeTruthy();
    expect(dark).toBeTruthy();
  });
});
