import { unitsList } from '../../client';
import { WeblateTranslationsService } from './translations.service';

jest.mock('../../client', () => ({
  unitsList: jest.fn(),
}));

describe('WeblateTranslationsService', () => {
  it('uses the public slug in filtered searches for nested components', async () => {
    const list = unitsList as jest.Mock;
    list.mockResolvedValue({ data: { results: [{ id: 1 }] } });
    const service = new WeblateTranslationsService({
      getClient: jest.fn(() => ({})),
    } as never);

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
          q: 'state:<translated AND project:web AND component:glavnaya-stranica AND language:en',
          page_size: 5,
        },
      }),
    );
  });

  it('uses the public component slug in regular translation searches', async () => {
    const list = unitsList as jest.Mock;
    list.mockResolvedValue({ data: { results: [] } });
    const service = new WeblateTranslationsService({
      getClient: jest.fn(() => ({})),
    } as never);

    await service.searchTranslations(
      'web',
      'glavnaya-stranica',
      'en',
      'context:"homepage.buttons.login"',
    );

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          q: 'context:"homepage.buttons.login" project:web component:glavnaya-stranica language:en',
          page_size: 1000,
        },
      }),
    );
  });

  it('uses Weblate has:check syntax for a generic failing-check search', async () => {
    const list = unitsList as jest.Mock;
    list.mockResolvedValue({ data: { results: [{ id: 2 }] } });
    const service = new WeblateTranslationsService({
      getClient: jest.fn(() => ({})),
    } as never);

    await service.searchUnitsWithFailingChecks(
      'web',
      'glavnaya-stranica',
      'en',
      undefined,
      10,
    );

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          q: 'has:check AND project:web AND component:glavnaya-stranica AND language:en',
          page_size: 10,
        },
      }),
    );
  });

  it('supports a specific Weblate check identifier', async () => {
    const list = unitsList as jest.Mock;
    list.mockResolvedValue({ data: { results: [{ id: 3 }] } });
    const service = new WeblateTranslationsService({
      getClient: jest.fn(() => ({})),
    } as never);

    await service.searchUnitsWithFailingChecks(
      'web',
      'glossarij',
      'en',
      'newline-count',
      10,
    );

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          q: 'check:newline-count AND project:web AND component:glossarij AND language:en',
          page_size: 10,
        },
      }),
    );
  });
});
