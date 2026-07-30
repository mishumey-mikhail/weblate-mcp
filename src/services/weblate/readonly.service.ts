import { Injectable } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import { BaseWeblateService } from './base-weblate.service';
import { WeblateComponentsService } from './components.service';
import { type Component, type Project, type Unit } from '../../client';
import {
  type WeblateChangeDetails,
  type WeblateComment,
  type WeblatePaginatedResponse,
  type WeblateRepositoryStatus,
  type WeblateScreenshot,
} from '../../types';

@Injectable()
export class WeblateReadonlyService extends BaseWeblateService {
  constructor(
    configService: ConfigService,
    private readonly componentsService: WeblateComponentsService,
  ) {
    super(configService);
  }

  async getUnitDetails(unitId: string): Promise<Unit> {
    return this.get<Unit>(`/units/${encodeURIComponent(unitId)}/`);
  }

  async getUnitComments(
    unitId: string,
    page = 1,
    pageSize = 100,
  ): Promise<WeblatePaginatedResponse<WeblateComment>> {
    return this.getPaginated<WeblateComment>(
      `/units/${encodeURIComponent(unitId)}/comments/`,
      { page, page_size: pageSize },
    );
  }

  async getChangeDetails(changeId: string): Promise<WeblateChangeDetails> {
    return this.get<WeblateChangeDetails>(
      `/changes/${encodeURIComponent(changeId)}/`,
    );
  }

  async getTranslationDetails(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
  ): Promise<Record<string, unknown>> {
    const apiComponentSlug =
      await this.componentsService.resolveComponentApiSlug(
        projectSlug,
        componentSlug,
      );
    return this.get<Record<string, unknown>>(
      `/translations/${this.path(projectSlug)}/${this.path(apiComponentSlug)}/${this.path(languageCode)}/`,
    );
  }

  async getProjectDetails(projectSlug: string): Promise<Project> {
    return this.get<Project>(`/projects/${this.path(projectSlug)}/`);
  }

  async getComponentDetails(
    projectSlug: string,
    componentSlug: string,
  ): Promise<Component> {
    const apiComponentSlug =
      await this.componentsService.resolveComponentApiSlug(
        projectSlug,
        componentSlug,
      );
    return this.get<Component>(
      `/components/${this.path(projectSlug)}/${this.path(apiComponentSlug)}/`,
    );
  }

  async getUnitHistory(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    unitId: string,
    limit = 100,
  ): Promise<WeblateChangeDetails[]> {
    const apiComponentSlug =
      await this.componentsService.resolveComponentApiSlug(
        projectSlug,
        componentSlug,
      );
    const path = `/translations/${this.path(projectSlug)}/${this.path(apiComponentSlug)}/${this.path(languageCode)}/changes/`;
    const matchingChanges: WeblateChangeDetails[] = [];
    let page = 1;

    while (matchingChanges.length < limit && page <= 100) {
      const history = await this.getPaginated<WeblateChangeDetails>(path, {
        page,
        page_size: Math.min(limit, 1000),
      });
      matchingChanges.push(
        ...history.results.filter((change) =>
          this.referencesUnit(change, unitId),
        ),
      );
      if (!history.next || history.results.length === 0) {
        break;
      }
      page += 1;
    }

    return matchingChanges.slice(0, limit);
  }

  async listTranslationUnits(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    page = 1,
    pageSize = 100,
  ): Promise<WeblatePaginatedResponse<Unit>> {
    const apiComponentSlug =
      await this.componentsService.resolveComponentApiSlug(
        projectSlug,
        componentSlug,
      );
    return this.getPaginated<Unit>(
      `/translations/${this.path(projectSlug)}/${this.path(apiComponentSlug)}/${this.path(languageCode)}/units/`,
      { page, page_size: pageSize },
    );
  }

  async getUnitScreenshots(
    projectSlug: string,
    componentSlug: string,
    unitId: string,
  ): Promise<WeblateScreenshot[]> {
    const apiComponentSlug =
      await this.componentsService.resolveComponentApiSlug(
        projectSlug,
        componentSlug,
      );
    const screenshots = await this.getPaginated<WeblateScreenshot>(
      `/components/${this.path(projectSlug)}/${this.path(apiComponentSlug)}/screenshots/`,
      { page_size: 100 },
    );
    const relatedScreenshots = screenshots.results.filter((screenshot) =>
      screenshot.units.some((unit) => this.referencesUnitUrl(unit, unitId)),
    );

    return Promise.all(
      relatedScreenshots.map(async (screenshot) => {
        try {
          const file = await this.get<{ image?: string }>(
            `/screenshots/${encodeURIComponent(String(screenshot.id))}/file/`,
          );
          return { ...screenshot, image_url: file.image };
        } catch (error) {
          this.logger.warn(
            `Failed to get image URL for screenshot ${screenshot.id}: ${this.errorMessage(error)}`,
          );
          return screenshot;
        }
      }),
    );
  }

  async getRepositoryStatus(
    scope: 'project' | 'component' | 'translation',
    projectSlug: string,
    componentSlug?: string,
    languageCode?: string,
  ): Promise<WeblateRepositoryStatus> {
    let path: string;
    if (scope === 'project') {
      path = `/projects/${this.path(projectSlug)}/repository/`;
    } else if (scope === 'component') {
      if (!componentSlug) {
        throw new Error(
          'componentSlug is required for component repository status',
        );
      }
      const apiComponentSlug =
        await this.componentsService.resolveComponentApiSlug(
          projectSlug,
          componentSlug,
        );
      path = `/components/${this.path(projectSlug)}/${this.path(apiComponentSlug)}/repository/`;
    } else {
      if (!componentSlug || !languageCode) {
        throw new Error(
          'componentSlug and languageCode are required for translation repository status',
        );
      }
      const apiComponentSlug =
        await this.componentsService.resolveComponentApiSlug(
          projectSlug,
          componentSlug,
        );
      path = `/translations/${this.path(projectSlug)}/${this.path(apiComponentSlug)}/${this.path(languageCode)}/repository/`;
    }

    return this.get<WeblateRepositoryStatus>(path);
  }

  private async get<T>(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    try {
      const response = await this.apiClient.get<T>(path, { params });
      return response.data;
    } catch (error) {
      const message = this.errorMessage(error);
      this.logger.error(
        `Failed to read Weblate API endpoint ${path}: ${message}`,
      );
      throw new Error(
        `Failed to read Weblate API endpoint ${path}: ${message}`,
      );
    }
  }

  private async getPaginated<T>(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<WeblatePaginatedResponse<T>> {
    const response = await this.get<WeblatePaginatedResponse<T> | T[]>(
      path,
      params,
    );
    if (Array.isArray(response)) {
      return {
        count: response.length,
        next: null,
        previous: null,
        results: response,
      };
    }

    return {
      count: response.count ?? response.results.length,
      next: response.next ?? null,
      previous: response.previous ?? null,
      results: response.results ?? [],
    };
  }

  private referencesUnit(
    change: WeblateChangeDetails,
    unitId: string,
  ): boolean {
    return this.referencesUnitUrl(change.unit, unitId);
  }

  private referencesUnitUrl(
    value: string | null | undefined,
    unitId: string,
  ): boolean {
    return (
      value === unitId ||
      (typeof value === 'string' && value.includes(`/units/${unitId}/`))
    );
  }

  private path(value: string): string {
    return encodeURIComponent(value);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
