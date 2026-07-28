import React from 'react';

import styles from './Input.module.css';

export interface InputProps {
  /** Начальное содержимое поля; компонент неконтролируемый, как в макете. */
  value?: string;
  placeholder?: string;
  onDark?: boolean;
  multiline?: boolean;
  mono?: boolean;
  disabled?: boolean;
  error?: boolean;
  onChange?: (value: string) => void;
}

/**
 * Порт `design_ref/components/Input.dc.html` (atoms.json#Input).
 * Текстовое поле в hairline-рамке: однострочное и многострочное, светлое и
 * тёмное, моноширинное — поверх обычных hover/focus несёт disabled и error.
 */
const Input = ({
  value,
  placeholder,
  onDark = false,
  multiline = false,
  mono = false,
  disabled = false,
  error = false,
  onChange,
}: InputProps) => {
  const className = [
    styles.input,
    multiline ? styles.multiline : '',
    mono ? styles.mono : '',
    error ? styles.error : '',
    onDark ? styles.onDark : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  };

  if (multiline) {
    return (
      <textarea
        className={className}
        defaultValue={value}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        onChange={handleChange}
      />
    );
  }

  return (
    <input
      type="text"
      className={className}
      defaultValue={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={handleChange}
    />
  );
};

export default Input;
