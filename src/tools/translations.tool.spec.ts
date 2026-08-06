import { WeblateTranslationsTool } from './translations.tool';

describe('WeblateTranslationsTool', () => {
  it('changes a translation state without changing its text', async () => {
    const service = {
      setTranslationState: jest.fn().mockResolvedValue({
        unit: {
          context: 'homepage.title',
          source: ['Заголовок'],
          target: ['Title'],
          state: 20,
          approved: false,
          translated: true,
          id: 42,
        },
        previousState: 10,
        requestedState: 20,
        verifiedState: 20,
        verified: true,
        textUnchanged: true,
      }),
    };
    const tool = new WeblateTranslationsTool(service as never);

    const result = await tool.setTranslationState({
      projectSlug: 'demo',
      componentSlug: 'web',
      languageCode: 'en',
      key: 'homepage.title',
      state: 20,
    });

    expect(service.setTranslationState).toHaveBeenCalledWith(
      'demo',
      'web',
      'en',
      'homepage.title',
      20,
    );
    const content = result.content[0];
    expect(content.type).toBe('text');
    if (content.type !== 'text') {
      throw new Error('Ожидался текстовый MCP-результат');
    }
    expect(content.text).toContain('изменён на 20');
    expect(content.text).toContain('**Target:** Title');
    expect(content.text).toContain('Проверено чтением после записи');
    expect(content.text).toContain('**State:** 20');
  });

  it('returns an MCP error when state update fails', async () => {
    const service = {
      setTranslationState: jest
        .fn()
        .mockRejectedValue(new Error('Weblate API error')),
    };
    const tool = new WeblateTranslationsTool(service as never);

    const result = await tool.setTranslationState({
      projectSlug: 'demo',
      componentSlug: 'web',
      languageCode: 'en',
      key: 'homepage.title',
      state: 20,
    });

    expect(result.isError).toBe(true);
    const content = result.content[0];
    expect(content.type).toBe('text');
    if (content.type !== 'text') {
      throw new Error('Ожидался текстовый MCP-результат');
    }
    expect(content.text).toContain('Weblate API error');
  });
});
