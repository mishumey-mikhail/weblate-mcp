import { Injectable } from '@nestjs/common';
import {
  WeblateProjectsService,
  WeblateComponentsService,
  WeblateLanguagesService,
  WeblateTranslationsService,
  WeblateChangesService,
  WeblateMemoryService,
  WeblateReadonlyService,
  type AssignLabelToUnitResult,
  type ProjectLabel,
} from './weblate';
import {
  type Project,
  type Component,
  type Language,
  type Unit,
  type Change,
} from '../client';
import {
  type SearchIn,
  type TranslationMemoryLookupResult,
  type WeblateChangeDetails,
  type WeblateComment,
  type WeblatePaginatedResponse,
  type WeblateRepositoryStatus,
  type WeblateScreenshot,
  type WeblateTranslationMemoryEntry,
  type WeblateUnitChecksResult,
} from '../types';

@Injectable()
export class WeblateApiService {
  constructor(
    private readonly projectsService: WeblateProjectsService,
    private readonly componentsService: WeblateComponentsService,
    private readonly languagesService: WeblateLanguagesService,
    private readonly translationsService: WeblateTranslationsService,
    private readonly changesService: WeblateChangesService,
    private readonly memoryService: WeblateMemoryService,
    private readonly readonlyService: WeblateReadonlyService,
  ) {}

  // Project methods
  async listProjects(): Promise<Project[]> {
    return this.projectsService.listProjects();
  }

  async getProject(projectSlug: string): Promise<Project> {
    return this.projectsService.getProject(projectSlug);
  }

  async listProjectLabels(projectSlug: string): Promise<ProjectLabel[]> {
    return this.projectsService.listProjectLabels(projectSlug);
  }

  async assignLabelToUnit(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    key: string,
    labelId: number,
  ): Promise<AssignLabelToUnitResult> {
    const labels = await this.projectsService.listProjectLabels(projectSlug);
    const label = labels.find(({ id }) => id === labelId);

    if (!label) {
      throw new Error(
        `Метка с ID ${labelId} не найдена в проекте ${projectSlug}`,
      );
    }

    return this.translationsService.assignLabelToUnit(
      projectSlug,
      componentSlug,
      languageCode,
      key,
      label,
    );
  }

  // Component methods
  async listComponents(projectSlug: string): Promise<Component[]> {
    return this.componentsService.listComponents(projectSlug);
  }

  // Language methods
  async listLanguages(projectSlug: string): Promise<Language[]> {
    return this.languagesService.listLanguages(projectSlug);
  }

  // Translation methods
  async searchTranslations(
    projectSlug: string,
    componentSlug?: string,
    languageCode?: string,
    query?: string,
    source?: string,
    target?: string,
  ): Promise<{
    results: Unit[];
    count: number;
    next?: string;
    previous?: string;
  }> {
    return this.translationsService.searchTranslations(
      projectSlug,
      componentSlug,
      languageCode,
      query,
      source,
      target,
    );
  }

  async getTranslationByKey(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    key: string,
  ): Promise<Unit | null> {
    return this.translationsService.getTranslationByKey(
      projectSlug,
      componentSlug,
      languageCode,
      key,
    );
  }

  async searchStringInProject(
    projectSlug: string,
    searchValue: string,
    searchIn: SearchIn = 'both',
  ): Promise<Unit[]> {
    return this.translationsService.searchStringInProject(
      projectSlug,
      searchValue,
      searchIn,
    );
  }

  async writeTranslation(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    key: string,
    value: string,
    markAsApproved: boolean = false,
  ): Promise<Unit | null> {
    return this.translationsService.writeTranslation(
      projectSlug,
      componentSlug,
      languageCode,
      key,
      value,
      markAsApproved,
    );
  }

  async bulkWriteTranslations(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    translations: Array<{
      key: string;
      value: string;
      markAsApproved?: boolean;
    }>,
  ): Promise<{
    successful: Array<{ key: string; unit: Unit }>;
    failed: Array<{ key: string; error: string }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    return this.translationsService.bulkWriteTranslations(
      projectSlug,
      componentSlug,
      languageCode,
      translations,
    );
  }

  async searchTranslationKeys(
    projectSlug: string,
    keyPattern: string,
    componentSlug?: string,
  ): Promise<string[]> {
    return this.translationsService.searchTranslationKeys(
      projectSlug,
      keyPattern,
      componentSlug,
    );
  }

  async findTranslationsForKey(
    projectSlug: string,
    key: string,
    componentSlug?: string,
  ): Promise<Unit[]> {
    return this.translationsService.findTranslationsForKey(
      projectSlug,
      key,
      componentSlug,
    );
  }

  async listTranslationKeys(
    projectSlug: string,
    componentSlug?: string,
    languageCode?: string,
  ): Promise<string[]> {
    return this.translationsService.listTranslationKeys(
      projectSlug,
      componentSlug,
      languageCode,
    );
  }

  // Change tracking methods
  async listRecentChanges(
    limit: number = 50,
    user?: string,
    timestampAfter?: string,
    timestampBefore?: string,
  ): Promise<{
    results: Change[];
    count: number;
    next?: string;
    previous?: string;
  }> {
    return this.changesService.listRecentChanges(
      limit,
      user,
      timestampAfter,
      timestampBefore,
    );
  }

  async getProjectChanges(projectSlug: string) {
    return this.changesService.getProjectChanges(projectSlug);
  }

  async getComponentChanges(projectSlug: string, componentSlug: string) {
    return this.changesService.getComponentChanges(projectSlug, componentSlug);
  }

  async getChangesByAction(actionCodes: number[], limit: number = 50) {
    return this.changesService.getChangesByAction(actionCodes, limit);
  }

  async getChangesByUser(user: string, limit: number = 50) {
    return this.changesService.getChangesByUser(user, limit);
  }

  async searchUnitsWithQuery(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    searchQuery: string,
    limit: number = 50,
  ): Promise<Unit[]> {
    return this.translationsService.searchUnitsWithQuery(
      projectSlug,
      componentSlug,
      languageCode,
      searchQuery,
      limit,
    );
  }

  async searchUnitsWithFailingChecks(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    checkId?: string,
    limit = 50,
  ): Promise<Unit[]> {
    return this.translationsService.searchUnitsWithFailingChecks(
      projectSlug,
      componentSlug,
      languageCode,
      checkId,
      limit,
    );
  }

  // Translation Memory methods
  async lookupTranslationMemory(
    sourceLanguage: string,
    targetLanguage: string,
    strings: string[],
    projectSlug?: string,
    exact: boolean = false,
  ): Promise<TranslationMemoryLookupResult[]> {
    return this.memoryService.lookupTranslationMemory(
      sourceLanguage,
      targetLanguage,
      strings,
      projectSlug,
      exact,
    );
  }

  async getUnitDetails(unitId: string): Promise<Unit> {
    return this.readonlyService.getUnitDetails(unitId);
  }

  async getUnitChecks(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    unitId: string,
  ): Promise<WeblateUnitChecksResult> {
    return this.readonlyService.getUnitChecks(
      projectSlug,
      componentSlug,
      languageCode,
      unitId,
    );
  }

  async getUnitComments(
    unitId: string,
    page = 1,
    pageSize = 100,
  ): Promise<WeblatePaginatedResponse<WeblateComment>> {
    return this.readonlyService.getUnitComments(unitId, page, pageSize);
  }

  async getUnitHistory(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    unitId: string,
    limit = 100,
  ): Promise<WeblateChangeDetails[]> {
    return this.readonlyService.getUnitHistory(
      projectSlug,
      componentSlug,
      languageCode,
      unitId,
      limit,
    );
  }

  async getChangeDetails(changeId: string): Promise<WeblateChangeDetails> {
    return this.readonlyService.getChangeDetails(changeId);
  }

  async getTranslationDetails(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
  ): Promise<Record<string, unknown>> {
    return this.readonlyService.getTranslationDetails(
      projectSlug,
      componentSlug,
      languageCode,
    );
  }

  async getProjectDetails(projectSlug: string): Promise<Project> {
    return this.readonlyService.getProjectDetails(projectSlug);
  }

  async getComponentDetails(
    projectSlug: string,
    componentSlug: string,
  ): Promise<Component> {
    return this.readonlyService.getComponentDetails(projectSlug, componentSlug);
  }

  async listTranslationMemory(
    projectSlug?: string,
    source?: string,
    sourceLanguage?: string,
    targetLanguage?: string,
    page = 1,
    pageSize = 100,
  ): Promise<WeblatePaginatedResponse<WeblateTranslationMemoryEntry>> {
    return this.memoryService.listTranslationMemory(
      projectSlug,
      source,
      sourceLanguage,
      targetLanguage,
      page,
      pageSize,
    );
  }

  async getTranslationMemoryEntry(
    memoryId: string,
  ): Promise<WeblateTranslationMemoryEntry> {
    return this.memoryService.getTranslationMemoryEntry(memoryId);
  }

  async getUnitScreenshots(
    projectSlug: string,
    componentSlug: string,
    unitId: string,
  ): Promise<WeblateScreenshot[]> {
    return this.readonlyService.getUnitScreenshots(
      projectSlug,
      componentSlug,
      unitId,
    );
  }

  async listTranslationUnits(
    projectSlug: string,
    componentSlug: string,
    languageCode: string,
    page = 1,
    pageSize = 100,
  ): Promise<WeblatePaginatedResponse<Unit>> {
    return this.readonlyService.listTranslationUnits(
      projectSlug,
      componentSlug,
      languageCode,
      page,
      pageSize,
    );
  }

  async getRepositoryStatus(
    scope: 'project' | 'component' | 'translation',
    projectSlug: string,
    componentSlug?: string,
    languageCode?: string,
  ): Promise<WeblateRepositoryStatus> {
    return this.readonlyService.getRepositoryStatus(
      scope,
      projectSlug,
      componentSlug,
      languageCode,
    );
  }
}
