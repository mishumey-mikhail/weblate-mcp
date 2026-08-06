import { ConfigService } from '@nestjs/config';
import { type AxiosInstance } from 'axios';
import { WeblateReadonlyService } from './readonly.service';

describe('WeblateReadonlyService', () => {
  const createService = (): WeblateReadonlyService =>
    new WeblateReadonlyService(
      new ConfigService({
        WEBLATE_API_URL: 'http://weblate.test',
        WEBLATE_API_TOKEN: 'test-token',
      }),
      {
        resolveComponentApiSlug: jest.fn(
          (_projectSlug: string, componentSlug: string) =>
            Promise.resolve(componentSlug),
        ),
      } as never,
      {
        searchUnitsWithFailingChecks: jest.fn().mockResolvedValue([]),
      } as never,
    );

  it('resolves effective labels from the source unit', async () => {
    const service = createService();
    const apiClient = (service as unknown as { apiClient: AxiosInstance })
      .apiClient;
    const get = jest.spyOn(apiClient, 'get');
    get
      .mockResolvedValueOnce({
        data: {
          id: 42,
          source_unit: 'https://weblate.test/api/units/24/',
          labels: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 24,
          labels: [{ id: 7, name: 'Точность: Пропуск' }],
          explanation: 'MQM: Точность: Пропуск. Причина: пропущен текст.',
        },
      });

    await expect(service.getUnitDetails('42')).resolves.toMatchObject({
      id: 42,
      labels: [{ id: 7, name: 'Точность: Пропуск' }],
      unit_labels: [],
      source_unit_id: '24',
      source_unit_labels: [{ id: 7, name: 'Точность: Пропуск' }],
      effective_labels: [{ id: 7, name: 'Точность: Пропуск' }],
      labels_owner: 'source_unit',
      source_unit_explanation:
        'MQM: Точность: Пропуск. Причина: пропущен текст.',
    });
  });

  it('reads unit comments with pagination', async () => {
    const service = createService();
    const apiClient = (service as unknown as { apiClient: AxiosInstance })
      .apiClient;
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 7,
            comment: 'Check terminology',
            scope: 'translation',
            user: 'https://weblate.test/api/users/reviewer/',
          },
        ],
      },
    });

    await expect(service.getUnitComments('42', 2, 25)).resolves.toMatchObject({
      count: 1,
      results: [{ id: 7 }],
    });
    expect(get).toHaveBeenCalledWith('/units/42/comments/', {
      params: { page: 2, page_size: 25 },
    });
  });

  it('filters translation history by unit URL', async () => {
    const service = createService();
    const apiClient = (service as unknown as { apiClient: AxiosInstance })
      .apiClient;
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            id: 0,
            unit: null,
            action_name: 'Repository updated',
            timestamp: '2025-01-01T00:00:00Z',
            author: 'system',
          },
          {
            id: 2,
            unit: 'https://weblate.test/api/units/42/',
            action_name: 'Translation changed',
            timestamp: '2025-01-01T00:00:00Z',
            author: 'reviewer',
          },
          {
            id: 2,
            unit: 'https://weblate.test/api/units/43/',
            action_name: 'Translation changed',
            timestamp: '2025-01-01T00:00:00Z',
            author: 'reviewer',
          },
        ],
      },
    });

    await expect(
      service.getUnitHistory('project', 'component', 'en', '42', 50),
    ).resolves.toEqual([expect.objectContaining({ id: 2 })]);
  });

  it('resolves screenshots associated with a unit and their image URL', async () => {
    const service = createService();
    const apiClient = (service as unknown as { apiClient: AxiosInstance })
      .apiClient;
    const get = jest.spyOn(apiClient, 'get');
    get.mockResolvedValueOnce({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            id: 10,
            name: 'Login screen',
            translation: 'https://weblate.test/api/translations/1/',
            file_url: 'https://weblate.test/api/screenshots/10/file/',
            units: ['https://weblate.test/api/units/42/'],
            url: 'https://weblate.test/api/screenshots/10/',
          },
          {
            id: 11,
            name: 'Other screen',
            translation: 'https://weblate.test/api/translations/1/',
            file_url: 'https://weblate.test/api/screenshots/11/file/',
            units: ['https://weblate.test/api/units/43/'],
            url: 'https://weblate.test/api/screenshots/11/',
          },
        ],
      },
    });
    get.mockResolvedValueOnce({
      data: { image: 'https://weblate.test/media/screenshots/10.png' },
    });

    await expect(
      service.getUnitScreenshots('project', 'component', '42'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 10,
        image_url: 'https://weblate.test/media/screenshots/10.png',
      }),
    ]);
    expect(get).toHaveBeenNthCalledWith(2, '/screenshots/10/file/', {
      params: undefined,
    });
  });

  it('selects the read-only repository endpoint by scope', async () => {
    const service = createService();
    const apiClient = (service as unknown as { apiClient: AxiosInstance })
      .apiClient;
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        needs_commit: false,
        needs_merge: true,
        needs_push: false,
        url: 'https://weblate.test/api/translations/1/repository/',
      },
    });

    await service.getRepositoryStatus(
      'translation',
      'project',
      'component',
      'en',
    );
    expect(get).toHaveBeenCalledWith(
      '/translations/project/component/en/repository/',
      { params: undefined },
    );
  });

  it('uses the encoded API slug for nested component details', async () => {
    const resolveComponentApiSlug = jest
      .fn()
      .mockResolvedValue('publichnye-stranicy%2Fglavnaya-stranica');
    const service = new WeblateReadonlyService(
      new ConfigService({
        WEBLATE_API_URL: 'http://weblate.test',
        WEBLATE_API_TOKEN: 'test-token',
      }),
      { resolveComponentApiSlug } as never,
      {
        searchUnitsWithFailingChecks: jest.fn().mockResolvedValue([]),
      } as never,
    );
    const apiClient = (service as unknown as { apiClient: AxiosInstance })
      .apiClient;
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: { slug: 'glavnaya-stranica' },
    });

    await service.getComponentDetails('web', 'glavnaya-stranica');

    expect(get).toHaveBeenCalledWith(
      '/components/web/publichnye-stranicy%252Fglavnaya-stranica/',
      { params: undefined },
    );
  });

  it('resolves failing check IDs and descriptions from read-only Weblate pages', async () => {
    const service = createService();
    const apiClient = (service as unknown as { apiClient: AxiosInstance })
      .apiClient;
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        id: 42,
        has_failing_check: true,
        web_url:
          'https://weblate.test/translate/web/glavnaya-stranica/en/?checksum=abc',
      },
    });
    const webClient = (service as unknown as { webClient: AxiosInstance })
      .webClient;
    const webGet = jest.spyOn(webClient, 'get');
    webGet.mockResolvedValueOnce({
      data: '<a href="/checks/same/web/glavnaya-stranica/en/">Same</a>',
    });
    webGet.mockResolvedValueOnce({
      data: `<div class="list-group-item check check-item">
        <h5><a href="https://docs.weblate.org/en/latest/user/checks.html#check-same">doc</a><span class="red">!</span>Unchanged translation</h5>
        <p class="list-group-item-text check-description">Source and translation are identical.</p>
        <a href="/js/ignore-check/77/">ignore</a>
      </div>`,
    });
    const translationsService = (
      service as unknown as {
        translationsService: {
          searchUnitsWithFailingChecks: jest.Mock;
        };
      }
    ).translationsService;
    translationsService.searchUnitsWithFailingChecks.mockResolvedValue([
      { id: 42 },
    ]);

    await expect(
      service.getUnitChecks('web', 'glavnaya-stranica', 'en', '42'),
    ).resolves.toMatchObject({
      hasFailingCheck: true,
      discoveredCheckIds: ['same'],
      detailsAvailable: true,
      checks: [
        {
          checkId: 'same',
          name: 'Unchanged translation',
          description: 'Source and translation are identical.',
          recordId: 77,
        },
      ],
    });
    expect(
      translationsService.searchUnitsWithFailingChecks,
    ).toHaveBeenCalledWith('web', 'glavnaya-stranica', 'en', 'same', 200);
    expect(webGet).toHaveBeenNthCalledWith(
      1,
      '/checks/-/web/glavnaya-stranica/en/',
      {
        headers: { Accept: 'text/html' },
      },
    );
    expect(webGet).toHaveBeenNthCalledWith(
      2,
      '/translate/web/glavnaya-stranica/en/?checksum=abc',
      {
        headers: { Accept: 'text/html' },
      },
    );
  });

  it('returns a controlled limitation when the Weblate UI is unavailable', async () => {
    const service = createService();
    const apiClient = (service as unknown as { apiClient: AxiosInstance })
      .apiClient;
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        id: 42,
        has_failing_check: true,
        web_url:
          'https://weblate.test/translate/web/component/en/?checksum=abc',
      },
    });
    const webClient = (service as unknown as { webClient: AxiosInstance })
      .webClient;
    jest
      .spyOn(webClient, 'get')
      .mockRejectedValue(new Error('503 unavailable'));

    await expect(
      service.getUnitChecks('web', 'component', 'en', '42'),
    ).resolves.toMatchObject({
      hasFailingCheck: true,
      checks: [],
      detailsAvailable: false,
      limitations: [expect.stringContaining('503 unavailable')],
    });
  });
});
