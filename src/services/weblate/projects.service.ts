import { Injectable, Logger } from '@nestjs/common';
import { WeblateClientService } from '../weblate-client.service';
import {
  projectsLabelsRetrieve,
  projectsList,
  projectsRetrieve,
  type Project,
  type UnitFlatLabels,
} from '../../client';

export type ProjectLabel = UnitFlatLabels;

@Injectable()
export class WeblateProjectsService {
  private readonly logger = new Logger(WeblateProjectsService.name);

  constructor(private weblateClientService: WeblateClientService) {}

  async listProjects(): Promise<Project[]> {
    try {
      const client = this.weblateClientService.getClient();
      const response = await projectsList({ client });

      // The generated client returns the response with data field
      const projects = response.data;

      // Check if response.data is an array directly (some APIs return array directly)
      if (Array.isArray(projects)) {
        return projects;
      }

      // Check if response.data.results exists (paginated response)
      if (projects && Array.isArray(projects.results)) {
        return projects.results;
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to list projects', error);
      throw new Error(`Failed to list projects: ${error.message}`);
    }
  }

  async getProject(projectSlug: string): Promise<Project> {
    try {
      const client = this.weblateClientService.getClient();
      const response = await projectsRetrieve({
        client,
        path: { slug: projectSlug },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get project ${projectSlug}`, error);
      throw new Error(`Failed to get project ${projectSlug}: ${error.message}`);
    }
  }

  async listProjectLabels(projectSlug: string): Promise<ProjectLabel[]> {
    try {
      const client = this.weblateClientService.getClient();
      const response = await projectsLabelsRetrieve({
        client,
        path: { slug: projectSlug },
      });
      const payload = response.data as unknown;
      const labels = Array.isArray(payload)
        ? payload
        : (payload as { results?: unknown } | null)?.results;

      return Array.isArray(labels) ? (labels as ProjectLabel[]) : [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Не удалось получить метки проекта ${projectSlug}`,
        error,
      );
      throw new Error(
        `Не удалось получить метки проекта ${projectSlug}: ${message}`,
      );
    }
  }
}
