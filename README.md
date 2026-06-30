# ФРИДОМ — агентство недвижимости

Лендинг агентства недвижимости «ФРИДОМ» (г. Находка).

Статический сайт: HTML + CSS + JS, без сборки. Анимации — [GSAP ScrollTrigger](https://gsap.com/) + [Lenis](https://lenis.darkroom.engineering/) (плавный скролл), оба подключены через CDN. Шрифты Unbounded + Manrope.

**Живой сайт:** https://gemboy614-hue.github.io/freedom/

## Локальный запуск

```bash
node server.js
# → http://localhost:5599/
```

Можно открыть `index.html` и напрямую — сервер нужен только для корректных MIME-типов.

## Структура

```
index.html            # разметка
assets/css/style.css  # стили
assets/js/main.js     # анимации, прелоадер, скролл
server.js             # минимальный статический сервер для локального превью
```
