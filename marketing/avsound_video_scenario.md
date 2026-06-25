# AVSound — видео-визитка магазина (таинственная ведущая в маске)

Статус: НА СОГЛАСОВАНИЕ (генерация после "ок"). Модель: KIE Seedance 2, макс качество.

## Концепт
Дарк-люкс, инкогнито. Девушка в маске (как на фото) — лицо бренда, стоит ЗА ПРИЛАВКОМ
магазина AVSound, представляет ассортимент. Вайб лучшей студии: кино-свет, чистые
переходы, наезд/отъезд, rack-focus на товар. Фотореализм — чтобы не читалось как ИИ.

## Важный момент про речь
Рот закрыт маской → синхронно «говорить» губами нельзя. Поэтому она ГОВОРИТ ЗА КАДРОМ
(закадровый голос, русский, через ElevenLabs — идеальная дикция), а в кадре играет
глазами, головой, руками в перстнях, жестами к товару. Это и есть «инкогнито».
(Если хочешь именно видимую речь — тогда позже без маски, отдельным роликом.)

## Фото (что подо что)
- ФОТО-1 ЛОГО — заставка/финал (AV SOUND).
- ФОТО-2 ДЕВУШКА (маска, перстни, тёмный образ) — её образ, переносим во все сцены.
- ФОТО-3 ПРИЛАВОК (стойка BOS-MINI, стена магнитол) — основная сцена «за прилавком».
- ФОТО-4 РЯД ТОВАРА (полки Focal/Hertz, узкий проход) — b-roll ассортимента.
- ФОТО-5 ЛАУНДЖ (диван, барстулья, полка с сабами) — выход из-за прилавка.
- ФОТО-6 БАГАЖНИК с сабами в неоне — результат установки (hero продукта).

## Как генерируем (2 шага на каждый кадр)
1. nano-banana-edit: собрать СТАРТ-КАДР — переносим девушку (ФОТО-2, маска/стиль БЕЗ
   изменений) в нужную сцену магазина. В сценах магазина людей нет → перенос чистый.
2. Seedance 2 i2v: оживляем старт-кадр (движение + камера). 1080p, 9:16, Audio OFF.
Длительность: 5 кадров → итог ~25с (Seedance макс 15с/клип, режем покадрово).

## Свет (общий)
Low-key, глубокие тени. Холодный neon rim (синий/маджента) от стен с техникой,
тёплый key на глаза девушки, глянцевые блики на товаре и перстнях, лёгкая дымка.

---

## РАСКАДРОВКА

### КАДР 1 — Заставка лого (3–4с) — ФОТО-1
- Действие: тёмный экран, лого AV SOUND проявляется, звуковые «лучи» пульсируют, неон.
- Камера: лёгкий наезд на лого.
- Закадр: — (только бренд-звук/бит).
- Seedance i2v со стартом = ФОТО-1.

### КАДР 2 — Она за прилавком, приветствие + ассортимент (6–7с) — ФОТО-2 → ФОТО-3
- Старт-кадр: девушка в маске стоит ЗА прилавком (ФОТО-3), рука в перстнях на стойке.
- Действие: медленно поворачивает взгляд в камеру, второй рукой ведёт жест к стене магнитол.
- Камера: плавный push-in от среднего к крупному, затем rack-focus на стену техники и назад.
- Закадр: «Это AV SOUND — студия автозвука в Москве. У нас огромный ассортимент:
  магнитолы, усилители, динамики и сабвуферы любых брендов.»

### КАДР 3 — Ряд товара, ведёт рукой (6–7с) — ФОТО-2 → ФОТО-4
- Старт-кадр: девушка в проходе у полок Focal/Hertz, ладонь скользит вдоль коробок.
- Действие: идёт вдоль ряда, перстни блестят, взгляд возвращается в камеру.
- Камера: боковой трекинг вдоль полок + rack-focus на товар, затем быстрый whip-pan-переход.
- Закадр: «Подберём акустику под любой автомобиль и сразу установим в нашей студии.»

### КАДР 4 — Выход в лаундж (6–7с) — ФОТО-2 → ФОТО-5
- Старт-кадр: девушка выходит из-за прилавка в лаундж-зону (диван, бар, полка сабов).
- Действие: уверенно шагает, лёгкий разворот к камере, жест «приглашаю».
- Камера: дуга/орбита вокруг неё, затем отъезд с раскрытием интерьера.
- Закадр: «Качество, которое слышно и чувствуется.»

### КАДР 5 — Результат + скидка + финал (6–7с) — ФОТО-6 → ФОТО-1
- Старт-кадр: багажник с сабами в синем неоне (ФОТО-6), пульс баса; переход на лого.
- Действие: неон пульсирует, камера наезжает; финальный кадр — лого AV SOUND.
- Камера: наезд на сабы → match-cut на лого, лёгкий пульс.
- Закадр: «А при покупке — дарим скидку на установку. AV SOUND — раскрой силу звука.»

---

## ПОЛНЫЙ ЗАКАДРОВЫЙ ТЕКСТ (для ElevenLabs, чистый русский)
«Это AV SOUND — студия автозвука в Москве. У нас огромный ассортимент: магнитолы,
усилители, динамики и сабвуферы любых брендов. Подберём акустику под любой автомобиль
и сразу установим в нашей студии. Качество, которое слышно и чувствуется. А при покупке —
дарим скидку на установку. AV SOUND — раскрой силу звука.»

---

## ПРОМТЫ ГЕНЕРАЦИИ

### Старт-кадры (nano-banana-edit): image_urls = [ФОТО-2 девушка, ФОТО-сцены]
Общий промт-шаблон (меняется только сцена):
> Place the masked woman from the first image (keep her EXACT black balaclava, dark outfit,
> diamond rings and style 100% unchanged) naturally into the scene from the second image —
> {СЦЕНА}. Photorealistic, consistent lighting with the store, dark cinematic mood, she fits
> the environment realistically, sharp focus, natural shadows. Keep her fully masked.

{СЦЕНА} по кадрам:
- Кадр2: "standing behind the sales counter, one ringed hand resting on the counter"
- Кадр3: "standing in the product aisle between the shelves, hand near the boxes"
- Кадр4: "standing in the lounge area near the sofa and shelves"

### Оживление (Seedance 2 i2v): первый кадр = соответствующий старт-кадр
Хвост реализма (в каждый): `dark-luxe cinematic, low-key lighting, neon rim light, glossy
reflections, atmospheric haze, shot on a real cinema camera, 35mm lens, shallow depth of
field, photorealistic, NOT CGI, subtle film grain, gentle handheld micro-movement,
cinematic dark color grade, ultra realistic.`

- Кадр1 (лого): `The AV SOUND logo emerges from black, sound-wave rays subtly pulsing, neon glow, slow push-in.` + хвост
- Кадр2: `She slowly turns her intense masked gaze to the lens and gestures with a ringed hand toward the wall of head units and amplifiers. CAMERA: slow push-in, then rack-focus to the product wall and back.` + хвост
- Кадр3: `She walks along the product aisle, ringed hand trailing past the boxes, eyes returning to the lens. CAMERA: lateral tracking with rack-focus pulls on the products, ending on a quick whip-pan.` + хвост
- Кадр4: `She steps out from behind the counter into the lounge, a confident turn and an inviting hand gesture. CAMERA: slow orbit around her, then pull-back revealing the interior.` + хвост
- Кадр5: `Blue-neon subwoofers in a car trunk pulsing to the bass, then a match-cut to the glowing AV SOUND logo. CAMERA: push-in on the subs, transition to the logo with a subtle pulse.` + хвост

## Бюджет (оценка)
Старт-кадры nano-banana: 5 × ~$0.04 = ~$0.20. Видео Seedance i2v 720p ~41 cr/с:
5 кадров × ~6с × 41 = ~1230 cr ≈ $6.15 (720p). 1080p — вдвое дороже (~$12). Музыку/закадр
накладываем отдельно. Итог склею в один ролик с переходами.
