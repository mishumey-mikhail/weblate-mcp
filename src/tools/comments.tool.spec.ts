import { WeblateCommentsTool } from './comments.tool';

describe('WeblateCommentsTool', () => {
  it('adds a comment to the target translation unit', async () => {
    const service = {
      addUnitComment: jest.fn().mockResolvedValue({
        projectSlug: 'demo',
        componentSlug: 'web',
        languageCode: 'en',
        key: 'homepage.title',
        unitId: '42',
        scope: 'translation',
        comment: 'MQM: Needs review. Причина: найдено расхождение.',
        commentId: 77,
      }),
    };
    const tool = new WeblateCommentsTool(service as never);

    const result = await tool.addUnitComment({
      projectSlug: 'demo',
      componentSlug: 'web',
      languageCode: 'en',
      key: 'homepage.title',
      comment: '  MQM: Needs review. Причина: найдено расхождение.  ',
    });

    expect(service.addUnitComment).toHaveBeenCalledWith(
      'demo',
      'web',
      'en',
      'homepage.title',
      'MQM: Needs review. Причина: найдено расхождение.',
    );
    const content = result.content[0];
    expect(content.type).toBe('text');
    if (content.type !== 'text') {
      throw new Error('Ожидался текстовый MCP-результат');
    }
    expect(JSON.parse(content.text)).toMatchObject({
      unitId: '42',
      scope: 'translation',
      commentId: 77,
    });
  });

  it('returns an MCP error when adding a comment fails', async () => {
    const service = {
      addUnitComment: jest
        .fn()
        .mockRejectedValue(new Error('Weblate unavailable')),
    };
    const tool = new WeblateCommentsTool(service as never);

    const result = await tool.addUnitComment({
      projectSlug: 'demo',
      componentSlug: 'web',
      languageCode: 'en',
      key: 'homepage.title',
      comment: 'MQM: Needs review.',
    });

    expect(result.isError).toBe(true);
    const content = result.content[0];
    expect(content.type).toBe('text');
    if (content.type !== 'text') {
      throw new Error('Ожидался текстовый MCP-результат');
    }
    expect(content.text).toContain('Weblate unavailable');
  });
});
