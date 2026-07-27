import React from 'react';

import { isSameSelection, useStudioStore } from '../studioStore';

import styles from './viewport.module.css';

import type { ScriptBlock, ScriptModel } from '../derive/scriptModel';
import type { DialogueVariantBracket } from '@/narrative/types';

const BRACKETS: Array<{ id: DialogueVariantBracket; label: string }> = [
  { id: 'positive', label: 'тепло' },
  { id: 'neutral', label: 'нейтрально' },
  { id: 'negative', label: 'холодно' },
];

const STATE_NOTE: Record<ScriptBlock['state'], string> = {
  done: '',
  empty: 'прозы нет',
  failed: 'проверка не пройдена',
  locked: 'заперто веткой',
};

export interface ScriptViewProps {
  model: ScriptModel;
  onBracketChange: (bracket: DialogueVariantBracket) => void;
}

/**
 * «Сценарий»: история подряд — слот за слотом. Левая колонка читается как
 * текст, правая узкая держит машинные аннотации (guard, эффекты, id сцены),
 * чтобы они не разрывали чтение.
 */
const ScriptView = ({ model, onBracketChange }: ScriptViewProps) => {
  const selection = useStudioStore(s => s.selection);
  const select = useStudioStore(s => s.select);

  return (
    <div className={styles.scriptRoot}>
      <div className={styles.viewportBar}>
        <span className={styles.viewportMeta}>
          {model.withProse}/{model.total} сцен с прозой
        </span>
        <span className={styles.scriptBrackets}>
          ступень:
          {BRACKETS.map(bracket => (
            <button
              key={bracket.id}
              type="button"
              className={`${styles.scriptBracket} ${model.bracket === bracket.id ? styles.scriptBracketActive : ''}`}
              onClick={() => onBracketChange(bracket.id)}
            >
              {bracket.label}
            </button>
          ))}
        </span>
      </div>

      <div className={styles.scriptScroll}>
        <div className={styles.scriptColumn}>
          {model.groups.map(group => (
            <section key={group.slot} className={styles.scriptGroup}>
              <h2 className={styles.scriptSlotHead}>{group.label}</h2>

              {group.blocks.map(block => (
                <article
                  key={block.key}
                  className={`${styles.scriptBlock} ${
                    isSameSelection(selection, block.selection) ? styles.scriptBlockSelected : ''
                  } ${block.state === 'locked' ? styles.scriptBlockDim : ''}`}
                  onClick={() => select(block.selection)}
                >
                  <div className={styles.scriptBlockHead}>
                    <span className={styles.scriptBlockTitle}>
                      {block.kind === 'beat' ? '◈ ' : '› '}
                      {block.title}
                    </span>
                    <span className={styles.scriptBlockMeta}>{block.meta}</span>
                  </div>

                  <div className={styles.scriptAnnotation}>
                    {block.guardText !== '—' && block.guardText !== '' && <div>если: {block.guardText}</div>}
                    {block.effectText !== '—' && <div className={styles.scriptEffect}>{block.effectText}</div>}
                    {STATE_NOTE[block.state] && (
                      <div className={block.state === 'failed' ? styles.scriptFail : undefined}>
                        {STATE_NOTE[block.state]}
                      </div>
                    )}
                  </div>

                  <div className={styles.scriptBody}>
                    {block.lines.length === 0 && (
                      <p className={styles.scriptEmpty}>Сцена ещё не написана — текст появится после стадии прозы.</p>
                    )}
                    {block.lines.map((line, index) => {
                      switch (line.kind) {
                        case 'node':
                          return (
                            <p key={index} className={styles.scriptNode}>
                              {line.text}
                            </p>
                          );
                        case 'narration':
                          return (
                            <p key={index} className={styles.scriptNarration}>
                              {line.text}
                            </p>
                          );
                        case 'speech':
                          return (
                            <p key={index} className={styles.scriptSpeech}>
                              <b>{line.speaker}</b>
                              {line.emotion && <span className={styles.scriptEmotion}> ({line.emotion})</span>} «
                              {line.text}»
                            </p>
                          );
                        case 'choice':
                          return (
                            <p key={index} className={styles.scriptChoice}>
                              {line.text}
                              <span className={styles.scriptChoiceNote}>{line.note}</span>
                            </p>
                          );
                        default:
                          return null;
                      }
                    })}
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScriptView;
