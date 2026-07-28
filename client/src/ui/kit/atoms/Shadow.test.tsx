/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Shadow, { type ShadowSize } from './Shadow';

afterEach(cleanup);

const SIZES: ShadowSize[] = ['sm', 'md', 'lg'];

describe.each(SIZES)('Shadow, размер %s', size => {
  it('без children показывает плашку с именем токена', () => {
    render(<Shadow size={size} />);
    expect(screen.getByText(`--shadow-${size}`)).toBeTruthy();
  });

  it('с children показывает содержимое, а не плашку', () => {
    render(
      <Shadow size={size}>
        <span>карточка</span>
      </Shadow>,
    );
    expect(screen.getByText('карточка')).toBeTruthy();
    expect(screen.queryByText(`--shadow-${size}`)).toBeNull();
  });
});

describe('Shadow по умолчанию', () => {
  it('без явного size использует md', () => {
    render(<Shadow />);
    expect(screen.getByText('--shadow-md')).toBeTruthy();
  });
});
