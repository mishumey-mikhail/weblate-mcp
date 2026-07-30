import { componentsStatisticsRetrieve } from '../../client';
import { WeblateStatisticsService } from './statistics.service';

jest.mock('../../client', () => ({
  componentsStatisticsRetrieve: jest.fn(),
  languagesStatisticsRetrieve: jest.fn(),
  projectsStatisticsRetrieve: jest.fn(),
  translationsStatisticsRetrieve: jest.fn(),
  usersStatisticsRetrieve: jest.fn(),
}));

describe('WeblateStatisticsService', () => {
  const clientService = {
    getClient: jest.fn(() => ({})),
  };
  const componentsService = {
    listComponents: jest.fn(),
  };
  const languagesService = {
    listLanguages: jest.fn(),
  };

  const createService = (): WeblateStatisticsService =>
    new WeblateStatisticsService(
      clientService as never,
      componentsService as never,
      languagesService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    componentsService.listComponents.mockResolvedValue([]);
  });

  it('aggregates the paginated language statistics returned for a component', async () => {
    const service = createService();
    const retrieve = componentsStatisticsRetrieve as jest.Mock;

    retrieve.mockResolvedValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            total: 100,
            translated: 80,
            approved: 30,
            readonly: 10,
            failing: 2,
            suggestions: 4,
            comments: 1,
          },
          {
            total: 50,
            translated: 25,
            approved: 20,
            readonly: 5,
            failing: 1,
            suggestions: 2,
            comments: 3,
          },
        ],
      },
    });

    await expect(
      service.getComponentStatistics('web', 'glossarij'),
    ).resolves.toMatchObject({
      total: 150,
      translated: 105,
      translated_percent: 70,
      approved: 50,
      approved_percent: (50 / 150) * 100,
      readonly: 15,
      readonly_percent: 10,
      nottranslated: 45,
      nottranslated_percent: 30,
      failing: 3,
      suggestions: 6,
      comments: 4,
    });
  });

  it('keeps structured API errors instead of rendering them as [object Object]', async () => {
    const service = createService();
    const retrieve = componentsStatisticsRetrieve as jest.Mock;

    retrieve.mockResolvedValue({
      error: {
        status: 404,
        detail: 'Component was not found',
      },
    });

    const result = service.getComponentStatistics('web', 'missing');

    await expect(result).rejects.toThrow('status');
    await expect(result).rejects.not.toThrow('[object Object]');
  });

  it('resolves a nested component slug from Weblate statistics_url', async () => {
    const service = createService();
    const retrieve = componentsStatisticsRetrieve as jest.Mock;

    componentsService.listComponents.mockResolvedValue([
      {
        slug: 'glavnaya-stranica',
        statistics_url:
          'http://weblate.test/api/components/web/publichnye-stranicy%252Fglavnaya-stranica/statistics/',
      },
    ]);
    retrieve.mockResolvedValue({
      data: {
        results: [{ total: 1, translated: 1 }],
      },
    });

    await service.getComponentStatistics('web', 'glavnaya-stranica');

    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        path: {
          project__slug: 'web',
          slug: 'publichnye-stranicy%2Fglavnaya-stranica',
        },
      }),
    );
  });

  it('returns aggregated statistics for every component in the dashboard', async () => {
    const service = createService();
    const retrieve = componentsStatisticsRetrieve as jest.Mock;

    jest.spyOn(service, 'getProjectStatistics').mockResolvedValue({
      translated_percent: 80,
      total: 100,
      translated: 80,
    } as never);
    componentsService.listComponents.mockResolvedValue([
      {
        name: 'Glossary',
        slug: 'glossarij',
        statistics_url:
          'http://weblate.test/api/components/web/glossarij/statistics/',
      },
      {
        name: 'Homepage',
        slug: 'glavnaya-stranica',
        statistics_url:
          'http://weblate.test/api/components/web/publichnye-stranicy%252Fglavnaya-stranica/statistics/',
      },
    ]);
    retrieve
      .mockResolvedValueOnce({
        data: {
          results: [{ total: 10, translated: 8 }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          results: [{ total: 20, translated: 10 }],
        },
      });

    await expect(service.getProjectDashboard('web')).resolves.toMatchObject({
      components: [
        {
          component: 'Glossary',
          slug: 'glossarij',
          statistics: { total: 10, translated: 8 },
        },
        {
          component: 'Homepage',
          slug: 'glavnaya-stranica',
          statistics: { total: 20, translated: 10 },
        },
      ],
    });
  });
});
