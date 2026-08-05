import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import {
  WeblateApiService,
  WeblateProjectsService,
  WeblateComponentsService,
  WeblateLanguagesService,
  WeblateTranslationsService,
  WeblateChangesService,
  WeblateStatisticsService,
  WeblateMemoryService,
  WeblateReadonlyService,
} from './services';
import { WeblateClientService } from './services/weblate-client.service';
import {
  WeblateProjectsTool,
  WeblateComponentsTool,
  WeblateLanguagesTool,
  WeblateTranslationsTool,
  WeblateChangesTool,
  WeblateStatisticsTool,
  WeblateMemoryTool,
  WeblateReadonlyTool,
  WeblateLabelsTool,
} from './tools';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    McpModule.forRoot({
      name: process.env.MCP_SERVER_NAME || 'weblate-mcp-server',
      version: process.env.MCP_SERVER_VERSION || '1.0.0',
      transport: McpTransportType.STDIO,
      instructions: `This is a Weblate MCP server that provides tools for managing translations.
      
Available tools:
Translation Management:
- listProjects: List all available Weblate projects
- listProjectLabels: Список доступных меток указанного проекта Weblate
- listComponents: List components in a specific project
- listLanguages: List languages available in a specific project
- searchStringInProject: Search for translations containing specific text
- searchUnitsWithFailingChecks: Search read-only units with failing quality checks
- getTranslationForKey: Get translation value for a specific key
- writeTranslation: Write or update a translation value
- searchTranslationsByKey: Search for translations by key pattern
- findTranslationsForKey: Find all translations for a specific key
- listTranslationKeys: List all translation keys in a project
- searchTranslationKeys: Search for translation keys by pattern

Translation Memory:
- lookupTranslationMemory: Look up read-only translation memory matches for source strings
- listTranslationMemory: List filtered read-only Translation Memory entries
- getTranslationMemoryEntry: Get one read-only Translation Memory entry

Translation Case Context (read-only):
- getUnitDetails: Get complete details for one translation unit
- getUnitChecks: Get quality check IDs, names, descriptions, and limitations for one unit
- getUnitComments: Get comments attached to a translation unit
- getUnitHistory: Get history for a translation unit
- getChangeDetails: Get details for one translation change
- getTranslationDetails: Get translation metadata and statistics
- getProjectDetails: Get project metadata and configuration
- getComponentDetails: Get component metadata and configuration
- getUnitScreenshots: Get screenshots associated with a translation unit
- listTranslationUnits: List units for an exact project/component/language scope
- getRepositoryStatus: Get repository synchronization status

Change Tracking & History:
- listRecentChanges: List recent changes across all projects
- getProjectChanges: Get recent changes for a specific project
- getComponentChanges: Get recent changes for a specific component
- getChangesByUser: Get recent changes by a specific user

Translation Statistics Dashboard:
- getProjectStatistics: Get comprehensive project statistics with completion rates
- getComponentStatistics: Get detailed statistics for a specific component
- getProjectDashboard: Get full dashboard overview with all component statistics
- getTranslationStatistics: Get statistics for specific translation (project/component/language)
- getComponentLanguageProgress: Get translation progress for all languages in a component
- getLanguageStatistics: Get statistics for a language across all projects
- getUserStatistics: Get contribution statistics for a specific user`,
    }),
  ],
  providers: [
    WeblateClientService,
    WeblateProjectsService,
    WeblateComponentsService,
    WeblateLanguagesService,
    WeblateTranslationsService,
    WeblateChangesService,
    WeblateApiService,
    WeblateStatisticsService,
    WeblateMemoryService,
    WeblateReadonlyService,
    WeblateProjectsTool,
    WeblateLabelsTool,
    WeblateComponentsTool,
    WeblateLanguagesTool,
    WeblateTranslationsTool,
    WeblateChangesTool,
    WeblateStatisticsTool,
    WeblateMemoryTool,
    WeblateReadonlyTool,
  ],
})
export class AppModule {}
