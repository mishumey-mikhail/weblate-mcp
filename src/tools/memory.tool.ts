import { Injectable, Logger } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { WeblateApiService } from '../services';
import { type TranslationMemoryLookupResult } from '../types';

@Injectable()
export class WeblateMemoryTool {
  private readonly logger = new Logger(WeblateMemoryTool.name);

  constructor(private readonly weblateApiService: WeblateApiService) {}

  @Tool({
    name: 'lookupTranslationMemory',
    description:
      'Look up read-only translation memory matches for one or more source strings',
    parameters: z.object({
      sourceLanguage: z
        .string()
        .trim()
        .min(2)
        .describe('The source language code, for example en'),
      targetLanguage: z
        .string()
        .trim()
        .min(2)
        .describe('The target language code, for example ru'),
      strings: z
        .array(z.string().trim().min(1).max(2000))
        .min(1)
        .max(100)
        .describe(
          'Source strings to search for, up to 100 strings per request',
        ),
      projectSlug: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('Optional Weblate project slug to limit the memory search'),
      exact: z
        .boolean()
        .optional()
        .default(false)
        .describe('Whether to return only exact matches'),
    }),
  })
  async lookupTranslationMemory({
    sourceLanguage,
    targetLanguage,
    strings,
    projectSlug,
    exact = false,
  }: {
    sourceLanguage: string;
    targetLanguage: string;
    strings: string[];
    projectSlug?: string;
    exact?: boolean;
  }) {
    try {
      const results = await this.weblateApiService.lookupTranslationMemory(
        sourceLanguage,
        targetLanguage,
        strings,
        projectSlug,
        exact,
      );

      return {
        content: [
          {
            type: 'text',
            text: this.formatResults(sourceLanguage, targetLanguage, results),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to lookup translation memory for ${sourceLanguage}->${targetLanguage}`,
        message,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Error looking up translation memory: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private formatResults(
    sourceLanguage: string,
    targetLanguage: string,
    results: TranslationMemoryLookupResult[],
  ): string {
    const matchedCount = results.filter(({ match }) => match !== null).length;
    const details = results
      .map(({ query, match }) => {
        if (!match) {
          return `**Query:** ${query}\n**Match:** none`;
        }

        return [
          `**Query:** ${query}`,
          `**Source:** ${match.source}`,
          `**Target:** ${match.target}`,
          `**Origin:** ${match.origin}`,
          `**Quality:** ${match.quality}`,
          `**Exact:** ${match.exact ? 'yes' : 'no'}`,
          `**ID:** ${match.id}`,
        ].join('\n');
      })
      .join('\n\n---\n\n');

    return `Translation Memory lookup ${sourceLanguage} → ${targetLanguage}: ${matchedCount}/${results.length} queries matched.\n\n${details}`;
  }
}
