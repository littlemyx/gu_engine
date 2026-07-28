/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Playhead, { type PlayheadTone } from './Playhead';

afterEach(cleanup);

const TONES: PlayheadTone[] = ['accent', 'contrast'];

describe.each(TONES)('Playhead, тон %s', tone => {
  it('рисует риску нужной высоты и скрыта от скринридера', () => {
    const { container } = render(<Playhead tone={tone} height={64} />);
    const root = container.firstElementChild as HTMLElement;
    const line = root.firstElementChild as HTMLElement;

    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(line.style.height).toBe('64px');
  });
});

describe('Playhead, позиция', () => {
  it('прокидывает position в left, по умолчанию 40%', () => {
    const { container } = render(<Playhead />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.left).toBe('40%');
  });

  it('зажимает position в диапазон 0–100', () => {
    const { container: below } = render(<Playhead position={-20} />);
    expect((below.firstElementChild as HTMLElement).style.left).toBe('0%');
    cleanup();

    const { container: above } = render(<Playhead position={140} />);
    expect((above.firstElementChild as HTMLElement).style.left).toBe('100%');
  });
});

describe('Playhead, флажок-держатель', () => {
  it('показан по умолчанию', () => {
    const { container } = render(<Playhead />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.children.length).toBe(2);
  });

  it('скрыт при withHandle={false}', () => {
    const { container } = render(<Playhead withHandle={false} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.children.length).toBe(1);
  });
});

describe('Playhead, высота по умолчанию', () => {
  it('48px', () => {
    const { container } = render(<Playhead />);
    const line = (container.firstElementChild as HTMLElement).firstElementChild as HTMLElement;

    expect(line.style.height).toBe('48px');
  });
});
