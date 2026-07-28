/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CastingBadge, { type CastingBadgeKind } from './CastingBadge';

afterEach(cleanup);

const KINDS: CastingBadgeKind[] = ['руками', 'префаб', 'сгенерировать'];

describe.each(KINDS)('CastingBadge, вид %s', kind => {
  it('показывает дефолтную подпись для вида', () => {
    render(<CastingBadge kind={kind} />);

    const expected = { руками: 'руками', префаб: 'префаб v2 · linked', сгенерировать: 'сгенерировать' }[kind];
    expect(screen.getByText(expected)).toBeTruthy();
  });
});

describe('CastingBadge, подпись', () => {
  it('кастомный label перекрывает дефолтную подпись вида', () => {
    render(<CastingBadge kind="префаб" label="Ирис v3" />);

    expect(screen.getByText('Ирис v3')).toBeTruthy();
    expect(screen.queryByText('префаб v2 · linked')).toBeNull();
  });
});

describe('CastingBadge, интерактивность', () => {
  it('без onClick не рендерит кнопку', () => {
    render(<CastingBadge kind="префаб" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рендерит кнопку и вызывает колбэк по клику', () => {
    const onClick = vi.fn();
    render(<CastingBadge kind="префаб" onClick={onClick} />);

    const button = screen.getByRole('button', { name: /префаб v2 · linked/ });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('CastingBadge, светлое/тёмное', () => {
  it('на тёмном хроме кнопка получает отдельный класс', () => {
    const onClick = vi.fn();
    const { container: light } = render(<CastingBadge kind="префаб" onClick={onClick} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<CastingBadge kind="префаб" onClick={onClick} onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});
