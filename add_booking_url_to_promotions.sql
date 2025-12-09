-- ============================================
-- Добавление поля booking_url в таблицу promotions
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase
-- ============================================

-- Добавляем поле booking_url, если его еще нет
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS booking_url TEXT;

-- Добавляем комментарий
COMMENT ON COLUMN promotions.booking_url IS 'Ссылка на систему бронирования времени для акции';

-- Создаем индекс для быстрого поиска акций с booking_url
CREATE INDEX IF NOT EXISTS idx_promotions_booking_url ON promotions(booking_url) WHERE booking_url IS NOT NULL;











