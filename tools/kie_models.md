# Каталог моделей KIE.ai (для агента-Монтажёра)

Обновлено: 2026-06-24. Источник: docs.kie.ai/market. Это КУРАЦИЯ под задачи AVSound,
не полный список. Полный — https://kie.ai/market. Брать можно ЛЮБУЮ модель с сайта:
`python tools/kie_gen.py generate --model <id> ...`

Кредит KIE = **$0.005**. Цены ниже — ориентир, точную смотри на странице модели или по
факту списания (хелпер показывает «Списано»).

## 🖼 Картинки — генерация с нуля (t2v нет картинки)
| model_id | когда | цена ~ |
|---|---|---|
| `google/nano-banana` | дёшево, быстро, хорошее качество | ~2-4 cr ($0.01-0.02) |
| `google/nanobanana2` | новее nano-banana | ~ |
| `google/imagen4` / `imagen4-ultra` | фотореализм Google | ~ |
| `seedream/seedream-v4-text-to-image` | сильный реализм | ~ |
| `flux2/pro-text-to-image` | детализация, текст на картинке | ~ |
| `ideogram/v3-text-to-image` | текст/логотипы на картинке | ~ |

## 🖼 Картинки — редактирование / перенос человека / face-swap
| model_id | когда | заметка |
|---|---|---|
| `google/nano-banana-edit` | **face-swap, перенос человека в сцену, правки** | ⚠️ давать ТОЛЬКО 1 фото человека + текст сцены (НЕ 2 фото). См. [[kie-nano-banana-faceswap]] |
| `seedream/seedream-v4-edit` / `4-5-edit` | редактирование фото | альтернатива |
| `qwen/image-edit` | дешёвое редактирование | |
| `ideogram/character` / `character-edit` | консистентный персонаж | держит личность |
| `flux2/pro-image-to-image` | стилизация фото | |

## 🎬 Видео — оживить готовое фото (image-to-video)
| model_id | когда | цена ~ |
|---|---|---|
| `bytedance/seedance-2` | **наш базовый**: оживить фото товара/установки | 720p 41 cr/с, 1080p 102 cr/с (фото-старт = ставка t2v) |
| `bytedance/seedance-2-fast` | дешевле, до 720p | < seedance-2 |
| `kling/v3-turbo-image-to-video` | лучшее движение/динамика | ~ |
| `kling/image-to-video` | стабильно | ~ |
| `wan/2-7-image-to-video` | свежий Wan | ~ |
| `hailuo/02-image-to-video-pro` | реализм | ~ |

## 🎬 Видео — с нуля по тексту (text-to-video)
| model_id | когда | цена ~ |
|---|---|---|
| `bytedance/seedance-2` | сцена с нуля + нативный звук (`--audio`) | 720p 41 cr/с (t2v), 1080p 102 cr/с |
| `kling/kling-3-0` / `v3-turbo-text-to-video` | сложное движение, кинематограф | ~ |
| `wan/2-7-text-to-video` | свежий, дёшево | ~ |
| `hailuo/02-text-to-video-pro` | реализм | ~ |

## 🎬 Видео — видео-референс (video-to-video, скидка KIE)
| model_id | когда |
|---|---|
| `bytedance/seedance-2` + `--video` | пересобрать из своих роликов; **видео-референс = дешевле за секунду** |
| `wan/2-6-video-to-video` / `2-7-videoedit` | рестайл видео |
| `kling/motion-control-v3` | перенос движения |

## 🔧 Доводка
| model_id | задача |
|---|---|
| `topaz/image-upscale` / `video-upscale` | апскейл 2K/4K |
| `recraft/remove-background` | вырезать фон |
| `recraft/crisp-upscale` | резкий апскейл |

## 🎙 Аудио/озвучка (если нужен голос/музыка к ролику)
| model_id | задача |
|---|---|
| `elevenlabs/text-to-speech-multilingual-v2` | озвучка (рус) |
| `elevenlabs/text-to-dialogue-v3` | диалоги |

## Правила выбора (кратко)
1. Перенести человека/лицо → `google/nano-banana-edit`, ТОЛЬКО его фото + текст.
2. Оживить готовое фото → `bytedance/seedance-2` i2v (`--image`).
3. Картинка с нуля дёшево → `google/nano-banana`.
4. Движение/динамика → `kling/v3-turbo-*`.
5. Длинный дешёвый ролик → `seedance-2-fast 720p`.
6. Реализм + звук → `seedance-2 --audio` или `veo`/`hailuo`.
Сомневаешься в цене/входах — открой `https://docs.kie.ai/market/<id>` (firecrawl scrape).
