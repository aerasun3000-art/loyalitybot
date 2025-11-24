-- =====================================================
-- Добавление поля username и contact_link в таблицы partners и partner_applications
-- contact_link автоматически генерируется из username в формате https://t.me/username
-- =====================================================

-- Добавляем поле username в partners
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Добавляем поле username в partner_applications
ALTER TABLE partner_applications 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Добавляем поле contact_link в partners (автоматически генерируется из username)
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS contact_link TEXT;

-- Добавляем поле contact_link в partner_applications (автоматически генерируется из username)
ALTER TABLE partner_applications 
ADD COLUMN IF NOT EXISTS contact_link TEXT;

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_partners_username ON partners(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_applications_username ON partner_applications(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_contact_link ON partners(contact_link) WHERE contact_link IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_applications_contact_link ON partner_applications(contact_link) WHERE contact_link IS NOT NULL;

-- Комментарии
COMMENT ON COLUMN partners.username IS 'Telegram username мастера/специалиста для переписки (без @)';
COMMENT ON COLUMN partner_applications.username IS 'Telegram username мастера/специалиста для переписки (без @)';
COMMENT ON COLUMN partners.contact_link IS 'Автоматически генерируемая ссылка для переписки в формате https://t.me/username';
COMMENT ON COLUMN partner_applications.contact_link IS 'Автоматически генерируемая ссылка для переписки в формате https://t.me/username';

-- =====================================================
-- Функция для автоматической генерации contact_link из username
-- =====================================================

CREATE OR REPLACE FUNCTION generate_contact_link_from_username()
RETURNS TRIGGER AS $$
BEGIN
    -- Генерируем contact_link из username, если username указан
    IF NEW.username IS NOT NULL AND NEW.username != '' THEN
        -- Убираем @ если есть и формируем ссылку
        NEW.contact_link := 'https://t.me/' || TRIM(BOTH '@' FROM NEW.username);
    ELSE
        -- Если username пустой, очищаем contact_link
        NEW.contact_link := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Триггеры для автоматического обновления contact_link
-- =====================================================

-- Триггер для partners
DROP TRIGGER IF EXISTS trigger_generate_contact_link_partners ON partners;
CREATE TRIGGER trigger_generate_contact_link_partners
    BEFORE INSERT OR UPDATE OF username ON partners
    FOR EACH ROW
    EXECUTE FUNCTION generate_contact_link_from_username();

-- Триггер для partner_applications
DROP TRIGGER IF EXISTS trigger_generate_contact_link_applications ON partner_applications;
CREATE TRIGGER trigger_generate_contact_link_applications
    BEFORE INSERT OR UPDATE OF username ON partner_applications
    FOR EACH ROW
    EXECUTE FUNCTION generate_contact_link_from_username();

-- =====================================================
-- Обновление существующих записей (если username уже заполнен)
-- =====================================================

-- Обновляем contact_link для существующих партнёров
UPDATE partners 
SET contact_link = 'https://t.me/' || TRIM(BOTH '@' FROM username)
WHERE username IS NOT NULL AND username != '' AND (contact_link IS NULL OR contact_link = '');

-- Обновляем contact_link для существующих заявок
UPDATE partner_applications 
SET contact_link = 'https://t.me/' || TRIM(BOTH '@' FROM username)
WHERE username IS NOT NULL AND username != '' AND (contact_link IS NULL OR contact_link = '');

