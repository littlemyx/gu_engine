/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import LockfileDiffCard from './LockfileDiffCard';

afterEach(cleanup);

describe('LockfileDiffCard', () => {
  it('показывает заголовок, мету и сводку', () => {
    render(
      <LockfileDiffCard
        title="Что изменилось с v2 · diff lockfile-ов"
        meta="12 отпечатков разошлись"
        summary="проза: Б5 «Ссора» + 9 юнитов · концовки: обе"
      />,
    );

    expect(screen.getByText('Что изменилось с v2 · diff lockfile-ов')).toBeTruthy();
    expect(screen.getByText('12 отпечатков разошлись')).toBeTruthy();
    expect(screen.getByText('проза: Б5 «Ссора» + 9 юнитов · концовки: обе')).toBeTruthy();
  });

  it('без note хвост сводки не рисуется', () => {
    render(<LockfileDiffCard title="Заголовок" meta="мета" summary="сводка" />);

    expect(screen.queryByText('медиа: без изменений')).toBeNull();
    expect(screen.queryByText((_, node) => node?.textContent === ' · ')).toBeNull();
  });

  it('с note дописывает хвост после « · »', () => {
    render(<LockfileDiffCard title="Заголовок" meta="мета" summary="сводка" note="медиа: без изменений" />);

    expect(screen.getByText('медиа: без изменений')).toBeTruthy();
  });

  it('рендерится нерактивным контейнером (не кнопкой)', () => {
    render(<LockfileDiffCard title="Заголовок" meta="мета" summary="сводка" note="хвост" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
