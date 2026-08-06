import { Injectable, Logger } from '@nestjs/common';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { WeblateApiService } from '../services';

@Injectable()
export class WeblateCommentsTool {
  private readonly logger = new Logger(WeblateCommentsTool.name);

  constructor(private readonly weblateApiService: WeblateApiService) {}

  @Tool({
    name: 'addUnitComment',
    description:
      'Изменяет данные: добавляет настоящий комментарий к target translation-unit. Используй после назначения MQM-метки, чтобы сохранить короткую причину классификации; не записывает Additional explanation.',
    parameters: z.object({
      projectSlug: z.string().describe('Slug проекта'),
      componentSlug: z.string().describe('Slug компонента'),
      languageCode: z.string().describe('Код языка перевода'),
      key: z.string().describe('Ключ юнита перевода'),
      comment: z
        .string()
        .trim()
        .min(1)
        .max(2000)
        .describe('Комментарий к target translation-unit'),
    }),
  })
  async addUnitComment({
    projectSlug,
    componentSlug,
    languageCode,
    key,
    comment,
  }: {
    projectSlug: string;
    componentSlug: string;
    languageCode: string;
    key: string;
    comment: string;
  }): Promise<CallToolResult> {
    try {
      const result = await this.weblateApiService.addUnitComment(
        projectSlug,
        componentSlug,
        languageCode,
        key,
        comment.trim(),
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Не удалось добавить комментарий к юниту с ключом "${key}"`,
        error,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Не удалось добавить комментарий к юниту с ключом "${key}": ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
}
