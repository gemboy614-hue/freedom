# ФРИДОМ — агентство недвижимости

Лендинг агентства недвижимости «ФРИДОМ» (г. Находка).

Фронтенд — статика: HTML + CSS + JS, без сборки. Анимации — [GSAP ScrollTrigger](https://gsap.com/) + [Lenis](https://lenis.darkroom.engineering/) (плавный скролл), оба подключены через CDN. Шрифты Unbounded + Manrope.

Форма обратной связи (имя/телефон/вопрос) шлёт письмо через [Resend](https://resend.com).
Продакшен-хостинг (sweb) — обычный PHP-шаред-хостинг без Node.js, поэтому
обработчик формы сделан на PHP (`api/callback.php`). Node-сервер (`server.js`)
оставлен только для удобного локального превью и локального тестирования той же формы.

**Живой сайт:** https://freedomnhk.ru/

## Локальный запуск

```bash
cp .env.example .env   # и вписать свой RESEND_API_KEY
node server.js
# → http://localhost:5599/
```

Без `.env`/`RESEND_API_KEY` сайт откроется нормально, но форма обратной связи будет отвечать ошибкой — письма отправлять некуда.

## Настройка формы обратной связи (Resend)

1. Зарегистрируйтесь на [resend.com](https://resend.com), возьмите API-ключ в **API Keys**.
2. **Для продакшена (sweb, PHP):** скопируйте `api/config.example.php` → `api/config.php` и впишите:
   - `RESEND_API_KEY` — ключ из Resend
   - `MAIL_TO` — куда присылать заявки (сейчас `Saunerok@yandex.ru`)
   - `MAIL_FROM` — можно оставить `onboarding@resend.dev` для проверки; после
     подтверждения своего домена в Resend (**Domains** → добавить DNS-записи)
     замените на адрес с вашего домена — так письма реже попадают в спам.
3. **Для локальной разработки (Node):** то же самое, но в `.env` (скопировать
   из `.env.example`).
4. Оба файла — `api/config.php` и `.env` — в git не попадают (см. `.gitignore`).
   На sweb нужно завести `api/config.php` руками через файловый менеджер
   или FTP — он не приходит вместе с остальным кодом.

## Деплой на sweb

Sweb — обычный shared-хостинг с Apache + PHP, без запуска отдельных
Node.js-процессов. Поэтому:

- Статика (`index.html`, `assets/`) отдаётся как обычные файлы.
- Форма обратной связи обрабатывается файлом `api/callback.php` —
  фронтенд как и раньше стучится на `/api/callback`, а `.htaccess`
  прозрачно перенаправляет этот путь на `api/callback.php`
  (см. правило `RewriteRule ^api/callback$ api/callback.php` в `.htaccess`).
- `.htaccess` в корне также принудительно редиректит на HTTPS.
- `server.js` на sweb не запускается и не нужен — он только для
  локального `node server.js` во время разработки.

Требования на стороне PHP: включённые расширения `curl` (или хотя бы
`allow_url_fopen` как запасной вариант — код сам подхватит доступный способ)
и `mbstring` (необязательно, есть запасной вариант на `substr`). Это стандартный
набор для любого PHP-хостинга, дополнительно ничего ставить не нужно.

## Структура

```
index.html                 # разметка
assets/css/style.css       # стили
assets/js/main.js          # анимации, прелоадер, скролл, отправка формы
api/callback.php           # обработчик формы на sweb (продакшен)
api/config.example.php     # шаблон конфига для api/callback.php (скопировать в api/config.php)
.htaccess                  # редирект на HTTPS + маршрутизация /api/callback → api/callback.php
server.js                  # Node-сервер для локальной разработки (статика + POST /api/callback)
.env.example                # шаблон переменных окружения для server.js (скопировать в .env)
```
