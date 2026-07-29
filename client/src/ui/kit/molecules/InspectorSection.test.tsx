/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import InspectorSection from './InspectorSection';

afterEach(cleanup);

describe('InspectorSection, контент', () => {
  it('показывает заголовок и тело', () => {
    render(<InspectorSection title="Готовность · 6/6" body="План генерируется поэтапно." />);
    expect(screen.getByText('Готовность · 6/6')).toBeTruthy();
    expect(screen.getByText('План генерируется поэтапно.')).toBeTruthy();
  });

  it('children перекрывает body', () => {
    render(
      <InspectorSection title="Готовность · 6/6" body="скрытый текст">
        <span>кастомное содержимое</span>
      </InspectorSection>,
    );
    expect(screen.getByText('кастомное содержимое')).toBeTruthy();
    expect(screen.queryByText('скрытый текст')).toBeNull();
  });
});

describe('InspectorSection, раскрытие', () => {
  it('развёрнуто по умолчанию — стрелка вниз, тело видно', () => {
    render(<InspectorSection title="Секция" body="содержимое" />);
    expect(screen.getByText('▾')).toBeTruthy();
    expect(screen.getByText('содержимое')).toBeTruthy();
  });

  it('open=false — стрелка вправо, тело не рисуется', () => {
    render(<InspectorSection title="Секция" body="содержимое" open={false} />);
    expect(screen.getByText('▸')).toBeTruthy();
    expect(screen.queryByText('содержимое')).toBeNull();
  });
});

describe('InspectorSection, интерактивность', () => {
  it('без onToggle заголовок немой (не кнопка)', () => {
    render(<InspectorSection title="Секция" body="содержимое" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onToggle заголовок — кнопка, вызывает колбэк с противоположным open, ставит aria-expanded', () => {
    let calledWith: boolean | null = null;
    render(
      <InspectorSection
        title="Секция"
        body="содержимое"
        open
        onToggle={next => {
          calledWith = next;
        }}
      />,
    );
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(calledWith).toBe(false);
  });
});

describe('InspectorSection, светлый/тёмный контекст', () => {
  it('по умолчанию не onDark', () => {
    const { container } = render(<InspectorSection title="Секция" body="содержимое" />);
    expect(container.firstElementChild?.className).not.toContain('onDark');
  });

  it('onDark меняет класс корня', () => {
    const { container } = render(<InspectorSection title="Секция" body="содержимое" onDark />);
    expect(container.firstElementChild?.className).toContain('onDark');
  });
});
