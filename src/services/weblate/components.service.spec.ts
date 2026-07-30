import { projectsComponentsRetrieve } from '../../client';
import { WeblateComponentsService } from './components.service';

jest.mock('../../client', () => ({
  projectsComponentsRetrieve: jest.fn(),
}));

describe('WeblateComponentsService', () => {
  it('resolves the API slug for a nested component', async () => {
    const retrieve = projectsComponentsRetrieve as jest.Mock;
    retrieve.mockResolvedValue({
      data: [
        {
          slug: 'glavnaya-stranica',
          statistics_url:
            'http://weblate.test/api/components/web/publichnye-stranicy%252Fglavnaya-stranica/statistics/',
        },
      ],
    });
    const service = new WeblateComponentsService({
      getClient: jest.fn(() => ({})),
    } as never);

    await expect(
      service.resolveComponentApiSlug('web', 'glavnaya-stranica'),
    ).resolves.toBe('publichnye-stranicy%2Fglavnaya-stranica');
  });
});
