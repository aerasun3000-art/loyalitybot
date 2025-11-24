-- ============================================
-- Добавление поля booking_url в таблицу partners
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase
-- ============================================

-- Добавляем поле booking_url, если его еще нет
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS booking_url TEXT;

-- Добавляем комментарий
COMMENT ON COLUMN partners.booking_url IS 'Ссылка на систему бронирования времени для партнера';

-- Создаем индекс для быстрого поиска партнеров с booking_url
CREATE INDEX IF NOT EXISTS idx_partners_booking_url ON partners(booking_url) WHERE booking_url IS NOT NULL;

