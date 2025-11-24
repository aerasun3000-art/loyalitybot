-- ============================================
-- Добавление поля booking_url в таблицу services
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase
-- ============================================

-- Добавляем поле booking_url, если его еще нет
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS booking_url TEXT;

-- Добавляем комментарий
COMMENT ON COLUMN services.booking_url IS 'Ссылка на систему бронирования времени для услуги';

-- Создаем индекс для быстрого поиска услуг с booking_url
CREATE INDEX IF NOT EXISTS idx_services_booking_url ON services(booking_url) WHERE booking_url IS NOT NULL;

