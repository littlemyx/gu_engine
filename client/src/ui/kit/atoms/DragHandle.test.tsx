/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DragHandle from './DragHandle';

afterEach(cleanup);

describe('DragHandle', () => {
  it('показывает глиф хэндла', () => {
    const { container } = render(<DragHandle />);
    const node = container.firstElementChild as HTMLElement;

    expect(node.textContent).toBe('⠿');
  });

  it('фокусируется с клавиатуры (tabIndex=0)', () => {
    const { container } = render(<DragHandle />);
    const node = container.firstElementChild as HTMLElement;

    expect(node.getAttribute('tabindex')).toBe('0');
    node.focus();
    expect(document.activeElement).toBe(node);
  });

  it('рендерит span, а не button — своей drag-логики не несёт', () => {
    const { container } = render(<DragHandle />);
    const node = container.firstElementChild as HTMLElement;

    expect(node.tagName).toBe('SPAN');
  });
});

describe('DragHandle, размер', () => {
  it('по умолчанию 9px', () => {
    const { container } = render(<DragHandle />);
    const node = container.firstElementChild as HTMLElement;

    expect(node.style.fontSize).toBe('9px');
  });

  it('переопределяется пропом size', () => {
    const { container } = render(<DragHandle size={14} />);
    const node = container.firstElementChild as HTMLElement;

    expect(node.style.fontSize).toBe('14px');
  });
});

describe('DragHandle на тёмном', () => {
  it('получает отдельный класс, а не тот же, что на светлом', () => {
    const { container: light } = render(<DragHandle />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<DragHandle onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});
