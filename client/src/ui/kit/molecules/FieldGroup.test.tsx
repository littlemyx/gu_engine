/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import FieldGroup, { type FieldGroupState } from './FieldGroup';

afterEach(cleanup);

const STATES: FieldGroupState[] = ['ok', 'error'];

describe.each(STATES)('FieldGroup, состояние %s', state => {
  it('показывает заголовок секции', () => {
    render(<FieldGroup title="Жанр и формат" meta="genre · format · endingsProfile" state={state} />);
    expect(screen.getByText('Жанр и формат')).toBeTruthy();
  });
});

describe('FieldGroup, состояние «обычная»', () => {
  it('показывает обычную мету', () => {
    render(<FieldGroup title="Жанр и формат" meta="genre · format · endingsProfile" state="ok" />);
    expect(screen.getByText('genre · format · endingsProfile')).toBeTruthy();
  });

  it('не показывает errorMeta', () => {
    render(
      <FieldGroup title="Жанр и формат" meta="genre · format · endingsProfile" errorMeta="✗ 0 персонажей" state="ok" />,
    );
    expect(screen.queryByText('✗ 0 персонажей')).toBeNull();
  });
});

describe('FieldGroup, состояние «ошибка»', () => {
  it('показывает errorMeta вместо обычной меты', () => {
    render(
      <FieldGroup title="Персонажи" meta="genre · format · endingsProfile" errorMeta="✗ 0 персонажей" state="error" />,
    );
    expect(screen.getByText('✗ 0 персонажей')).toBeTruthy();
    expect(screen.queryByText('genre · format · endingsProfile')).toBeNull();
  });

  it('падает обратно на meta, если errorMeta не задан', () => {
    render(<FieldGroup title="Персонажи" meta="genre · format · endingsProfile" state="error" />);
    expect(screen.getByText('genre · format · endingsProfile')).toBeTruthy();
  });
});

describe('FieldGroup, содержимое', () => {
  it('рендерит переданные поля секции', () => {
    render(
      <FieldGroup title="Жанр и формат" meta="genre · format · endingsProfile">
        <p>поле жанра</p>
      </FieldGroup>,
    );
    expect(screen.getByText('поле жанра')).toBeTruthy();
  });

  it('не падает без children', () => {
    render(<FieldGroup title="Жанр и формат" meta="genre · format · endingsProfile" />);
    expect(screen.getByText('Жанр и формат')).toBeTruthy();
  });
});
