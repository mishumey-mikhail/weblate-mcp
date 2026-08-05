import { unitsList, unitsPartialUpdate, type Unit } from '../../client';
import { WeblateTranslationsService } from './translations.service';

jest.mock('../../client', () => ({
  unitsList: jest.fn(),
  unitsPartialUpdate: jest.fn(),
}));

describe('WeblateTranslationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('assigns an existing label and preserves current labels', async () => {
    const update = unitsPartialUpdate as jest.Mock;
    const service = new WeblateTranslationsService({
      getClient: jest.fn(() => ({})),
    } as never);
    const unit = {
      id: 42,
      labels: [{ id: 1, name: 'Existing', description: 'Already assigned' }],
    } as Unit;
    jest.spyOn(service, 'getTranslationByKey').mockResolvedValue(unit);
    update.mockResolvedValue({
      data: {
        labels: [
          ...unit.labels,
          { id: 7, name: 'Needs review', color: 'orange' },
        ],
      },
    });

    await expect(
      service.assignLabelToUnit('demo', 'web', 'ru', 'homepage.title', {
        id: 7,
        name: 'Needs review',
        color: 'orange',
      }),
    ).resolves.toMatchObject({
      projectSlug: 'demo',
      componentSlug: 'web',
      languageCode: 'ru',
      key: 'homepage.title',
      assignedLabel: { id: 7, name: 'Needs review', color: 'orange' },
      labels: [
        { id: 1, name: 'Existing', description: 'Already assigned' },
        { id: 7, name: 'Needs review', color: 'orange' },
      ],
    });
    expect(update).toHaveBeenCalledWith({
      client: expect.anything(),
      path: { id: '42' },
      body: {
        labels: [
          { id: 1, name: 'Existing', description: 'Already assigned' },
          { id: 7, name: 'Needs review', color: 'orange' },
        ],
      },
    });
  });

  it('does not update when the translation unit is missing', async () => {
    const update = unitsPartialUpdate as jest.Mock;
    const service = new WeblateTranslationsService({
      getClient: jest.fn(() => ({})),
    } as never);
    jest.spyOn(service, 'getTranslationByKey').mockResolvedValue(null);

    await expect(
      service.assignLabelToUnit('demo', 'web', 'ru', 'missing.key', {
        id: 7,
        name: 'Needs review',
      }),
    ).rejects.toThrow('Юнит перевода с ключом "missing.key" не найден');
    expect(update).not.toHaveBeenCalled();
  });

  it('does not duplicate a label already assigned to the unit', async () => {
    const update = unitsPartialUpdate as jest.Mock;
    const service = new WeblateTranslationsService({
      getClient: jest.fn(() => ({})),
    } as never);
    const label = { id: 7, name: 'Needs review', color: 'orange' as const };
    jest.spyOn(service, 'getTranslationByKey').mockResolvedValue({
      id: 42,
      labels: [label],
    } as Unit);
    update.mockResolvedValue({ data: { labels: [label] } });

    const result = await service.assignLabelToUnit(
      'demo',
      'web',
      'ru',
      'homepage.title',
      label,
    );

    expect(result.labels).toEqual([label]);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ body: { labels: [label] } }),
    );
  });
});
