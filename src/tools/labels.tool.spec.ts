import { WeblateLabelsTool } from './labels.tool';

describe('WeblateLabelsTool', () => {
  it('returns project labels as readable JSON', async () => {
    const service = {
      listProjectLabels: jest.fn().mockResolvedValue([
        {
          id: 7,
          name: 'Needs review',
          description: 'Requires translator review',
          color: 'orange',
        },
      ]),
    };
    const tool = new WeblateLabelsTool(service as never);

    const result = await tool.listProjectLabels({ projectSlug: 'demo' });

    expect(service.listProjectLabels).toHaveBeenCalledWith('demo');
    const content = result.content[0];
    expect(content.type).toBe('text');
    if (content.type !== 'text') {
      throw new Error('Ожидался текстовый MCP-результат');
    }
    expect(JSON.parse(content.text)).toEqual({
      projectSlug: 'demo',
      labels: [
        {
          id: 7,
          name: 'Needs review',
          description: 'Requires translator review',
          color: 'orange',
        },
      ],
    });
  });

  it('returns an MCP error when the API service fails', async () => {
    const service = {
      listProjectLabels: jest.fn().mockRejectedValue(new Error('Not found')),
    };
    const tool = new WeblateLabelsTool(service as never);

    const result = await tool.listProjectLabels({ projectSlug: 'missing' });

    expect(result.isError).toBe(true);
    const content = result.content[0];
    expect(content.type).toBe('text');
    if (content.type !== 'text') {
      throw new Error('Ожидался текстовый MCP-результат');
    }
    expect(content.text).toContain('Not found');
  });

  it('returns the assigned label and final labels as JSON', async () => {
    const service = {
      assignLabelToUnit: jest.fn().mockResolvedValue({
        projectSlug: 'demo',
        componentSlug: 'web',
        languageCode: 'ru',
        key: 'homepage.title',
        verified: true,
        assignedLabel: { id: 7, name: 'Needs review' },
        labels: [
          { id: 1, name: 'Existing' },
          { id: 7, name: 'Needs review' },
        ],
      }),
    };
    const tool = new WeblateLabelsTool(service as never);

    const result = await tool.assignLabelToUnit({
      projectSlug: 'demo',
      componentSlug: 'web',
      languageCode: 'ru',
      key: 'homepage.title',
      labelId: 7,
    });

    expect(service.assignLabelToUnit).toHaveBeenCalledWith(
      'demo',
      'web',
      'ru',
      'homepage.title',
      7,
    );
    const content = result.content[0];
    expect(content.type).toBe('text');
    if (content.type !== 'text') {
      throw new Error('Ожидался текстовый MCP-результат');
    }
    expect(JSON.parse(content.text)).toMatchObject({
      projectSlug: 'demo',
      verified: true,
      assignedLabel: { id: 7, name: 'Needs review' },
    });
  });
});
