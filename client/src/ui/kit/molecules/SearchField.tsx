import React from 'react';

import Input from '../atoms/Input';

import styles from './SearchField.module.css';

export type SearchFieldState = 'обычный' | 'disabled' | 'error';

export interface SearchFieldProps {
  value?: string;
  placeholder?: string;
  state?: SearchFieldState;
  onChange?: (value: string) => void;
}

/**
 * Порт `design_ref/components/SearchField.dc.html` (molecules.json#k006, #k030).
 * Поле поиска в обёртке `role="search"`: тонкая обвязка над атомом `Input`.
 * У исходника `context` захардкожен в «на тёмном» и не объявлен как проп —
 * поле живёт только на тёмном хроме тулбара, поэтому `onDark` здесь не нужен
 * (тот же вывод, что и в `ToolbarStatus`/`ArtifactRow`).
 */
const SearchField = ({ value, placeholder = 'поиск по истории…', state = 'обычный', onChange }: SearchFieldProps) => {
  return (
    <div role="search" className={styles.root}>
      <Input
        value={value}
        placeholder={placeholder}
        onDark
        disabled={state === 'disabled'}
        error={state === 'error'}
        onChange={onChange}
      />
    </div>
  );
};

export default SearchField;
