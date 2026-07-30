import { WeblateStatisticsTool } from './statistics.tool';

type ProjectStatisticsFormatter = (
  projectSlug: string,
  stats: Record<string, unknown>,
) => string;
type TranslationStatisticsFormatter = (
  projectSlug: string,
  componentSlug: string,
  languageCode: string,
  stats: Record<string, unknown>,
) => string;
type LanguageStatisticsFormatter = (
  languageCode: string,
  stats: Record<string, unknown>,
) => string;

describe('WeblateStatisticsTool', () => {
  const createTool = (): WeblateStatisticsTool =>
    new WeblateStatisticsTool({} as never, {} as never);

  it('derives project untranslated values when Weblate omits them', () => {
    const tool = createTool();
    const formatProjectStatistics = (
      tool as unknown as {
        formatProjectStatistics: ProjectStatisticsFormatter;
      }
    ).formatProjectStatistics.bind(tool);

    const result = formatProjectStatistics('web', {
      total: 14404,
      translated: 13019,
      translated_percent: 90.3,
      approved: 0,
      approved_percent: 0,
      readonly: 383,
      readonly_percent: 99,
      fuzzy: 374,
      fuzzy_percent: 2.6,
    });

    expect(result).toContain('- ❌ Untranslated: 9.6%');
    expect(result).toContain('- ❌ Untranslated: 1385');
    expect(result).toContain('- 🔍 Needs Review: 2.6%');
  });

  it('derives translation untranslated values when Weblate omits them', () => {
    const tool = createTool();
    const formatTranslationStatistics = (
      tool as unknown as {
        formatTranslationStatistics: TranslationStatisticsFormatter;
      }
    ).formatTranslationStatistics.bind(tool);

    const result = formatTranslationStatistics('web', 'glossarij', 'en', {
      total: 100,
      translated: 40,
      translated_percent: 40,
      approved: 0,
      approved_percent: 0,
      readonly: 0,
      readonly_percent: 0,
      fuzzy: 12,
      fuzzy_percent: 12,
    });

    expect(result).toContain('- ❌ Untranslated: 60.0%');
    expect(result).toContain('- ❌ Untranslated: 60');
    expect(result).toContain('- 🔍 Needs Review: 12.0%');
  });

  it('derives language untranslated values when Weblate omits them', () => {
    const tool = createTool();
    const formatLanguageStatistics = (
      tool as unknown as {
        formatLanguageStatistics: LanguageStatisticsFormatter;
      }
    ).formatLanguageStatistics.bind(tool);

    const result = formatLanguageStatistics('en', {
      name: 'English',
      total: 420,
      translated: 420,
      translated_percent: 100,
      approved: 0,
      approved_percent: 0,
    });

    expect(result).toContain('- ❌ Untranslated: 0.0%');
    expect(result).toContain('- ❌ Untranslated: 0');
    expect(result).toContain('- 🔤 Code: en');
  });
});
