-- =====================================================
-- Система сообщений между клиентом и партнёром
-- =====================================================
-- Создаёт таблицу для хранения истории переписки

-- Таблица сообщений
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    client_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    partner_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'partner')),
    message_text TEXT,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'qr_code', 'image', 'file')),
    attachment_url TEXT, -- URL для QR-кода, изображений, файлов
    attachment_type TEXT, -- 'qr_code', 'image', 'file'
    service_id TEXT, -- ID услуги (для справки, без внешнего ключа)
    service_title TEXT, -- Название услуги на момент отправки
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_partner ON messages(partner_chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(client_chat_id, partner_chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(is_read) WHERE is_read = false;

-- Индекс для поиска непрочитанных сообщений партнёра
CREATE INDEX IF NOT EXISTS idx_messages_unread_partner ON messages(partner_chat_id, is_read) 
    WHERE sender_type = 'client' AND is_read = false;

-- Индекс для поиска непрочитанных сообщений клиента
CREATE INDEX IF NOT EXISTS idx_messages_unread_client ON messages(client_chat_id, is_read) 
    WHERE sender_type = 'partner' AND is_read = false;

-- Включаем Row Level Security (RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Политика: клиенты могут видеть только свои сообщения
CREATE POLICY "Clients can view their own messages"
    ON messages FOR SELECT
    USING (
        client_chat_id = current_setting('app.current_user_id', true)
        OR client_chat_id IN (
            SELECT chat_id FROM users WHERE chat_id = current_setting('app.current_user_id', true)
        )
    );

-- Политика: партнёры могут видеть только свои переписки
CREATE POLICY "Partners can view their conversations"
    ON messages FOR SELECT
    USING (
        partner_chat_id = current_setting('app.current_user_id', true)
        OR partner_chat_id IN (
            SELECT chat_id FROM partners WHERE chat_id = current_setting('app.current_user_id', true)
        )
    );

-- Политика для вставки через сервисный ключ (бэкенд)
CREATE POLICY "Service role can do everything"
    ON messages FOR ALL
    USING (true)
    WITH CHECK (true);

-- Комментарии к таблице
COMMENT ON TABLE messages IS 'История переписки между клиентами и партнёрами';
COMMENT ON COLUMN messages.sender_type IS 'Тип отправителя: client или partner';
COMMENT ON COLUMN messages.message_type IS 'Тип сообщения: text, qr_code, image, file';
COMMENT ON COLUMN messages.attachment_url IS 'URL вложения (для QR-кодов, изображений, файлов)';
COMMENT ON COLUMN messages.is_read IS 'Прочитано ли сообщение получателем';

-- Функция для автоматического обновления read_at при изменении is_read
CREATE OR REPLACE FUNCTION update_message_read_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_read = true AND OLD.is_read = false THEN
        NEW.read_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_message_read_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    WHEN (NEW.is_read IS DISTINCT FROM OLD.is_read)
    EXECUTE FUNCTION update_message_read_at();

