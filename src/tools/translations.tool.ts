import { Injectable, Logger } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { WeblateApiService, type WritableTranslationState } from '../services';
import { type Unit } from '../client';

@Injectable()
export class WeblateTranslationsTool {
  private readonly logger = new Logger(WeblateTranslationsTool.name);

  constructor(private weblateApiService: WeblateApiService) {}

  @Tool({
    name: 'searchStringInProject',
    description:
      'Search for translations containing specific text in a project',
    parameters: z.object({
      projectSlug: z.string().describe('The slug of the project to search in'),
      value: z.string().describe('The text to search for'),
      searchIn: z
        .enum(['source', 'target', 'both'])
        .optional()
        .describe('Where to search: source text, target translation, or both')
        .default('both'),
    }),
  })
  async searchStringInProject({
    projectSlug,
    value,
    searchIn = 'both',
  }: {
    projectSlug: string;
    value: string;
    searchIn?: 'source' | 'target' | 'both';
  }) {
    try {
      const results = await this.weblateApiService.searchStringInProject(
        projectSlug,
        value,
        searchIn,
      );

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No translations found containing "${value}" in project "${projectSlug}"`,
            },
          ],
        };
      }

      const formattedResults = results
        .slice(0, 10)
        .map((translation) => this.formatTranslationResult(translation))
        .join('\n\n');
      const totalText =
        results.length > 10
          ? `\n\n*Showing first 10 of ${results.length} results*`
          : '';

      return {
        content: [
          {
            type: 'text',
            text: `Found ${results.length} translations containing "${value}" in project "${projectSlug}":\n\n${formattedResults}${totalText}`,
          },
        ],
      };
    } catch (error) {
      this.logger.error(
        `Failed to search for "${value}" in ${projectSlug}`,
        error,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Error searching for "${value}" in project "${projectSlug}": ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  @Tool({
    name: 'getTranslationForKey',
    description: 'Get translation value for a specific key in a project',
    parameters: z.object({
      projectSlug: z.string().describe('The slug of the project'),
      componentSlug: z.string().describe('The slug of the component'),
      languageCode: z.string().describe('The language code (e.g., en, es, fr)'),
      key: z.string().describe('The translation key to look up'),
    }),
  })
  async getTranslationForKey({
    projectSlug,
    componentSlug,
    languageCode,
    key,
  }: {
    projectSlug: string;
    componentSlug: string;
    languageCode: string;
    key: string;
  }) {
    try {
      const translation = await this.weblateApiService.getTranslationByKey(
        projectSlug,
        componentSlug,
        languageCode,
        key,
      );

      if (!translation) {
        return {
          content: [
            {
              type: 'text',
              text: `Translation not found for key "${key}" in ${projectSlug}/${componentSlug}/${languageCode}`,
            },
          ],
        };
      }

      let displayTranslation = translation;
      try {
        displayTranslation = await this.weblateApiService.getUnitDetails(
          String(translation.id),
        );
      } catch (error) {
        this.logger.warn(
          `Не удалось разрешить effective labels для ключа ${key}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: this.formatTranslationResult(displayTranslation),
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to get translation for key ${key}`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error getting translation for key "${key}": ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  @Tool({
    name: 'writeTranslation',
    description: 'Update or write a translation value for a specific key',
    parameters: z.object({
      projectSlug: z.string().describe('The slug of the project'),
      componentSlug: z.string().describe('The slug of the component'),
      languageCode: z.string().describe('The language code (e.g., en, es, fr)'),
      key: z.string().describe('The translation key to update'),
      value: z.string().describe('The new translation value'),
      markAsApproved: z
        .boolean()
        .optional()
        .describe('Whether to mark as approved (default: false)')
        .default(false),
    }),
  })
  async writeTranslation({
    projectSlug,
    componentSlug,
    languageCode,
    key,
    value,
    markAsApproved = false,
  }: {
    projectSlug: string;
    componentSlug: string;
    languageCode: string;
    key: string;
    value: string;
    markAsApproved?: boolean;
  }) {
    try {
      const updatedUnit = await this.weblateApiService.writeTranslation(
        projectSlug,
        componentSlug,
        languageCode,
        key,
        value,
        markAsApproved,
      );

      return {
        content: [
          {
            type: 'text',
            text: updatedUnit
              ? `Successfully updated translation for key "${key}"\n\n${this.formatTranslationResult(updatedUnit)}`
              : `Failed to update translation for key "${key}"`,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to write translation for key ${key}`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error writing translation for key "${key}": ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  @Tool({
    name: 'setTranslationState',
    description:
      'Изменить статус translation-unit без изменения текста. MCP автоматически перечитывает юнит после записи, проверяет числовой state и неизменность source/target и возвращает полный подтверждённый результат. Для снятия статуса Needs Editing (state=10) используй state=20 (Translated). Допустимые состояния: 0 Untranslated, 10 Needs Editing, 20 Translated, 30 Approved.',
    parameters: z.object({
      projectSlug: z.string().describe('Идентификатор проекта Weblate'),
      componentSlug: z.string().describe('Идентификатор компонента Weblate'),
      languageCode: z.string().describe('Код языка перевода, например en'),
      key: z.string().describe('Ключ translation-unit'),
      state: z
        .union([z.literal(0), z.literal(10), z.literal(20), z.literal(30)])
        .describe(
          'Новое состояние: 0 Untranslated, 10 Needs Editing, 20 Translated, 30 Approved',
        ),
    }),
  })
  async setTranslationState({
    projectSlug,
    componentSlug,
    languageCode,
    key,
    state,
  }: {
    projectSlug: string;
    componentSlug: string;
    languageCode: string;
    key: string;
    state: WritableTranslationState;
  }) {
    try {
      const result = await this.weblateApiService.setTranslationState(
        projectSlug,
        componentSlug,
        languageCode,
        key,
        state,
      );
      const verificationText = result.verified
        ? `Проверено чтением после записи: state=${result.verifiedState}; source и target не изменились.`
        : `Запись выполнена, но автоматическая проверка не подтверждена: ${result.verificationError ?? `ожидался state=${state}, получен state=${result.verifiedState ?? '(unknown)'}`}`;

      return {
        content: [
          {
            type: 'text',
            text: `Статус перевода для ключа "${key}" изменён на ${result.verifiedState ?? state} (${this.formatStateLabel(result.verifiedState ?? state)}).\n${verificationText}\n\n${this.formatTranslationResult(result.unit)}`,
          },
        ],
      };
    } catch (error) {
      this.logger.error(
        `Failed to set state for translation key ${key}`,
        error,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка изменения статуса для ключа "${key}": ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  @Tool({
    name: 'bulkWriteTranslations',
    description:
      'Update multiple translations in batch for efficient bulk operations',
    parameters: z.object({
      projectSlug: z.string().describe('The slug of the project'),
      componentSlug: z.string().describe('The slug of the component'),
      languageCode: z.string().describe('The language code (e.g., en, es, fr)'),
      translations: z
        .array(
          z.object({
            key: z.string().describe('The translation key to update'),
            value: z.string().describe('The new translation value'),
            markAsApproved: z
              .boolean()
              .optional()
              .describe('Whether to mark as approved (default: false)')
              .default(false),
          }),
        )
        .describe('Array of translations to update'),
    }),
  })
  async bulkWriteTranslations({
    projectSlug,
    componentSlug,
    languageCode,
    translations,
  }: {
    projectSlug: string;
    componentSlug: string;
    languageCode: string;
    translations: Array<{
      key: string;
      value: string;
      markAsApproved?: boolean;
    }>;
  }) {
    try {
      const result = await this.weblateApiService.bulkWriteTranslations(
        projectSlug,
        componentSlug,
        languageCode,
        translations,
      );

      let resultText = `Bulk translation update completed for ${projectSlug}/${componentSlug}/${languageCode}\n\n`;

      resultText += `📊 **Summary:**\n`;
      resultText += `- Total: ${result.summary.total}\n`;
      resultText += `- ✅ Successful: ${result.summary.successful}\n`;
      resultText += `- ❌ Failed: ${result.summary.failed}\n\n`;

      if (result.successful.length > 0) {
        resultText += `✅ **Successfully Updated (${result.successful.length}):**\n`;
        result.successful.slice(0, 10).forEach(({ key }) => {
          resultText += `- ${key}\n`;
        });
        if (result.successful.length > 10) {
          resultText += `... and ${result.successful.length - 10} more\n`;
        }
        resultText += '\n';
      }

      if (result.failed.length > 0) {
        resultText += `❌ **Failed Updates (${result.failed.length}):**\n`;
        result.failed.slice(0, 5).forEach(({ key, error }) => {
          resultText += `- ${key}: ${error}\n`;
        });
        if (result.failed.length > 5) {
          resultText += `... and ${result.failed.length - 5} more failures\n`;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to bulk write translations`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error during bulk translation update: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  @Tool({
    name: 'findTranslationsForKey',
    description:
      'Find all translations for a specific key across all components and languages in a project',
    parameters: z.object({
      projectSlug: z.string().describe('The slug of the project'),
      key: z.string().describe('The exact translation key to find'),
    }),
  })
  async findTranslationsForKey({
    projectSlug,
    key,
  }: {
    projectSlug: string;
    key: string;
  }) {
    try {
      const results = await this.weblateApiService.findTranslationsForKey(
        projectSlug,
        key,
      );

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No translations found for key "${key}" in project "${projectSlug}"`,
            },
          ],
        };
      }

      // Group by component and language for better readability
      const groupedResults = results.reduce(
        (acc: Record<string, Unit[]>, translation) => {
          const component = translation.web_url?.split('/')[4] || 'unknown';
          const language = translation.web_url?.split('/')[6] || 'unknown';
          const groupKey = `${component}/${language}`;

          if (!acc[groupKey]) {
            acc[groupKey] = [];
          }
          acc[groupKey].push(translation);
          return acc;
        },
        {},
      );

      const formattedResults = Object.entries(groupedResults)
        .map(([groupKey, translations]) => {
          const [component, language] = groupKey.split('/');
          const translationList = translations
            .map((translation) => this.formatTranslationResult(translation))
            .join('\n');
          return `**${component} (${language}):**\n${translationList}`;
        })
        .join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${results.length} translations for key "${key}" in project "${projectSlug}":\n\n${formattedResults}`,
          },
        ],
      };
    } catch (error) {
      this.logger.error(
        `Failed to find translations for key "${key}" in ${projectSlug}`,
        error,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Error finding translations for key "${key}" in project "${projectSlug}": ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  @Tool({
    name: 'searchUnitsWithFilters',
    description:
      "Search translation units using Weblate's powerful filtering syntax. Supports filters like: state:<translated (untranslated), state:>=translated (translated), component:NAME, source:TEXT, target:TEXT, has:suggestion, etc.",
    parameters: z.object({
      projectSlug: z.string().describe('The slug of the project'),
      componentSlug: z.string().describe('The slug of the component'),
      languageCode: z.string().describe('The language code (e.g., sk, cs, fr)'),
      searchQuery: z
        .string()
        .describe(
          'Weblate search query using their filter syntax. Examples: "state:<translated" (untranslated), "state:>=translated" (translated), "source:hello", "has:suggestion", "component:common AND state:<translated"',
        ),
      limit: z
        .number()
        .optional()
        .default(50)
        .describe(
          'Maximum number of results to return (default: 50, max: 200)',
        ),
    }),
  })
  async searchUnitsWithFilters({
    projectSlug,
    componentSlug,
    languageCode,
    searchQuery,
    limit = 50,
  }: {
    projectSlug: string;
    componentSlug: string;
    languageCode: string;
    searchQuery: string;
    limit?: number;
  }) {
    try {
      const results = await this.weblateApiService.searchUnitsWithQuery(
        projectSlug,
        componentSlug,
        languageCode,
        searchQuery,
        Math.min(limit, 200), // Cap at 200 to prevent overwhelming responses
      );

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No units found matching query "${searchQuery}" in ${projectSlug}/${componentSlug}/${languageCode}`,
            },
          ],
        };
      }

      const resultText = this.formatFilteredResults(
        results,
        projectSlug,
        componentSlug,
        languageCode,
        searchQuery,
      );

      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to search units with filters', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error searching units: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  @Tool({
    name: 'searchUnitsWithFailingChecks',
    description:
      'Search read-only translation units with failing Weblate quality checks. Use checkId for one specific check, or omit it to find any failing check.',
    parameters: z.object({
      projectSlug: z.string().describe('The slug of the project to search in'),
      componentSlug: z.string().describe('The public slug of the component'),
      languageCode: z.string().describe('The target language code, e.g. en'),
      checkId: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('Optional Weblate check identifier, e.g. newline-count'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .default(50)
        .describe('Maximum number of results to return'),
    }),
  })
  async searchUnitsWithFailingChecks({
    projectSlug,
    componentSlug,
    languageCode,
    checkId,
    limit = 50,
  }: {
    projectSlug: string;
    componentSlug: string;
    languageCode: string;
    checkId?: string;
    limit?: number;
  }) {
    try {
      const results = await this.weblateApiService.searchUnitsWithFailingChecks(
        projectSlug,
        componentSlug,
        languageCode,
        checkId,
        Math.min(limit, 200),
      );

      if (results.length === 0) {
        const scope = `${projectSlug}/${componentSlug}/${languageCode}`;
        const check = checkId ? `check "${checkId}"` : 'any failing check';
        return {
          content: [
            {
              type: 'text',
              text: `No units found in ${scope} with ${check}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: this.formatFilteredResults(
              results,
              projectSlug,
              componentSlug,
              languageCode,
              checkId ? `check:${checkId}` : 'has:check',
            ),
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to search units with failing checks', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error searching units with failing checks: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private formatTranslationResult(translation: Unit): string {
    const status = this.formatStateLabel(translation.state, translation);
    const details = translation as Unit & {
      effective_labels?: Array<{ id: number; name: string }>;
      labels_owner?: string;
      source_unit_id?: string | null;
    };
    const labels = details.effective_labels ?? translation.labels ?? [];
    const labelsText = labels.length
      ? labels.map(({ id, name }) => `${name} (ID ${id})`).join(', ')
      : 'нет';
    const labelsSource = details.labels_owner
      ? `\n**Источник labels:** ${details.labels_owner}${details.source_unit_id ? ` (ID ${details.source_unit_id})` : ''}`
      : '';

    const sourceText =
      translation.source && Array.isArray(translation.source)
        ? translation.source.join(' | ')
        : translation.source || '(empty)';

    const targetText =
      translation.target && Array.isArray(translation.target)
        ? translation.target.join(' | ')
        : translation.target || '(empty)';

    return `**Key:** ${translation.context}
**Source:** ${sourceText}
**Target:** ${targetText}
**Status:** ${status}
**State:** ${translation.state ?? '(unknown)'}
**Labels:** ${labelsText}${labelsSource}
**Context:** ${translation.context || '(none)'}
**Note:** ${translation.note || '(none)'}
**ID:** ${translation.id}`;
  }

  private formatStateLabel(
    state: number | undefined,
    translation?: Unit,
  ): string {
    if (state === 0) return '❌ Untranslated';
    if (state === 10) return '🔄 Needs Editing';
    if (state === 20) return '✅ Translated';
    if (state === 30) return '✅ Approved';
    if (state === 100) return '🔒 Read-only';
    if (translation?.approved) return '✅ Approved';
    if (translation?.translated) return '✅ Translated';
    return '❓ Unknown';
  }

  private formatFilteredResults(
    results: Unit[],
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    searchQuery: string,
  ): string {
    if (results.length === 0) {
      return `No units found in ${projectSlug}/${componentSlug}/${languageCode} matching query: ${searchQuery}`;
    }

    const formattedResults = results
      .slice(0, 50) // Limit to 50 for readability
      .map((unit) => {
        const sourceText =
          unit.source && Array.isArray(unit.source)
            ? unit.source.join('')
            : unit.source || '(empty)';
        const targetText =
          unit.target && Array.isArray(unit.target)
            ? unit.target.join('')
            : unit.target || '(empty)';

        // Determine status based on state
        let status = '❓ Unknown';
        if (unit.state === 0) status = '❌ Untranslated';
        else if (unit.state === 10) status = '🔄 Needs Editing';
        else if (unit.state === 20) status = '✅ Translated';
        else if (unit.state === 30) status = '✅ Approved';
        else if (unit.state === 100) status = '🔒 Read-only';

        return `**Key:** ${unit.context || '(no context)'}
**Source:** ${sourceText}
**Target:** ${targetText}
**Status:** ${status}
**Location:** ${unit.location || '(none)'}
**Note:** ${unit.note || '(none)'}
**ID:** ${unit.id}`;
      })
      .join('\n\n');

    const totalText =
      results.length > 50
        ? `\n\n*Showing first 50 of ${results.length} units*`
        : '';

    return `Found ${results.length} units in ${projectSlug}/${componentSlug}/${languageCode} matching query "${searchQuery}":\n\n${formattedResults}${totalText}`;
  }
}
