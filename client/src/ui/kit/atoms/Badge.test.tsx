/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Badge, { type BadgeTone } from './Badge';

import styles from './Badge.module.css';

afterEach(cleanup);

const TONES: BadgeTone[] = ['neutral', 'accent', 'error'];

describe.each(TONES)('Badge, тон %s', tone => {
  it('показывает подпись', () => {
    render(<Badge label="authored" tone={tone} />);

    expect(screen.getByText('authored')).toBeTruthy();
  });

  it('на тёмном получает отдельный класс', () => {
    const { container: light } = render(<Badge label="authored" tone={tone} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Badge label="authored" tone={tone} onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});

describe('Badge, глиф', () => {
  it('рисует глиф скрытым от скринридера, когда он задан', () => {
    render(<Badge label="authored" glyph="✎" />);

    const glyph = screen.getByText('✎');
    expect(glyph.getAttribute('aria-hidden')).toBe('true');
  });

  it('без глифа лишнего узла нет', () => {
    const { container } = render(<Badge label="stale" />);

    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });
});

describe('Badge, размер', () => {
  it('по умолчанию 9.5px', () => {
    const { container } = render(<Badge label="authored" />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.fontSize).toBe('9.5px');
  });

  it('кегль настраивается пропом size', () => {
    const { container } = render(<Badge label="authored" size={11} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.fontSize).toBe('11px');
  });
});

describe('Badge, интерактивность', () => {
  it('не рендерит кнопку — бейдж не кликабелен', () => {
    render(<Badge label="authored" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Badge, вариант', () => {
  it('по умолчанию outline — с рамкой', () => {
    const { container } = render(<Badge label="authored" />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).not.toContain(styles.plain);
  });

  it('plain снимает рамку и паддинг', () => {
    const { container } = render(<Badge label="проза ✓" tone="accent" variant="plain" />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain(styles.plain);
  });

  it('plain по-прежнему показывает подпись и глиф', () => {
    render(<Badge label="генерируется" glyph="⟳" variant="plain" />);

    expect(screen.getByText('генерируется')).toBeTruthy();
    expect(screen.getByText('⟳').getAttribute('aria-hidden')).toBe('true');
  });
});
