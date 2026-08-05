import { projectsLabelsRetrieve } from '../../client';
import { WeblateProjectsService } from './projects.service';

jest.mock('../../client', () => ({
  projectsLabelsRetrieve: jest.fn(),
  projectsList: jest.fn(),
  projectsRetrieve: jest.fn(),
}));

describe('WeblateProjectsService', () => {
  const retrieveLabels = projectsLabelsRetrieve as jest.Mock;
  const clientService = {
    getClient: jest.fn(() => ({})),
  };
  let service: WeblateProjectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WeblateProjectsService(clientService as never);
  });

  it('lists project labels from the Weblate API', async () => {
    retrieveLabels.mockResolvedValue({
      data: [
        {
          id: 7,
          name: 'Needs review',
          description: 'Requires translator review',
          color: 'orange',
        },
      ],
    });

    await expect(service.listProjectLabels('demo')).resolves.toEqual([
      {
        id: 7,
        name: 'Needs review',
        description: 'Requires translator review',
        color: 'orange',
      },
    ]);
    expect(retrieveLabels).toHaveBeenCalledWith({
      client: clientService.getClient(),
      path: { slug: 'demo' },
    });
  });

  it('returns an empty list when the project has no labels', async () => {
    retrieveLabels.mockResolvedValue({ data: [] });

    await expect(service.listProjectLabels('demo')).resolves.toEqual([]);
  });

  it('returns a useful error when the Weblate API request fails', async () => {
    retrieveLabels.mockRejectedValue(new Error('Not found'));

    await expect(service.listProjectLabels('missing')).rejects.toThrow(
      'Не удалось получить метки проекта missing: Not found',
    );
  });
});
