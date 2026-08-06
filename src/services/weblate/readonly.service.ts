import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseWeblateService } from './base-weblate.service';
import { WeblateComponentsService } from './components.service';
import { WeblateTranslationsService } from './translations.service';
import { type Component, type Project, type Unit } from '../../client';
import {
  type WeblateChangeDetails,
  type WeblateComment,
  type WeblatePaginatedResponse,
  type WeblateRepositoryStatus,
  type WeblateScreenshot,
  type WeblateUnitCheck,
  type WeblateUnitChecksResult,
  type WeblateUnitDetails,
} from '../../types';

interface ParsedUnitCheck extends WeblateUnitCheck {
  documentationId: string | null;
}

function extractUnitId(unitUrl: string | undefined): string | null {
  if (!unitUrl) {
    return null;
  }

  const match = unitUrl.match(/\/units\/(\d+)\/?$/);
  return match?.[1] ?? null;
}

@Injectable()
export class WeblateReadonlyService extends BaseWeblateService {
  constructor(
    configService: ConfigService,
    private readonly componentsService: WeblateComponentsService,
    private readonly translationsService: WeblateTranslationsService,
  ) {
    super(configService);
  }

  async getUnitDetails(unitId: string): Promise<WeblateUnitDetails> {
    const unit = await this.get<Unit>(`/units/${encodeURIComponent(unitId)}/`);
    const unitLabels = unit.labels ?? [];
    const sourceUnitId = extractUnitId(unit.source_unit);

    if (!sourceUnitId || sourceUnitId === String(unit.id)) {
      return {
        ...unit,
        labels: unitLabels,
        unit_labels: unitLabels,
        source_unit_id: null,
        source_unit_labels: [],
        effective_labels: unitLabels,
        labels_owner: 'requested_unit',
      };
    }

    try {
      const sourceUnit = await this.get<Unit>(
        `/units/${encodeURIComponent(sourceUnitId)}/`,
      );
      const sourceLabels = sourceUnit.labels ?? [];

      return {
        ...unit,
        // Weblate exposes labels on source units only. Keep labels aligned
        // with the user-visible translation while preserving the raw fields.
        labels: sourceLabels,
        unit_labels: unitLabels,
        source_unit_id: sourceUnitId,
        source_unit_labels: sourceLabels,
        effective_labels: sourceLabels,
        labels_owner: 'source_unit',
        source_unit_explanation: sourceUnit.explanation ?? null,
      };
    } catch (error) {
      const message = this.errorMessage(error);
      this.logger.warn(
        `Не удалось получить labels source-unit ${sourceUnitId} для юнита ${unitId}: ${message}`,
      );
      return {
        ...unit,
        labels: unitLabels,
        unit_labels: unitLabels,
        source_unit_id: sourceUnitId,
        source_unit_labels: [],
        effective_labels: unitLabels,
        labels_owner: 'unresolved',
        labels_resolution_error: message,
      };
    }
  }

  async getUnitChecks(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    unitId: string,
  ): Promise<WeblateUnitChecksResult> {
    const unit = await this.getUnitDetails(unitId);
    const result: WeblateUnitChecksResult = {
      unitId,
      scope: { projectSlug, componentSlug, languageCode },
      hasFailingCheck: unit.has_failing_check,
      discoveredCheckIds: [],
      checks: [],
      detailsAvailable: false,
      limitations: [],
    };

    const translationPath = this.getTranslationPath(unit.web_url);
    if (!translationPath) {
      result.limitations.push(
        'Не удалось определить UI-путь translation из web_url unit.',
      );
      return result;
    }

    let checksIndexHtml: string;
    try {
      checksIndexHtml = await this.getWebPage(`/checks/-/${translationPath}/`);
    } catch (error) {
      result.limitations.push(
        `Не удалось получить read-only страницу списка checks: ${this.errorMessage(error)}`,
      );
      return result;
    }

    result.discoveredCheckIds = this.extractCheckIds(
      checksIndexHtml,
      translationPath,
    );
    if (result.discoveredCheckIds.length === 0) {
      result.limitations.push(
        'Weblate REST API не возвращает список check IDs, а UI-страница не дала доступных ссылок на проверки.',
      );
      return result;
    }

    const checkMatches = await Promise.allSettled(
      result.discoveredCheckIds.map(async (checkId) => ({
        checkId,
        units: await this.translationsService.searchUnitsWithFailingChecks(
          projectSlug,
          componentSlug,
          languageCode,
          checkId,
          200,
        ),
      })),
    );
    const matchingCheckIds = checkMatches
      .filter(
        (
          match,
        ): match is PromiseFulfilledResult<{
          checkId: string;
          units: Unit[];
        }> => match.status === 'fulfilled',
      )
      .filter(({ value }) =>
        value.units.some((candidate) => String(candidate.id) === unitId),
      )
      .map(({ value }) => value.checkId);

    const failedQueries = checkMatches.filter(
      (match): match is PromiseRejectedResult => match.status === 'rejected',
    );
    if (failedQueries.length > 0) {
      result.limitations.push(
        `Не удалось проверить ${failedQueries.length} check ID через Weblate search API.`,
      );
    }

    let unitPageHtml: string | null = null;
    try {
      unitPageHtml = await this.getWebPage(this.getUnitPagePath(unit.web_url));
    } catch (error) {
      result.limitations.push(
        `Не удалось получить read-only страницу unit с описаниями checks: ${this.errorMessage(error)}`,
      );
    }

    const parsedChecks = unitPageHtml
      ? this.parseUnitCheckBlocks(unitPageHtml)
      : [];
    result.checks = matchingCheckIds.map((checkId) => {
      const parsed = this.findParsedCheck(parsedChecks, checkId);
      return (
        parsed ?? {
          checkId,
          name: checkId,
          description: '',
          dismissed: false,
          enforced: false,
          documentationUrl: null,
          recordId: null,
        }
      );
    });
    result.detailsAvailable =
      result.checks.length > 0 &&
      result.checks.every((check) => Boolean(check.name && check.description));
    if (!result.detailsAvailable && result.checks.length > 0) {
      result.limitations.push(
        'Check ID найден через API, но Weblate UI не вернул полное название или описание.',
      );
    }

    return result;
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

  private async getWebPage(path: string): Promise<string> {
    try {
      const response = await this.webClient.get<string>(path, {
        headers: { Accept: 'text/html' },
      });
      if (typeof response.data !== 'string') {
        throw new Error('Weblate UI returned a non-HTML response');
      }
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to read Weblate UI endpoint ${path}: ${this.errorMessage(error)}`,
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

  private getTranslationPath(webUrl: string): string | null {
    try {
      const pathname = new URL(webUrl, 'http://weblate.local').pathname;
      const marker = '/translate/';
      const markerIndex = pathname.indexOf(marker);
      if (markerIndex < 0) {
        return null;
      }
      return pathname
        .slice(markerIndex + marker.length)
        .replace(/^\/+|\/+$/g, '');
    } catch {
      return null;
    }
  }

  private getUnitPagePath(webUrl: string): string {
    const parsed = new URL(webUrl, 'http://weblate.local');
    return `${parsed.pathname}${parsed.search}`;
  }

  private extractCheckIds(html: string, translationPath: string): string[] {
    const checkIds = new Set<string>();
    const hrefPattern = /href=["']([^"']+)["']/gi;
    for (const match of html.matchAll(hrefPattern)) {
      try {
        const href = this.decodeHtmlEntities(match[1]);
        const parsed = new URL(href, 'http://weblate.local');
        const parts = parsed.pathname.split('/').filter(Boolean);
        const checksIndex = parts.indexOf('checks');
        if (checksIndex < 0 || !parts[checksIndex + 1]) {
          continue;
        }
        const checkId = decodeURIComponent(parts[checksIndex + 1]);
        const linkedPath = parts.slice(checksIndex + 2).join('/');
        if (checkId !== '-' && linkedPath === translationPath) {
          checkIds.add(checkId);
        }
      } catch {
        // Пропускаем внешние и некорректные ссылки в HTML.
      }
    }
    return [...checkIds];
  }

  private parseUnitCheckBlocks(html: string): ParsedUnitCheck[] {
    return this.extractDivsWithClass(html, 'check-item')
      .filter((block) => /class=["'][^"']*\bred\b[^"']*["']/i.test(block))
      .map((block) => {
        const documentationMatch = /href=["']([^"']*#([^"'#]+))["']/i.exec(
          block,
        );
        const documentationUrl = documentationMatch
          ? this.decodeHtmlEntities(documentationMatch[1])
          : null;
        const documentationId = documentationMatch
          ? documentationMatch[2]
          : null;
        const heading = /<h5\b[^>]*>([\s\S]*?)<\/h5>/i.exec(block)?.[1] ?? '';
        const description =
          /<p\b[^>]*class=["'][^"']*check-description[^"']*["'][^>]*>([\s\S]*?)<\/p>/i.exec(
            block,
          )?.[1] ?? '';
        const recordId = /\/js\/ignore-check\/(\d+)\//i.exec(block)?.[1];

        return {
          checkId: '',
          name: this.stripCheckName(heading),
          description: this.stripHtml(description),
          dismissed: /check-dismissed/i.test(block),
          enforced: /text-bg-warning[^>]*>\s*Enforced/i.test(block),
          documentationUrl,
          recordId: recordId ? Number(recordId) : null,
          documentationId,
        };
      });
  }

  private findParsedCheck(
    checks: ParsedUnitCheck[],
    checkId: string,
  ): WeblateUnitCheck | null {
    const expectedDocumentationIds = new Set([
      `check-${checkId}`,
      `check-${checkId.replace(/_/g, '-')}`,
    ]);
    const match = checks.find((check) =>
      check.documentationId
        ? expectedDocumentationIds.has(check.documentationId)
        : false,
    );
    if (!match) {
      return null;
    }
    const { documentationId: _documentationId, ...result } = match;
    return { ...result, checkId };
  }

  private extractDivsWithClass(html: string, className: string): string[] {
    const tagPattern = /<\/?div\b[^>]*>/gi;
    const stack: Array<{ start: number; target: boolean }> = [];
    const result: string[] = [];
    for (const match of html.matchAll(tagPattern)) {
      const tag = match[0];
      if (/^<\//.test(tag)) {
        const entry = stack.pop();
        if (entry?.target) {
          result.push(html.slice(entry.start, (match.index ?? 0) + tag.length));
        }
        continue;
      }
      const classAttribute = /class=["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
      stack.push({
        start: match.index ?? 0,
        target: classAttribute.split(/\s+/).includes(className),
      });
    }
    return result;
  }

  private stripHtml(value: string): string {
    return this.decodeHtmlEntities(
      value
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
  }

  private stripCheckName(value: string): string {
    return this.stripHtml(
      value
        .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, '')
        .replace(
          /<span\b[^>]*class=["'][^"']*\bred\b[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
          '',
        ),
    );
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, code: string) =>
        String.fromCodePoint(Number(code)),
      )
      .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
        String.fromCodePoint(parseInt(code, 16)),
      );
  }

  private path(value: string): string {
    return encodeURIComponent(value);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
