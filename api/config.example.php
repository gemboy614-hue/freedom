<?php
/* Скопируйте этот файл в config.php (рядом, в этой же папке api/) и впишите
   свои значения. config.php в git не попадает — см. .gitignore. */

return [
    // API-ключ Resend: https://resend.com/api-keys
    'RESEND_API_KEY' => 're_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',

    // Куда присылать заявки с формы
    'MAIL_TO' => 'Saunerok@yandex.ru',

    // От кого отправлять письмо. Пока домен не подтверждён в Resend, можно
    // оставить onboarding@resend.dev — он работает без верификации.
    // После подтверждения домена (Resend → Domains) замените на свой адрес,
    // например: ФРИДОМ <заявки@ваш-домен.ru>
    'MAIL_FROM' => 'ФРИДОМ <onboarding@resend.dev>',
];
