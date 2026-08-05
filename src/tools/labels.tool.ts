import { Injectable, Logger } from '@nestjs/common';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { WeblateApiService } from '../services';

@Injectable()
export class WeblateLabelsTool {
  private readonly logger = new Logger(WeblateLabelsTool.name);

  constructor(private readonly weblateApiService: WeblateApiService) {}

  @Tool({
    name: 'listProjectLabels',
    description: 'Список доступных меток указанного проекта Weblate',
    parameters: z.object({
      projectSlug: z.string().describe('Slug проекта'),
    }),
  })
  async listProjectLabels({
    projectSlug,
  }: {
    projectSlug: string;
  }): Promise<CallToolResult> {
    try {
      const labels =
        await this.weblateApiService.listProjectLabels(projectSlug);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                projectSlug,
                labels: labels.map(({ id, name, description, color }) => ({
                  id,
                  name,
                  description: description ?? null,
                  color: color ?? null,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Не удалось получить метки проекта ${projectSlug}`,
        error,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Не удалось получить метки проекта "${projectSlug}": ${message}`,
          },
        ],
        isError: true,
      };
    }
  }

  @Tool({
    name: 'assignLabelToUnit',
    description:
      'Изменяет данные: назначает существующую метку проекта юниту перевода',
    parameters: z.object({
      projectSlug: z.string().describe('Slug проекта'),
      componentSlug: z.string().describe('Slug компонента'),
      languageCode: z.string().describe('Код языка'),
      key: z.string().describe('Ключ юнита перевода'),
      labelId: z.number().int().positive().describe('ID существующей метки'),
    }),
  })
  async assignLabelToUnit({
    projectSlug,
    componentSlug,
    languageCode,
    key,
    labelId,
  }: {
    projectSlug: string;
    componentSlug: string;
    languageCode: string;
    key: string;
    labelId: number;
  }): Promise<CallToolResult> {
    try {
      const result = await this.weblateApiService.assignLabelToUnit(
        projectSlug,
        componentSlug,
        languageCode,
        key,
        labelId,
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
        `Не удалось назначить метку юниту с ключом "${key}"`,
        error,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Не удалось назначить метку юниту с ключом "${key}": ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
}
