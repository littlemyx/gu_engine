/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Waveform, { type WaveformVariant } from './Waveform';

afterEach(cleanup);

const VARIANTS: WaveformVariant[] = ['active', 'muted'];

describe.each(VARIANTS)('Waveform, вариант %s', variant => {
  it('рисует два слоя волны и скрыта от скринридера', () => {
    const { container } = render(<Waveform variant={variant} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.children.length).toBe(2);
  });
});

describe('Waveform, варианты дают разный класс', () => {
  it('active и muted не совпадают по className', () => {
    const { container: active } = render(<Waveform variant="active" />);
    const activeClass = active.firstElementChild?.className ?? '';
    cleanup();

    const { container: muted } = render(<Waveform variant="muted" />);
    expect(muted.firstElementChild?.className).not.toBe(activeClass);
  });
});

describe('Waveform, вариант по умолчанию', () => {
  it('без пропа ведёт себя как active', () => {
    const { container: withDefault } = render(<Waveform />);
    const defaultClass = withDefault.firstElementChild?.className ?? '';
    cleanup();

    const { container: explicit } = render(<Waveform variant="active" />);
    expect(explicit.firstElementChild?.className).toBe(defaultClass);
  });
});
