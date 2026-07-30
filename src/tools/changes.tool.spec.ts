import { WeblateChangesTool } from './changes.tool';

describe('WeblateChangesTool', () => {
  it('includes change IDs in read-only change listings', async () => {
    const service = {
      listRecentChanges: jest.fn().mockResolvedValue({
        count: 1,
        results: [
          {
            id: 14060,
            action: 2,
            user: 'admin',
            timestamp: '2025-01-01T00:00:00Z',
            target: 'Betting Company',
          },
        ],
      }),
    };
    const tool = new WeblateChangesTool(service as never);

    const result = await tool.listRecentChanges({ limit: 20 });
    const text = result.content[0].text;

    expect(text).toContain('**ID:** 14060');
  });
});
