import React from 'react';

import MonoText from '../atoms/MonoText';

import styles from './CriticVerdict.module.css';

export interface CriticVerdictProps {
  /** Что критик разбирал: номер попытки, что отверг. */
  title: string;
  /** Причина отказа — печатается в кавычках-ёлочках. */
  quote: string;
  onDark?: boolean;
}

/**
 * Порт `design_ref/components/CriticVerdict.dc.html` (molecules.json#k054).
 * Вердикт критика над отвергнутой попыткой генерации: заголовок и причина
 * цитатой — две строки одинаково приглушённого моноширинного текста.
 */
const CriticVerdict = ({ title, quote, onDark = false }: CriticVerdictProps) => {
  return (
    <div className={styles.root}>
      <MonoText text={title} onDark={onDark} muted size={10} />
      <br />
      <MonoText text={`«${quote}»`} onDark={onDark} muted size={10} />
    </div>
  );
};

export default CriticVerdict;
