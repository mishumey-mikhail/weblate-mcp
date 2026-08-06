import { WeblateTranslationsTool } from './translations.tool';

describe('WeblateTranslationsTool', () => {
  it('shows effective labels resolved from the source unit', async () => {
    const service = {
      getTranslationByKey: jest.fn().mockResolvedValue({
        id: 42,
        context: 'homepage.title',
        source: ['Заголовок'],
        target: ['Title'],
        labels: [],
        state: 20,
      }),
      getUnitDetails: jest.fn().mockResolvedValue({
        id: 42,
        context: 'homepage.title',
        source: ['Заголовок'],
        target: ['Title'],
        labels: [{ id: 7, name: 'Точность: Пропуск' }],
        effective_labels: [{ id: 7, name: 'Точность: Пропуск' }],
        labels_owner: 'source_unit',
        source_unit_id: '24',
        state: 20,
      }),
    };
    const tool = new WeblateTranslationsTool(service as never);

    const result = await tool.getTranslationForKey({
      projectSlug: 'demo',
      componentSlug: 'web',
      languageCode: 'en',
      key: 'homepage.title',
    });

    const content = result.content[0];
    expect(content.type).toBe('text');
    if (content.type !== 'text') {
      throw new Error('Ожидался текстовый MCP-результат');
    }
    expect(content.text).toContain('Точность: Пропуск (ID 7)');
    expect(content.text).toContain('Источник labels:** source_unit (ID 24)');
  });

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
