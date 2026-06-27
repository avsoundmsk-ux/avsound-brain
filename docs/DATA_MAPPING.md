# DATA_MAPPING.md

> Заготовка. Заполняем вместе.

# Назначение

Маппинг полей Excel → поля WooCommerce (REST API).

| Excel-поле | WooCommerce-поле | Примечание |
|---|---|---|
| название | name | |
| артикул | sku | |
| цена | regular_price | строка |
| бренд | attribute / meta | как хранится бренд на сайте — уточнить |
| категория | categories[] | по id; правила в CATEGORY_RULES.md |
| характеристики | attributes[] | visible=true |
| описание | description | |
| краткое описание | short_description | |
| SEO title | meta_data rank_math/yoast/siteseo | |
| SEO desc | meta_data rank_math/yoast/siteseo | |

# Правила преобразования
- Цена: число → строка, без пробелов.
- Бренд: где живёт на av-sound.ru (атрибут pa_brand? таксономия? meta?) — TODO уточнить.
- Что НЕ трогаем при обновлении — TODO.
