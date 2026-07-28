import React from 'react';

import { collectGallery } from '@/ui/kit/collectGallery';

import styles from './kitGallery.module.css';

const TIER_RU: Record<string, string> = {
  atoms: 'Атомы',
  molecules: 'Молекулы',
};

/**
 * Витрина кита «Industry»: показывает каждый портированный компонент во всех
 * вариантах и состояниях. Служит и сверкой с макетом, и живой документацией —
 * ничего, кроме сбора случаев, здесь не происходит.
 */
const KitGallery = () => {
  const sections = collectGallery();
  const tiers = [...new Set(sections.map(s => s.tier))];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Кит «Industry»</h1>
      <p className={styles.lead}>
        Портированные компоненты дизайн-кита. Каждый случай — вариант или состояние из макета. Всего компонентов:{' '}
        {sections.length}.
      </p>

      {sections.length === 0 && <p className={styles.empty}>Пока ничего не портировано.</p>}

      {tiers.map(tier => (
        <section key={tier}>
          <h2 className={styles.tier}>{TIER_RU[tier] ?? tier}</h2>
          {sections
            .filter(s => s.tier === tier)
            .map(section => (
              <div key={section.title} className={styles.section}>
                <h3 className={styles.name}>{section.title}</h3>
                <div className={styles.cases}>
                  {section.cases.map((c, i) => (
                    <div
                      key={`${section.title}-${c.title}-${i}`}
                      className={[styles.case, c.dark ? styles.caseDark : ''].filter(Boolean).join(' ')}
                    >
                      <div className={styles.caseTitle}>{c.title}</div>
                      {c.node}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
};

export default KitGallery;
