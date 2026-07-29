/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import CriticVerdict from './CriticVerdict';

afterEach(cleanup);

describe('CriticVerdict', () => {
  it('показывает заголовок и цитату в кавычках-ёлочках', () => {
    render(<CriticVerdict title="попытка 2 · критик отверг №1:" quote="обращение на вы — брифу противоречит" />);
    expect(screen.getByText('попытка 2 · критик отверг №1:')).toBeTruthy();
    expect(screen.getByText('«обращение на вы — брифу противоречит»')).toBeTruthy();
  });

  it('на тёмном хроме получает другие классы, чем на светлом', () => {
    const { container: light } = render(<CriticVerdict title="заголовок" quote="причина" />);
    const lightSpans = Array.from(light.querySelectorAll('span')).map(el => el.className);
    cleanup();

    const { container: dark } = render(<CriticVerdict title="заголовок" quote="причина" onDark />);
    const darkSpans = Array.from(dark.querySelectorAll('span')).map(el => el.className);

    expect(darkSpans).not.toEqual(lightSpans);
  });

  it('по умолчанию — на светлом хроме (onDark=false)', () => {
    const { container: byDefault } = render(<CriticVerdict title="a" quote="b" />);
    const defaultSpans = Array.from(byDefault.querySelectorAll('span')).map(el => el.className);
    cleanup();

    const { container: explicitLight } = render(<CriticVerdict title="a" quote="b" onDark={false} />);
    const explicitSpans = Array.from(explicitLight.querySelectorAll('span')).map(el => el.className);

    expect(defaultSpans).toEqual(explicitSpans);
  });

  it('не кликабелен — кнопок в разметке нет', () => {
    const { container } = render(<CriticVerdict title="a" quote="b" />);
    expect(container.querySelector('button')).toBeNull();
  });
});
