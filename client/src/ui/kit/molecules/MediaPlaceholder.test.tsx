/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import MediaPlaceholder from './MediaPlaceholder';

afterEach(cleanup);

describe('MediaPlaceholder', () => {
  it('показывает подпись', () => {
    render(<MediaPlaceholder label="фон «пирс, закат» — заглушка" />);
    expect(screen.getByText('фон «пирс, закат» — заглушка')).toBeTruthy();
  });

  it('на светлом хроме не кликабелен: без role="button"', () => {
    render(<MediaPlaceholder label="портрет героя — заглушка" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('на тёмном хроме тоже не кликабелен', () => {
    render(<MediaPlaceholder label="звук эмбиента — заглушка" onDark />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('без onDark рендерится с классом светлого варианта', () => {
    const { container } = render(<MediaPlaceholder label="эскиз локации" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('onLight');
    expect(root.className).not.toContain('onDark');
  });

  it('с onDark рендерится с классом тёмного варианта', () => {
    const { container } = render(<MediaPlaceholder label="эскиз локации" onDark />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('onDark');
  });
});
