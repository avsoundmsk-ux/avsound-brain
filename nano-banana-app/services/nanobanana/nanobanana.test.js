/**
 * Тесты сервиса nanobanana (node:test, без сети — клиент мокается).
 * Запуск: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateImage, editImage } from './index.js';

// Мок-клиент Gemini: возвращает фейковую base64-картинку.
const okClient = {
  models: {
    generateContent: async () => ({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'ZmFrZQ==' } }] } }],
    }),
  },
};

test('генерация по тексту возвращает картинку', async () => {
  const img = await generateImage({ prompt: 'кот в очках', client: okClient });
  assert.equal(img.mimeType, 'image/png');
  assert.equal(img.data, 'ZmFrZQ==');
});

test('редактирование изображения работает с входным фото', async () => {
  const img = await editImage({ prompt: 'сделай ярче', imageBase64: 'aW1n', client: okClient });
  assert.ok(img.data);
});

test('пустой промпт → ошибка EMPTY_PROMPT', async () => {
  await assert.rejects(
    () => generateImage({ prompt: '   ', client: okClient }),
    (e) => e.code === 'EMPTY_PROMPT'
  );
});

test('редактирование без фото → ошибка NO_INPUT_IMAGE', async () => {
  await assert.rejects(
    () => editImage({ prompt: 'правка', client: okClient }),
    (e) => e.code === 'NO_INPUT_IMAGE'
  );
});

test('ошибка API нормализуется в API_ERROR', async () => {
  const badClient = { models: { generateContent: async () => { throw new Error('Internal 500 error'); } } };
  await assert.rejects(
    () => generateImage({ prompt: 'тест', client: badClient }),
    (e) => e.code === 'API_ERROR'
  );
});

test('превышение лимита → RATE_LIMIT', async () => {
  const limitClient = { models: { generateContent: async () => { const e = new Error('429 RESOURCE_EXHAUSTED'); e.status = 429; throw e; } } };
  await assert.rejects(
    () => generateImage({ prompt: 'тест', client: limitClient }),
    (e) => e.code === 'RATE_LIMIT'
  );
});

test('пустой ответ модели → NO_IMAGE', async () => {
  const emptyClient = { models: { generateContent: async () => ({ candidates: [{ content: { parts: [{ text: 'нет картинки' }] } }] }) } };
  await assert.rejects(
    () => generateImage({ prompt: 'тест', client: emptyClient }),
    (e) => e.code === 'NO_IMAGE'
  );
});
