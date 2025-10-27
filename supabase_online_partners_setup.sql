-- Настройка партнеров для работы во всех городах (онлайн-услуги)
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase

-- Пример: Установка партнера как работающего везде (онлайн)
-- Замените 'CHAT_ID_ПАРТНЕРА' на реальный chat_id вашего партнера

-- Вариант 1: Партнер работает везде (онлайн-услуги)
UPDATE partners 
SET city = 'Все', district = 'Все'
WHERE chat_id = 'CHAT_ID_ПАРТНЕРА';

-- Вариант 2: Партнер работает в конкретном городе, но во всех районах
UPDATE partners 
SET city = 'Москва', district = 'Все'
WHERE chat_id = 'CHAT_ID_ПАРТНЕРА';

-- Вариант 3: Партнер работает только в конкретном районе
UPDATE partners 
SET city = 'Москва', district = 'Центральный'
WHERE chat_id = 'CHAT_ID_ПАРТНЕРА';

-- Пример: Просмотр всех партнеров с их локациями
SELECT 
  chat_id,
  name,
  company_name,
  city,
  district,
  CASE 
    WHEN city = 'Все' THEN '🌍 Работает везде (онлайн)'
    WHEN district = 'Все' THEN '🏙️ Все районы города'
    ELSE '📍 Конкретная локация'
  END as location_type
FROM partners
ORDER BY city, district;

