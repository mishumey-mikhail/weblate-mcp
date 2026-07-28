import { Injectable } from '@nestjs/common';
import { BaseWeblateService } from './base-weblate.service';
import {
  type TranslationMemoryLookupRequest,
  type TranslationMemoryLookupResult,
  type WeblatePaginatedResponse,
  type WeblateTranslationMemoryEntry,
} from '../../types';

@Injectable()
export class WeblateMemoryService extends BaseWeblateService {
  async listTranslationMemory(
    projectSlug?: string,
    source?: string,
    sourceLanguage?: string,
    targetLanguage?: string,
    page = 1,
    pageSize = 100,
  ): Promise<WeblatePaginatedResponse<WeblateTranslationMemoryEntry>> {
    try {
      const response = await this.apiClient.get<
        WeblatePaginatedResponse<WeblateTranslationMemoryEntry>
      >('/memory/', {
        params: {
          page,
          page_size: pageSize,
          ...(projectSlug ? { project: projectSlug } : {}),
          ...(source ? { source } : {}),
          ...(sourceLanguage ? { source_language: sourceLanguage } : {}),
          ...(targetLanguage ? { target_language: targetLanguage } : {}),
        },
      });
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to list translation memory: ${message}`);
      throw new Error(`Failed to list translation memory: ${message}`);
    }
  }

  async getTranslationMemoryEntry(
    memoryId: string,
  ): Promise<WeblateTranslationMemoryEntry> {
    try {
      const response = await this.apiClient.get<WeblateTranslationMemoryEntry>(
        `/memory/${encodeURIComponent(memoryId)}/`,
      );
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to get translation memory entry ${memoryId}: ${message}`,
      );
      throw new Error(`Failed to get translation memory entry: ${message}`);
    }
  }

  async lookupTranslationMemory(
    sourceLanguage: string,
    targetLanguage: string,
    strings: string[],
    projectSlug?: string,
    exact: boolean = false,
  ): Promise<TranslationMemoryLookupResult[]> {
    try {
      const request: TranslationMemoryLookupRequest = { strings };
      const response = await this.apiClient.post<
        TranslationMemoryLookupResult[]
      >('/memory/lookup/', request, {
        params: {
          source_language: sourceLanguage,
          target_language: targetLanguage,
          ...(projectSlug ? { project: projectSlug } : {}),
          exact,
        },
      });

      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to lookup translation memory for ${sourceLanguage}->${targetLanguage}`,
        message,
      );
      throw new Error(`Failed to lookup translation memory: ${message}`);
    }
  }
}
