import {
  unitsList,
  unitsPartialUpdate,
  unitsRetrieve,
  type Unit,
} from '../../client';
import { WeblateTranslationsService } from './translations.service';

jest.mock('../../client', () => ({
  unitsList: jest.fn(),
  unitsPartialUpdate: jest.fn(),
  unitsRetrieve: jest.fn(),
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

  it('changes only the translation state', async () => {
    const update = unitsPartialUpdate as jest.Mock;
    const service = new WeblateTranslationsService({
      getClient: jest.fn(() => ({})),
    } as never);
    jest.spyOn(service, 'getTranslationByKey').mockResolvedValue({
      id: 42,
      state: 10,
      target: ['Existing translation'],
    } as Unit);
    update.mockResolvedValue({
      data: {
        id: 42,
        state: 20,
        target: ['Existing translation'],
      },
    });

    await expect(
      service.setTranslationState(
        'demo',
        'web',
        'en',
        'homepage.title',
        20,
      ),
    ).resolves.toMatchObject({
      id: 42,
      state: 20,
      target: ['Existing translation'],
    });

    expect(update).toHaveBeenCalledWith({
      client: expect.anything(),
      path: { id: '42' },
      body: {
        state: 20,
        target: ['Existing translation'],
      },
    });
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
      service.assignLabelToUnit(
        'demo',
        'web',
        'ru',
        'homepage.title',
        {
          id: 7,
          name: 'Needs review',
          color: 'orange',
        },
        'Review this translation',
      ),
    ).resolves.toMatchObject({
      projectSlug: 'demo',
      componentSlug: 'web',
      languageCode: 'ru',
      key: 'homepage.title',
      explanation: 'Review this translation',
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
        labels: [1, 7],
        explanation: 'Review this translation',
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
      service.assignLabelToUnit(
        'demo',
        'web',
        'ru',
        'missing.key',
        {
          id: 7,
          name: 'Needs review',
        },
        'Missing unit test',
      ),
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
      'Already assigned',
    );

    expect(result.labels).toEqual([label]);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { labels: [7], explanation: 'Already assigned' },
      }),
    );
  });

  it('updates the source unit and preserves its existing explanation', async () => {
    const retrieve = unitsRetrieve as jest.Mock;
    const update = unitsPartialUpdate as jest.Mock;
    const service = new WeblateTranslationsService({
      getClient: jest.fn(() => ({})),
    } as never);
    const label = { id: 7, name: 'Needs review', color: 'orange' as const };
    const sourceUnit = {
      id: 24,
      labels: [{ id: 1, name: 'Existing' }],
      explanation: 'Existing source context',
      source_unit: 'https://weblate.test/api/units/24/',
    } as Unit;

    jest.spyOn(service, 'getTranslationByKey').mockResolvedValue({
      id: 42,
      labels: [],
      source_unit: 'https://weblate.test/api/units/24/',
    } as Unit);
    retrieve.mockResolvedValue({ data: sourceUnit });
    update.mockResolvedValue({
      data: {
        labels: [1, 7],
        explanation: 'Existing source context\n\nNew explanation',
      },
    });

    await expect(
      service.assignLabelToUnit(
        'demo',
        'web',
        'ru',
        'homepage.title',
        label,
        'New explanation',
      ),
    ).resolves.toMatchObject({
      labels: [{ id: 1, name: 'Existing' }, label],
      explanation: 'Existing source context\n\nNew explanation',
    });

    expect(retrieve).toHaveBeenCalledWith({
      client: expect.anything(),
      path: { id: '24' },
    });
    expect(update).toHaveBeenCalledWith({
      client: expect.anything(),
      path: { id: '24' },
      body: {
        labels: [1, 7],
        explanation: 'Existing source context\n\nNew explanation',
      },
    });
  });
});
