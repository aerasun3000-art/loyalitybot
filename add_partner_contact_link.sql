-- =====================================================
-- Добавление поля username в таблицы partners и partner_applications
-- Это поле будет содержать Telegram username мастера/специалиста для переписки
-- =====================================================

-- Добавляем поле username в partners
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Добавляем поле username в partner_applications
ALTER TABLE partner_applications 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_partners_username ON partners(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_applications_username ON partner_applications(username) WHERE username IS NOT NULL;

-- Комментарии
COMMENT ON COLUMN partners.username IS 'Telegram username мастера/специалиста для переписки (без @)';
COMMENT ON COLUMN partner_applications.username IS 'Telegram username мастера/специалиста для переписки (без @)';

