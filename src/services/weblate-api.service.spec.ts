import { WeblateApiService } from './weblate-api.service';

describe('WeblateApiService label assignment', () => {
  it('rejects a label that does not belong to the project', async () => {
    const projectsService = {
      listProjectLabels: jest
        .fn()
        .mockResolvedValue([{ id: 7, name: 'Needs review' }]),
    };
    const translationsService = {
      assignLabelToUnit: jest.fn(),
    };
    const service = new WeblateApiService(
      projectsService as never,
      {} as never,
      {} as never,
      translationsService as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.assignLabelToUnit(
        'demo',
        'web',
        'ru',
        'homepage.title',
        99,
        'Review this translation',
      ),
    ).rejects.toThrow('Метка с ID 99 не найдена в проекте demo');
    expect(translationsService.assignLabelToUnit).not.toHaveBeenCalled();
  });
});
