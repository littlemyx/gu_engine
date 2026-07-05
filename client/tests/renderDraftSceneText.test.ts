import { describe, it, expect } from 'vitest';
import { renderDraftSceneText, speakerNameResolver } from '../src/narrative/convertToGameProject';
import type { Brief, DraftDialogueLine } from '../src/narrative/types';

const brief = {
  loveInterests: [{ id: 'kira', name: 'Кира' }],
} as unknown as Brief;

const dialogue: DraftDialogueLine[] = [{ speaker: 'kira', line: 'Что тебе нужно? Я занята.' }];

describe('renderDraftSceneText — согласование имени говорящего', () => {
  it('подставляет отображаемое имя вместо id персонажа в подписи реплики', () => {
    const label = renderDraftSceneText(
      'Ты подходишь к стеллажам, где стоит Кира.',
      dialogue,
      speakerNameResolver(brief),
    );
    // Подпись реплики использует «Кира», а не id «kira» — согласованно с прозой.
    expect(label).toContain('Кира: Что тебе нужно? Я занята.');
    expect(label).not.toContain('kira:');
  });

  it('отделяет наррацию от реплик пустой строкой (\\n\\n)', () => {
    const label = renderDraftSceneText('Описание сцены.', dialogue, speakerNameResolver(brief));
    expect(label).toBe('Описание сцены.\n\nКира: Что тебе нужно? Я занята.');
  });

  it('без резолвера оставляет speaker как есть (обратная совместимость)', () => {
    expect(renderDraftSceneText('', dialogue)).toBe('kira: Что тебе нужно? Я занята.');
  });

  it('неизвестный id (не из каста) проходит без изменений', () => {
    const label = renderDraftSceneText('', [{ speaker: 'narrator', line: '…' }], speakerNameResolver(brief));
    expect(label).toBe('narrator: …');
  });
});
