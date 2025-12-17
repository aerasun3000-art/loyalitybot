-- ============================================
-- Добавление поля referred_by_chat_id в partner_applications
-- Для отслеживания, кто пригласил партнера
-- ============================================

-- Добавляем поле referred_by_chat_id в таблицу partner_applications
ALTER TABLE partner_applications 
ADD COLUMN IF NOT EXISTS referred_by_chat_id TEXT REFERENCES partners(chat_id) ON DELETE SET NULL;

-- Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_partner_applications_referred_by 
ON partner_applications(referred_by_chat_id) 
WHERE referred_by_chat_id IS NOT NULL;

-- Комментарий к полю
COMMENT ON COLUMN partner_applications.referred_by_chat_id IS 'Chat ID партнера, который пригласил этого партнера (из реферальной ссылки)';

