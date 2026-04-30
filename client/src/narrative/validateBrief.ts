import type { Brief, LoveInterestCard } from './types';
import { ARCHETYPES } from './archetypes';

export type BriefIssue = {
  severity: 'error' | 'warning';
  path: string;
  message: string;
};

/**
 * Базовая валидация брифа перед запуском пайплайна генерации.
 * Проверяет структурные инварианты, не качество контента.
 */
export function validateBrief(brief: Brief): BriefIssue[] {
  const issues: BriefIssue[] = [];

  if (brief.scale.acts < 1) {
    issues.push({
      severity: 'error',
      path: 'scale.acts',
      message: 'acts должно быть >= 1',
    });
  }
  if (brief.scale.commonRouteShare < 0 || brief.scale.commonRouteShare > 1) {
    issues.push({
      severity: 'error',
      path: 'scale.commonRouteShare',
      message: 'commonRouteShare должно быть в [0, 1]',
    });
  }
  if (brief.world.tone.intensity < 0 || brief.world.tone.intensity > 1) {
    issues.push({
      severity: 'error',
      path: 'world.tone.intensity',
      message: 'intensity должно быть в [0, 1]',
    });
  }
  if (brief.loveInterests.length < 1) {
    issues.push({
      severity: 'error',
      path: 'loveInterests',
      message: 'нужен хотя бы один LI',
    });
  }
  if (brief.loveInterests.length > 5) {
    issues.push({
      severity: 'warning',
      path: 'loveInterests',
      message:
        '> 5 LI делает каст перегруженным; common route не справится со всеми introduction-ами в комфортный темп',
    });
  }

  const seenIds = new Set<string>();
  brief.loveInterests.forEach((li, idx) => {
    if (seenIds.has(li.id)) {
      issues.push({
        severity: 'error',
        path: `loveInterests[${idx}].id`,
        message: `повторяющийся id: ${li.id}`,
      });
    }
    seenIds.add(li.id);
    issues.push(...validateLoveInterest(li, idx));
  });

  return issues;
}

function validateLoveInterest(li: LoveInterestCard, idx: number): BriefIssue[] {
  const issues: BriefIssue[] = [];
  const archetype = ARCHETYPES[li.archetype];

  if (!archetype) {
    issues.push({
      severity: 'error',
      path: `loveInterests[${idx}].archetype`,
      message: `неизвестный архетип: ${li.archetype}`,
    });
    return issues;
  }

  // Проверка archetype_specifics против schema архетипа
  const schema = archetype.archetypeSpecificsSchema;
  if (schema) {
    const specifics = li.archetypeSpecifics ?? {};
    for (const [field, declaration] of Object.entries(schema)) {
      if (declaration.required && !specifics[field]) {
        issues.push({
          severity: 'error',
          path: `loveInterests[${idx}].archetypeSpecifics.${field}`,
          message: `архетип "${li.archetype}" требует поле "${field}" (например: ${declaration.examples
            .slice(0, 2)
            .join(', ')})`,
        });
      }
    }
  } else if (li.archetypeSpecifics && Object.keys(li.archetypeSpecifics).length > 0) {
    issues.push({
      severity: 'warning',
      path: `loveInterests[${idx}].archetypeSpecifics`,
      message: `архетип "${li.archetype}" не использует archetype_specifics — поле будет проигнорировано`,
    });
  }

  return issues;
}
