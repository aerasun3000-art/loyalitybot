-- Чистим застрявшие bot_states с state='awaiting_promo_audience'
-- Эти записи оставил сломанный деплой 2026-02-25.
-- После выполнения затронутые пользователи увидят главное меню при следующем сообщении.

DELETE FROM bot_states WHERE state = 'awaiting_promo_audience';
