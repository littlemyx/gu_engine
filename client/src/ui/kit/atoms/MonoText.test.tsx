/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import MonoText from './MonoText';

afterEach(cleanup);

describe('MonoText', () => {
  it('показывает текст', () => {
    render(<MonoText text="seed:8f4a·v3" />);

    expect(screen.getByText('seed:8f4a·v3')).toBeTruthy();
  });

  it('на тёмном получает отдельный класс', () => {
    const { container: light } = render(<MonoText text="seed:8f4a·v3" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<MonoText text="seed:8f4a·v3" onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });

  it('muted получает отдельный класс', () => {
    const { container: regular } = render(<MonoText text="seed:8f4a·v3" />);
    const regularClass = regular.firstElementChild?.className ?? '';
    cleanup();

    const { container: mutedRender } = render(<MonoText text="seed:8f4a·v3" muted />);
    expect(mutedRender.firstElementChild?.className).not.toBe(regularClass);
  });

  it('highlight получает отдельный класс', () => {
    const { container: plain } = render(<MonoText text="seed:8f4a·v3" />);
    const plainClass = plain.firstElementChild?.className ?? '';
    cleanup();

    const { container: highlighted } = render(<MonoText text="seed:8f4a·v3" highlight />);
    expect(highlighted.firstElementChild?.className).not.toBe(plainClass);
  });

  it('size управляет инлайновым font-size', () => {
    render(<MonoText text="seed:8f4a·v3" size={11} />);

    const node = screen.getByText('seed:8f4a·v3') as HTMLElement;
    expect(node.style.fontSize).toBe('11px');
  });

  it('по умолчанию размер 10px', () => {
    render(<MonoText text="seed:8f4a·v3" />);

    const node = screen.getByText('seed:8f4a·v3') as HTMLElement;
    expect(node.style.fontSize).toBe('10px');
  });
});
