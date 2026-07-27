import React, { useState } from 'react';

import { validateBrief } from '@/narrative/validateBrief';
import ActionButton from '@/ui/ActionButton';
import { pluralize } from '@/ui/plural';

import Modal from './Modal';

import styles from './modals.module.css';

import type { Brief } from '@/narrative/types';

export interface ImportBriefModalProps {
  /** Импорт затирает бриф целиком — предупреждаем, если он не пустой. */
  hasStory: boolean;
  onImport: (brief: Brief) => void;
  onClose: () => void;
}

type Parsed = { brief: Brief; problems: string[] } | { error: string } | null;

function parseBrief(raw: string): Parsed {
  if (raw.trim().length === 0) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (e) {
    return { error: `не JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!value || typeof value !== 'object') return { error: 'ожидался объект брифа' };
  const brief = value as Brief;
  if (!Array.isArray(brief.loveInterests)) return { error: 'в брифе нет массива loveInterests' };

  // validateBrief написан под бриф из стора и ходит по вложенным полям без
  // проверок: чужой JSON с отсутствующей scale роняет его — а вместе с ним
  // и весь шелл. Импорт обязан оставаться неломающимся входом.
  let issues;
  try {
    issues = validateBrief(brief);
  } catch (e) {
    return { error: `структура брифа неполная: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { brief, problems: issues.filter(i => i.severity === 'error').map(i => i.message) };
}

/** Импорт брифа файлом или вставкой JSON. Разбор — до применения. */
const ImportBriefModal = ({ hasStory, onImport, onClose }: ImportBriefModalProps) => {
  const [raw, setRaw] = useState('');
  const parsed = parseBrief(raw);
  const ready = parsed != null && 'brief' in parsed;

  const readFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  return (
    <Modal
      title="Импорт брифа"
      subtitle="JSON брифа: файлом или вставкой. Разбор и проверка — до применения."
      wide
      onClose={onClose}
      footer={
        <>
          <ActionButton onLight label="Отмена" kind="ghost" onClick={onClose} />
          <ActionButton
            onLight
            label="Импортировать"
            disabled={!ready}
            reason={parsed == null ? 'вставьте JSON или выберите файл' : 'JSON не разобран'}
            onClick={() => ready && onImport(parsed.brief)}
          />
        </>
      }
    >
      <input type="file" accept="application/json,.json" onChange={e => readFile(e.target.files?.[0])} />

      <label className={styles.field}>
        <span className={styles.label}>или вставьте JSON</span>
        <textarea
          className={styles.textarea}
          value={raw}
          onChange={event => setRaw(event.target.value)}
          spellCheck={false}
          placeholder='{"version":"0.1","loveInterests":[…]}'
        />
      </label>

      {parsed != null && 'error' in parsed && <div className={styles.warning}>✗ {parsed.error}</div>}

      {ready && (
        <>
          <div>
            Разобрано: {pluralize(parsed.brief.loveInterests.length, 'персонаж', 'персонажа', 'персонажей')}, жанр{' '}
            <span className={styles.mono}>{parsed.brief.genre ?? '—'}</span>.
          </div>
          {parsed.problems.length > 0 && (
            <div className={styles.list}>
              {parsed.problems.map(problem => (
                <div key={problem} className={styles.quote}>
                  ▨ {problem}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {hasStory && (
        <div className={styles.warning}>
          Текущий бриф будет заменён. Сгенерированная история останется, но перестанет ему соответствовать — понадобится
          перегенерация.
        </div>
      )}
    </Modal>
  );
};

export default ImportBriefModal;
