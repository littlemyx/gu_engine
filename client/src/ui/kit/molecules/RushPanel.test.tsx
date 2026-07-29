/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import RushPanel from './RushPanel';

afterEach(cleanup);

describe('RushPanel, стриминг', () => {
  it('показывает спикера и реплику в кавычках', () => {
    render(<RushPanel speaker="Кира" text="Ты всё-таки пришёл." />);

    expect(screen.getByText('Кира')).toBeTruthy();
    expect(screen.getByText('«Ты всё-таки пришёл.»')).toBeTruthy();
  });

  it('по умолчанию показывает мигающий курсор', () => {
    const { container } = render(<RushPanel speaker="Кира" text="Ты всё-таки пришёл." />);

    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('▌');
  });
});

describe('RushPanel, реплика завершена', () => {
  it('без стрима курсор не рендерится', () => {
    const { container } = render(<RushPanel speaker="Кира" text="Ты всё-таки пришёл." streaming={false} />);

    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});

describe('RushPanel, панель не кликабельна', () => {
  it('не рендерит кнопку', () => {
    render(<RushPanel speaker="Кира" text="Ты всё-таки пришёл." />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
