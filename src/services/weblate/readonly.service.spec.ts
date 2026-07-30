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
    );

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
});
