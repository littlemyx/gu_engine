import React from 'react';

import styles from '../panels/panels.module.css';

/** Ничего не выделено — состояние из макета 4i. */
const EmptyInspector = () => (
  <div className={styles.placeholder}>Ничего не выделено. Выберите узел в иерархии или объект на чертеже.</div>
);

export default EmptyInspector;
