-- ============================================
-- Добавление поля booking_url в таблицу partner_applications
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase
-- ============================================

-- Добавляем поле booking_url, если его еще нет
ALTER TABLE partner_applications 
ADD COLUMN IF NOT EXISTS booking_url TEXT;

-- Добавляем комментарий
COMMENT ON COLUMN partner_applications.booking_url IS 'Ссылка на систему бронирования времени для партнера';

