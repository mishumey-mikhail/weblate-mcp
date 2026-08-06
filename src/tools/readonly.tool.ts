import { Injectable, Logger } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { WeblateApiService } from '../services';
import {
  type WeblateChangeDetails,
  type WeblateComment,
  type WeblatePaginatedResponse,
  type WeblateRepositoryStatus,
  type WeblateScreenshot,
  type WeblateTranslationMemoryEntry,
} from '../types';

const pageSchema = z.number().int().min(1).max(1000).optional().default(1);

const pageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(1000)
  .optional()
  .default(100);

const translationScopeSchema = z.object({
  projectSlug: z.string().trim().min(1).describe('Weblate project slug'),
  componentSlug: z.string().trim().min(1).describe('Weblate component slug'),
  languageCode: z.string().trim().min(2).describe('Translation language code'),
});

@Injectable()
export class WeblateReadonlyTool {
  private readonly logger = new Logger(WeblateReadonlyTool.name);

  constructor(private readonly weblateApiService: WeblateApiService) {}

  @Tool({
    name: 'getUnitDetails',
    description:
      'Get complete read-only details for a Weblate translation unit. For translated units, labels are stored on the source unit; the response includes effective_labels, source_unit_id, source_unit_labels, and labels_owner.',
    parameters: z.object({
      unitId: z.string().trim().min(1).describe('Weblate translation unit ID'),
    }),
  })
  async getUnitDetails({ unitId }: { unitId: string }) {
    return this.execute('get unit details', async () => {
      const unit = await this.weblateApiService.getUnitDetails(unitId);
      return this.jsonResult(`Translation unit ${unitId}`, unit);
    });
  }

  @Tool({
    name: 'getUnitChecks',
    description:
      'Get read-only quality check IDs and details for one Weblate translation unit. Details are reported as unavailable when the Weblate UI cannot be read.',
    parameters: translationScopeSchema.extend({
      unitId: z.string().trim().min(1).describe('Weblate translation unit ID'),
    }),
  })
  async getUnitChecks({
    projectSlug,
    componentSlug,
    languageCode,
    unitId,
  }: {
    projectSlug: string;
    componentSlug: string;
    languageCode: string;
    unitId: string;
  }) {
    return this.execute('get unit checks', async () => {
      const checks = await this.weblateApiService.getUnitChecks(
        projectSlug,
        componentSlug,
        languageCode,
        unitId,
      );
      return this.jsonResult(`Quality checks for unit ${unitId}`, checks);
    });
  }

  @Tool({
    name: 'getUnitComments',
    description:
      'Get read-only comments attached to a Weblate translation unit',
    parameters: z.object({
      unitId: z.string().trim().min(1).describe('Weblate translation unit ID'),
      page: pageSchema,
      pageSize: pageSizeSchema,
    }),
  })
  async getUnitComments({
    unitId,
    page = 1,
    pageSize = 100,
  }: {
    unitId: string;
    page?: number;
    pageSize?: number;
  }) {
    return this.execute('get unit comments', async () => {
      const comments = await this.weblateApiService.getUnitComments(
        unitId,
        page,
        pageSize,
      );
      return this.commentsResult(unitId, comments);
    });
  }

  @Tool({
    name: 'getUnitHistory',
    description:
      'Get read-only translation history for one unit within a project component and language',
    parameters: translationScopeSchema.extend({
      unitId: z.string().trim().min(1).describe('Weblate translation unit ID'),
      limit: z.number().int().min(1).max(1000).optional().default(100),
    }),
  })
  async getUnitHistory({
    projectSlug,
    componentSlug,
    languageCode,
    unitId,
    limit = 100,
  }: {
    projectSlug: string;
    componentSlug: string;
    languageCode: string;
    unitId: string;
    limit?: number;
  }) {
    return this.execute('get unit history', async () => {
      const history = await this.weblateApiService.getUnitHistory(
        projectSlug,
        componentSlug,
        languageCode,
        unitId,
        limit,
      );
      return this.changesResult(
        `History for unit ${unitId} in ${projectSlug}/${componentSlug}/${languageCode}`,
        history,
      );
    });
  }

  @Tool({
    name: 'getChangeDetails',
    description: 'Get complete read-only details for one Weblate change',
    parameters: z.object({
      changeId: z.string().trim().min(1).describe('Weblate change ID'),
    }),
  })
  async getChangeDetails({ changeId }: { changeId: string }) {
    return this.execute('get change details', async () => {
      const change = await this.weblateApiService.getChangeDetails(changeId);
      return this.jsonResult(`Weblate change ${changeId}`, change);
    });
  }

  @Tool({
    name: 'getTranslationDetails',
    description:
      'Get complete read-only metadata and statistics for a Weblate translation',
    parameters: translationScopeSchema,
  })
  async getTranslationDetails({
    projectSlug,
    componentSlug,
    languageCode,
  }: {
    projectSlug: string;
    componentSlug: string;
    languageCode: string;
  }) {
    return this.execute('get translation details', async () => {
      const translation = await this.weblateApiService.getTranslationDetails(
        projectSlug,
        componentSlug,
        languageCode,
      );
      return this.jsonResult(
        `Translation ${projectSlug}/${componentSlug}/${languageCode}`,
        translation,
      );
    });
  }

  @Tool({
    name: 'getProjectDetails',
    description: 'Get complete read-only project configuration and metadata',
    parameters: z.object({
      projectSlug: z.string().trim().min(1).describe('Weblate project slug'),
    }),
  })
  async getProjectDetails({ projectSlug }: { projectSlug: string }) {
    return this.execute('get project details', async () => {
      const project =
        await this.weblateApiService.getProjectDetails(projectSlug);
      return this.jsonResult(`Project ${projectSlug}`, project);
    });
  }

  @Tool({
    name: 'getComponentDetails',
    description:
      'Get complete read-only component metadata, including glossary and screenshot settings',
    parameters: z.object({
      projectSlug: z.string().trim().min(1).describe('Weblate project slug'),
      componentSlug: z
        .string()
        .trim()
        .min(1)
        .describe('Weblate component slug'),
    }),
  })
  async getComponentDetails({
    projectSlug,
    componentSlug,
  }: {
    projectSlug: string;
    componentSlug: string;
  }) {
    return this.execute('get component details', async () => {
      const component = await this.weblateApiService.getComponentDetails(
        projectSlug,
        componentSlug,
      );
      return this.jsonResult(
        `Component ${projectSlug}/${componentSlug}`,
        component,
      );
    });
  }

  @Tool({
    name: 'listTranslationMemory',
    description:
      'List read-only Weblate translation memory entries using at least one scope filter',
    parameters: z
      .object({
        projectSlug: z.string().trim().min(1).optional(),
        source: z.string().trim().min(1).optional(),
        sourceLanguage: z.string().trim().min(2).optional(),
        targetLanguage: z.string().trim().min(2).optional(),
        page: pageSchema,
        pageSize: pageSizeSchema,
      })
      .refine(
        ({ projectSlug, source, sourceLanguage, targetLanguage }) =>
          Boolean(projectSlug || source || sourceLanguage || targetLanguage),
        { message: 'At least one Translation Memory filter is required' },
      ),
  })
  async listTranslationMemory({
    projectSlug,
    source,
    sourceLanguage,
    targetLanguage,
    page = 1,
    pageSize = 100,
  }: {
    projectSlug?: string;
    source?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
    page?: number;
    pageSize?: number;
  }) {
    return this.execute('list translation memory', async () => {
      const memory = await this.weblateApiService.listTranslationMemory(
        projectSlug,
        source,
        sourceLanguage,
        targetLanguage,
        page,
        pageSize,
      );
      return this.memoryResult(memory);
    });
  }

  @Tool({
    name: 'getTranslationMemoryEntry',
    description:
      'Get one read-only Translation Memory entry with provenance metadata',
    parameters: z.object({
      memoryId: z
        .string()
        .trim()
        .min(1)
        .describe('Weblate Translation Memory entry ID'),
    }),
  })
  async getTranslationMemoryEntry({ memoryId }: { memoryId: string }) {
    return this.execute('get translation memory entry', async () => {
      const entry =
        await this.weblateApiService.getTranslationMemoryEntry(memoryId);
      return this.jsonResult(`Translation Memory entry ${memoryId}`, entry);
    });
  }

  @Tool({
    name: 'getUnitScreenshots',
    description:
      'Find read-only screenshots associated with a translation unit and return image URLs',
    parameters: z.object({
      projectSlug: z.string().trim().min(1).describe('Weblate project slug'),
      componentSlug: z
        .string()
        .trim()
        .min(1)
        .describe('Weblate component slug'),
      unitId: z.string().trim().min(1).describe('Weblate translation unit ID'),
    }),
  })
  async getUnitScreenshots({
    projectSlug,
    componentSlug,
    unitId,
  }: {
    projectSlug: string;
    componentSlug: string;
    unitId: string;
  }) {
    return this.execute('get unit screenshots', async () => {
      const screenshots = await this.weblateApiService.getUnitScreenshots(
        projectSlug,
        componentSlug,
        unitId,
      );
      return this.screenshotsResult(unitId, screenshots);
    });
  }

  @Tool({
    name: 'listTranslationUnits',
    description:
      'List read-only translation units from one exact Weblate project component and language',
    parameters: translationScopeSchema.extend({
      page: pageSchema,
      pageSize: pageSizeSchema,
    }),
  })
  async listTranslationUnits({
    projectSlug,
    componentSlug,
    languageCode,
    page = 1,
    pageSize = 100,
  }: {
    projectSlug: string;
    componentSlug: string;
    languageCode: string;
    page?: number;
    pageSize?: number;
  }) {
    return this.execute('list translation units', async () => {
      const units = await this.weblateApiService.listTranslationUnits(
        projectSlug,
        componentSlug,
        languageCode,
        page,
        pageSize,
      );
      return this.unitsResult(
        `${projectSlug}/${componentSlug}/${languageCode}`,
        units,
      );
    });
  }

  @Tool({
    name: 'getRepositoryStatus',
    description:
      'Get read-only Weblate repository synchronization status for a project, component, or translation',
    parameters: z.object({
      scope: z.enum(['project', 'component', 'translation']),
      projectSlug: z.string().trim().min(1).describe('Weblate project slug'),
      componentSlug: z.string().trim().min(1).optional(),
      languageCode: z.string().trim().min(2).optional(),
    }),
  })
  async getRepositoryStatus({
    scope,
    projectSlug,
    componentSlug,
    languageCode,
  }: {
    scope: 'project' | 'component' | 'translation';
    projectSlug: string;
    componentSlug?: string;
    languageCode?: string;
  }) {
    return this.execute('get repository status', async () => {
      const repository = await this.weblateApiService.getRepositoryStatus(
        scope,
        projectSlug,
        componentSlug,
        languageCode,
      );
      return this.jsonResult(
        `Repository status (${scope}) for ${projectSlug}`,
        repository,
      );
    });
  }

  private async execute(
    operation: string,
    callback: () => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
  ) {
    try {
      return await callback();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to ${operation}: ${message}`);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }

  private jsonResult(title: string, value: unknown) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `${title}:\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``,
        },
      ],
    };
  }

  private commentsResult(
    unitId: string,
    response: WeblatePaginatedResponse<WeblateComment>,
  ) {
    const comments = response.results
      .map(
        (comment) =>
          `**#${comment.id}** [${comment.scope}] ${comment.timestamp ?? ''}\n${comment.comment}\nUser: ${comment.user}`,
      )
      .join('\n\n---\n\n');
    return {
      content: [
        {
          type: 'text' as const,
          text: `Found ${response.results.length} comments for unit ${unitId}.\n\n${comments || 'No comments found.'}`,
        },
      ],
    };
  }

  private changesResult(title: string, changes: WeblateChangeDetails[]) {
    const details = changes
      .map(
        (change) =>
          `**#${change.id} ${change.action_name}** ${change.timestamp}\nOld: ${change.old ?? ''}\nNew: ${change.target ?? ''}\nAuthor: ${change.author}`,
      )
      .join('\n\n---\n\n');
    return {
      content: [
        {
          type: 'text' as const,
          text: `${title}: ${changes.length} changes found.\n\n${details || 'No history found in the requested page.'}`,
        },
      ],
    };
  }

  private memoryResult(
    memory: WeblatePaginatedResponse<WeblateTranslationMemoryEntry>,
  ) {
    const entries = memory.results
      .map(
        (entry) =>
          `**#${entry.id}** ${entry.source} → ${entry.target}\nOrigin: ${entry.origin}\nLanguages: ${entry.source_language} → ${entry.target_language}\nProject: ${entry.project ?? 'global'}\nFrom file: ${entry.from_file ? 'yes' : 'no'}; Shared: ${entry.shared ? 'yes' : 'no'}`,
      )
      .join('\n\n---\n\n');
    return {
      content: [
        {
          type: 'text' as const,
          text: `Translation Memory: ${memory.results.length} entries of ${memory.count}.\n\n${entries || 'No entries found.'}`,
        },
      ],
    };
  }

  private screenshotsResult(unitId: string, screenshots: WeblateScreenshot[]) {
    const details = screenshots
      .map(
        (screenshot) =>
          `**#${screenshot.id} ${screenshot.name}**\nImage: ${screenshot.image_url ?? screenshot.file_url}\nWeblate URL: ${screenshot.url}\nRepository file: ${screenshot.repository_filename ?? 'none'}`,
      )
      .join('\n\n---\n\n');
    return {
      content: [
        {
          type: 'text' as const,
          text: `Screenshots for unit ${unitId}: ${screenshots.length} found.\n\n${details || 'No related screenshots found.'}`,
        },
      ],
    };
  }

  private unitsResult(scope: string, units: WeblatePaginatedResponse<unknown>) {
    return this.jsonResult(`Translation units for ${scope}`, units);
  }
}
