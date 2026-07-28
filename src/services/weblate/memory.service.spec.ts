import { ConfigService } from '@nestjs/config';
import { type AxiosInstance } from 'axios';
import { WeblateMemoryService } from './memory.service';

describe('WeblateMemoryService', () => {
  it('sends the Weblate memory lookup request with API parameters', async () => {
    const configService = new ConfigService({
      WEBLATE_API_URL: 'http://weblate.test',
      WEBLATE_API_TOKEN: 'test-token',
    });
    const service = new WeblateMemoryService(configService);
    const apiClient = (service as unknown as { apiClient: AxiosInstance })
      .apiClient;
    const post = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: [
        {
          query: 'Offers',
          match: null,
        },
      ],
    });

    await expect(
      service.lookupTranslationMemory(
        'en',
        'ru',
        ['Offers'],
        'ai-proofreader',
        true,
      ),
    ).resolves.toEqual([{ query: 'Offers', match: null }]);

    expect(post).toHaveBeenCalledWith(
      '/memory/lookup/',
      { strings: ['Offers'] },
      {
        params: {
          source_language: 'en',
          target_language: 'ru',
          project: 'ai-proofreader',
          exact: true,
        },
      },
    );
  });
});
