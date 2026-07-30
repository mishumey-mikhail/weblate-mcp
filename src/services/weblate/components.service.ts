import { Injectable, Logger } from '@nestjs/common';
import { WeblateClientService } from '../weblate-client.service';
import { projectsComponentsRetrieve, type Component } from '../../client';

export function getComponentApiSlug(
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
    // Возвращаем публичный slug, если URL компонента имеет неожиданный формат.
  }

  return component.slug;
}

@Injectable()
export class WeblateComponentsService {
  private readonly logger = new Logger(WeblateComponentsService.name);

  constructor(private weblateClientService: WeblateClientService) {}

  async listComponents(projectSlug: string): Promise<Component[]> {
    try {
      const client = this.weblateClientService.getClient();
      const response = await projectsComponentsRetrieve({
        client,
        path: { slug: projectSlug }
      });
      
      // According to the API comment, this should return a list of components
      // The typing might be incorrect - try to handle both single and array responses
      const components = response.data as any;
      
      if (Array.isArray(components)) {
        return components;
      }
      
      // If it's a paginated response
      if (components && components.results && Array.isArray(components.results)) {
        return components.results;
      }
      
      // If it's a single component, wrap it in an array
      if (components && typeof components === 'object') {
        return [components];
      }
      
      return [];
    } catch (error) {
      this.logger.error(
        `Failed to list components for project ${projectSlug}`,
        error,
      );
      throw new Error(`Failed to list components: ${error.message}`);
    }
  }

  async resolveComponentApiSlug(
    projectSlug: string,
    componentSlug: string,
  ): Promise<string> {
    if (/%2f/i.test(componentSlug)) {
      return componentSlug;
    }

    const components = await this.listComponents(projectSlug);
    const component = components.find(({ slug }) => slug === componentSlug);
    return component
      ? getComponentApiSlug(projectSlug, component)
      : componentSlug;
  }
}
