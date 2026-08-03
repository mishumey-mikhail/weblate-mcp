import { WeblateReadonlyTool } from './readonly.tool';

describe('WeblateReadonlyTool', () => {
  it('exposes unit quality-check details as a read-only JSON result', async () => {
    const service = {
      getUnitChecks: jest.fn().mockResolvedValue({
        unitId: '42',
        scope: {
          projectSlug: 'web',
          componentSlug: 'glavnaya-stranica',
          languageCode: 'en',
        },
        hasFailingCheck: true,
        discoveredCheckIds: ['same'],
        checks: [
          {
            checkId: 'same',
            name: 'Unchanged translation',
            description: 'Source and translation are identical.',
            dismissed: false,
            enforced: false,
            documentationUrl: null,
            recordId: 77,
          },
        ],
        detailsAvailable: true,
        limitations: [],
      }),
    };
    const tool = new WeblateReadonlyTool(service as never);

    const result = await tool.getUnitChecks({
      projectSlug: 'web',
      componentSlug: 'glavnaya-stranica',
      languageCode: 'en',
      unitId: '42',
    });

    expect(service.getUnitChecks).toHaveBeenCalledWith(
      'web',
      'glavnaya-stranica',
      'en',
      '42',
    );
    expect(result.content[0].text).toContain('"checkId": "same"');
    expect(result.content[0].text).toContain('"detailsAvailable": true');
  });
});
