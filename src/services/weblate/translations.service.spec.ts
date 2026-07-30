import { unitsList } from '../../client';
import { WeblateTranslationsService } from './translations.service';

jest.mock('../../client', () => ({
  unitsList: jest.fn(),
}));

describe('WeblateTranslationsService', () => {
  it('uses the nested component API slug in filtered unit searches', async () => {
    const list = unitsList as jest.Mock;
    list.mockResolvedValue({ data: { results: [{ id: 1 }] } });
    const service = new WeblateTranslationsService(
      { getClient: jest.fn(() => ({})) } as never,
      {
        resolveComponentApiSlug: jest
          .fn()
          .mockResolvedValue('publichnye-stranicy%2Fglavnaya-stranica'),
      } as never,
    );

    await service.searchUnitsWithQuery(
      'web',
      'glavnaya-stranica',
      'en',
      'state:<translated',
      5,
    );

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          q: 'state:<translated AND project:web AND component:publichnye-stranicy/glavnaya-stranica AND language:en',
          page_size: 5,
        },
      }),
    );
  });
});
