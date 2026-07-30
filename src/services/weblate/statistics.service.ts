import { Injectable, Logger } from '@nestjs/common';
import { WeblateClientService } from '../weblate-client.service';
import { WeblateComponentsService } from './components.service';
import { WeblateLanguagesService } from './languages.service';
import {
  projectsStatisticsRetrieve,
  componentsStatisticsRetrieve,
  translationsStatisticsRetrieve,
  languagesStatisticsRetrieve,
  usersStatisticsRetrieve,
} from '../../client';
import { type Component } from '../../client';

type NumericStatisticKey =
  | 'total'
  | 'translated'
  | 'approved'
  | 'readonly'
  | 'failing'
  | 'suggestions'
  | 'comments';

interface ComponentLanguageStatistics {
  total?: number;
  translated?: number;
  translated_percent?: number;
  approved?: number;
  approved_percent?: number;
  readonly?: number;
  readonly_percent?: number;
  failing?: number;
  failing_percent?: number;
  suggestions?: number;
  comments?: number;
  fuzzy?: number;
}

interface ComponentStatistics {
  total: number;
  translated: number;
  translated_percent: number;
  approved: number;
  approved_percent: number;
  readonly: number;
  readonly_percent: number;
  nottranslated: number;
  nottranslated_percent: number;
  failing: number;
  failing_percent: number;
  suggestions: number;
  comments: number;
  languages: ComponentLanguageStatistics[];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function sumStatistic(
  statistics: ComponentLanguageStatistics[],
  key: NumericStatisticKey,
): number {
  return statistics.reduce((sum, statistic) => {
    const value = statistic[key];
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
}

function aggregateComponentStatistics(
  response: unknown,
): ComponentStatistics | Record<string, unknown> {
  if (!response || typeof response !== 'object') {
    return {};
  }

  const payload = response as {
    results?: ComponentLanguageStatistics[];
  };

  if (!Array.isArray(payload.results)) {
    return response as ComponentStatistics;
  }

  const languages = payload.results;
  const total = sumStatistic(languages, 'total');
  const translated = sumStatistic(languages, 'translated');
  const approved = sumStatistic(languages, 'approved');
  const readonly = sumStatistic(languages, 'readonly');
  const failing = sumStatistic(languages, 'failing');
  const suggestions = sumStatistic(languages, 'suggestions');
  const comments = sumStatistic(languages, 'comments');
  const nottranslated = Math.max(total - translated, 0);

  return {
    total,
    translated,
    translated_percent: total ? (translated / total) * 100 : 0,
    approved,
    approved_percent: total ? (approved / total) * 100 : 0,
    readonly,
    readonly_percent: total ? (readonly / total) * 100 : 0,
    nottranslated,
    nottranslated_percent: total ? (nottranslated / total) * 100 : 0,
    failing,
    failing_percent: total ? (failing / total) * 100 : 0,
    suggestions,
    comments,
    languages,
  };
}

function getComponentApiSlug(
  projectSlug: string,
  component: Pick<Component, 'slug' | 'statistics_url'>,
): string {
  try {
    const statisticsPath = new URL(
      component.statistics_url,
      'http://weblate.local',
    ).pathname;
    const prefix = `/components/${encodeURIComponent(projectSlug)}/`;
    const suffix = '/statistics/';
    const prefixIndex = statisticsPath.indexOf(prefix);

    if (prefixIndex >= 0 && statisticsPath.endsWith(suffix)) {
      const encodedSlug = statisticsPath.slice(
        prefixIndex + prefix.length,
        -suffix.length,
      );
      if (encodedSlug) {
        // Weblate returns nested component slugs double-encoded in URL fields.
        return decodeURIComponent(encodedSlug);
      }
    }
  } catch {
    // Fall back to the public component slug when the URL is malformed.
  }

  return component.slug;
}

@Injectable()
export class WeblateStatisticsService {
  private readonly logger = new Logger(WeblateStatisticsService.name);

  constructor(
    private clientService: WeblateClientService,
    private componentsService: WeblateComponentsService,
    private languagesService: WeblateLanguagesService,
  ) {}

  /**
   * Get comprehensive statistics for a project
   */
  async getProjectStatistics(projectSlug: string) {
    try {
      const response = await projectsStatisticsRetrieve({
        client: this.clientService.getClient(),
        path: { slug: projectSlug },
        query: { format: 'json' },
      });

      if (response.error) {
        throw new Error(
          `Failed to get project statistics: ${getErrorMessage(response.error)}`,
        );
      }

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get project statistics for ${projectSlug}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get detailed statistics for a component
   */
  async getComponentStatistics(projectSlug: string, componentSlug: string) {
    try {
      const apiComponentSlug = await this.resolveComponentApiSlug(
        projectSlug,
        componentSlug,
      );
      return await this.fetchComponentStatistics(projectSlug, apiComponentSlug);
    } catch (error) {
      this.logger.error(
        `Failed to get component statistics for ${projectSlug}/${componentSlug}`,
        error,
      );
      throw error;
    }
  }

  private async fetchComponentStatistics(
    projectSlug: string,
    componentSlug: string,
  ) {
    const response = await componentsStatisticsRetrieve({
      client: this.clientService.getClient(),
      path: {
        project__slug: projectSlug,
        slug: componentSlug,
      },
      query: { format: 'json' },
    });

    if (response.error) {
      throw new Error(
        `Failed to get component statistics: ${getErrorMessage(response.error)}`,
      );
    }

    return aggregateComponentStatistics(response.data);
  }

  private async resolveComponentApiSlug(
    projectSlug: string,
    componentSlug: string,
  ): Promise<string> {
    if (/%2f/i.test(componentSlug)) {
      return componentSlug;
    }

    const components = await this.componentsService.listComponents(projectSlug);
    const component = components.find(({ slug }) => slug === componentSlug);
    return component
      ? getComponentApiSlug(projectSlug, component)
      : componentSlug;
  }

  /**
   * Get translation statistics for a specific language in a component
   */
  async getTranslationStatistics(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
  ) {
    try {
      const response = await translationsStatisticsRetrieve({
        client: this.clientService.getClient(),
        path: {
          component__project__slug: projectSlug,
          component__slug: componentSlug,
          language__code: languageCode,
        },
        query: { format: 'json' },
      });

      if (response.error) {
        throw new Error(
          `Failed to get translation statistics: ${getErrorMessage(response.error)}`,
        );
      }

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get translation statistics for ${projectSlug}/${componentSlug}/${languageCode}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get statistics for a specific language across all projects
   */
  async getLanguageStatistics(languageCode: string) {
    try {
      const response = await languagesStatisticsRetrieve({
        client: this.clientService.getClient(),
        path: { code: languageCode },
        query: { format: 'json' },
      });

      if (response.error) {
        throw new Error(
          `Failed to get language statistics: ${getErrorMessage(response.error)}`,
        );
      }

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get language statistics for ${languageCode}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get user contribution statistics
   */
  async getUserStatistics(username: string) {
    try {
      const response = await usersStatisticsRetrieve({
        client: this.clientService.getClient(),
        path: { username },
        query: { format: 'json' },
      });

      if (response.error) {
        throw new Error(
          `Failed to get user statistics: ${getErrorMessage(response.error)}`,
        );
      }

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get user statistics for ${username}`, error);
      throw error;
    }
  }

  /**
   * Get dashboard overview for a project with all component statistics
   */
  async getProjectDashboard(projectSlug: string) {
    try {
      // Get project info and components
      const [projectStats, components] = await Promise.all([
        this.getProjectStatistics(projectSlug),
        this.componentsService.listComponents(projectSlug),
      ]);

      // Get statistics for each component
      const componentStats = await Promise.all(
        components.map(async (component) => {
          try {
            const stats = await this.fetchComponentStatistics(
              projectSlug,
              getComponentApiSlug(projectSlug, component),
            );
            return {
              component: component.name,
              slug: component.slug,
              statistics: stats,
            };
          } catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logger.warn(
              `Failed to get stats for component ${component.slug}: ${errorMessage}`,
            );
            return {
              component: component.name,
              slug: component.slug,
              statistics: null,
              error: errorMessage,
            };
          }
        }),
      );

      return {
        project: projectStats,
        components: componentStats,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get project dashboard for ${projectSlug}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get translation progress for all languages in a component
   */
  async getComponentLanguageProgress(
    projectSlug: string,
    componentSlug: string,
  ) {
    try {
      // Get available languages for the project
      const languages = await this.languagesService.listLanguages(projectSlug);

      // Get translation statistics for each language
      const languageProgress = await Promise.all(
        languages.map(async (language) => {
          try {
            const stats = await this.getTranslationStatistics(
              projectSlug,
              componentSlug,
              language.code,
            );
            return {
              language: language.name,
              code: language.code,
              statistics: stats,
            };
          } catch (error) {
            this.logger.warn(
              `Failed to get translation stats for ${language.code} in ${componentSlug}`,
              error,
            );
            return {
              language: language.name,
              code: language.code,
              statistics: null,
              error: getErrorMessage(error),
            };
          }
        }),
      );

      return languageProgress;
    } catch (error) {
      this.logger.error(
        `Failed to get component language progress for ${projectSlug}/${componentSlug}`,
        error,
      );
      throw error;
    }
  }
}
