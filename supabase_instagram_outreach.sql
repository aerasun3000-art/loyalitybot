-- ============================================
-- Instagram Outreach System - Database Schema
-- Таблица для отслеживания процесса outreach в Instagram
-- ============================================

-- 1. Создаем таблицу для отслеживания Instagram outreach
CREATE TABLE IF NOT EXISTS instagram_outreach (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Основная информация
    instagram_handle TEXT NOT NULL UNIQUE,
    partner_chat_id TEXT,  -- Связь с существующим партнером (если есть)
    
    -- Данные партнера
    name TEXT,
    district TEXT,
    business_type TEXT,
    city TEXT DEFAULT 'New York',
    
    -- Статус outreach
    outreach_status TEXT DEFAULT 'NOT_CONTACTED' CHECK (
        outreach_status IN (
            'NOT_CONTACTED',
            'QUEUED',
            'SENT',
            'REPLIED',
            'INTERESTED',
            'CALL_SCHEDULED',
            'FOLLOW_UP_1',
            'FOLLOW_UP_2',
            'NOT_INTERESTED',
            'GHOSTED',
            'CLOSED'
        )
    ),
    
    -- Приоритет и настройки
    priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    outreach_template_used TEXT,  -- Какой шаблон был использован
    
    -- Даты и временные метки
    first_contact_date TIMESTAMP,
    last_follow_up_date TIMESTAMP,
    reply_date TIMESTAMP,
    call_scheduled_date TIMESTAMP,
    closed_date TIMESTAMP,
    
    -- Метрики
    messages_sent INTEGER DEFAULT 0,
    response_time_hours INTEGER,  -- Время ответа в часах
    
    -- Дополнительная информация
    notes TEXT,
    source TEXT,  -- Откуда найден партнер (hashtag, location, referral, etc.)
    
    -- Системные поля
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by TEXT  -- ID администратора/пользователя, который добавил
);

-- 2. Добавляем поля в таблицу partners для связи
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS instagram_handle TEXT;

-- 3. Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_instagram_outreach_handle ON instagram_outreach(instagram_handle);
CREATE INDEX IF NOT EXISTS idx_instagram_outreach_status ON instagram_outreach(outreach_status);
CREATE INDEX IF NOT EXISTS idx_instagram_outreach_district ON instagram_outreach(district) WHERE district IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_instagram_outreach_business_type ON instagram_outreach(business_type) WHERE business_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_instagram_outreach_priority ON instagram_outreach(priority);
CREATE INDEX IF NOT EXISTS idx_instagram_outreach_created_at ON instagram_outreach(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_outreach_first_contact_date ON instagram_outreach(first_contact_date) WHERE first_contact_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_instagram_handle ON partners(instagram_handle) WHERE instagram_handle IS NOT NULL;

-- 4. Создаем функцию для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_instagram_outreach_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Создаем триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_instagram_outreach_updated_at ON instagram_outreach;
CREATE TRIGGER trigger_update_instagram_outreach_updated_at
    BEFORE UPDATE ON instagram_outreach
    FOR EACH ROW
    EXECUTE FUNCTION update_instagram_outreach_updated_at();

-- 6. Добавляем комментарии к таблице и полям
COMMENT ON TABLE instagram_outreach IS 'Таблица для отслеживания процесса Instagram outreach к потенциальным партнерам';
COMMENT ON COLUMN instagram_outreach.instagram_handle IS 'Instagram handle партнера (без @)';
COMMENT ON COLUMN instagram_outreach.outreach_status IS 'Статус процесса outreach: NOT_CONTACTED, SENT, REPLIED, INTERESTED, CLOSED, etc.';
COMMENT ON COLUMN instagram_outreach.priority IS 'Приоритет контакта: LOW, MEDIUM, HIGH, URGENT';
COMMENT ON COLUMN instagram_outreach.messages_sent IS 'Количество отправленных сообщений';
COMMENT ON COLUMN instagram_outreach.response_time_hours IS 'Время ответа партнера в часах';

-- 7. Создаем представление (view) для быстрого доступа к статистике
CREATE OR REPLACE VIEW instagram_outreach_stats AS
SELECT 
    outreach_status,
    COUNT(*) as count,
    AVG(messages_sent)::INTEGER as avg_messages_sent,
    AVG(response_time_hours)::INTEGER as avg_response_time_hours
FROM instagram_outreach
GROUP BY outreach_status;

COMMENT ON VIEW instagram_outreach_stats IS 'Статистика по статусам Instagram outreach';

-- 8. Создаем представление для партнеров, требующих follow-up
CREATE OR REPLACE VIEW instagram_outreach_follow_ups AS
SELECT 
    id,
    instagram_handle,
    name,
    district,
    business_type,
    outreach_status,
    last_follow_up_date,
    first_contact_date,
    messages_sent,
    CASE 
        WHEN outreach_status = 'SENT' 
            AND first_contact_date < NOW() - INTERVAL '48 hours'
            AND last_follow_up_date IS NULL
        THEN 'FOLLOW_UP_1'
        WHEN outreach_status IN ('SENT', 'FOLLOW_UP_1')
            AND COALESCE(last_follow_up_date, first_contact_date) < NOW() - INTERVAL '7 days'
        THEN 'FOLLOW_UP_2'
        ELSE NULL
    END as next_action
FROM instagram_outreach
WHERE outreach_status IN ('SENT', 'FOLLOW_UP_1')
    AND (
        (outreach_status = 'SENT' 
         AND first_contact_date < NOW() - INTERVAL '48 hours'
         AND last_follow_up_date IS NULL)
        OR
        (COALESCE(last_follow_up_date, first_contact_date) < NOW() - INTERVAL '7 days')
    );

COMMENT ON VIEW instagram_outreach_follow_ups IS 'Список партнеров, которым требуется follow-up';

-- 9. Создаем функцию для получения следующих контактов в очереди
CREATE OR REPLACE FUNCTION get_next_outreach_contacts(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    instagram_handle TEXT,
    name TEXT,
    district TEXT,
    business_type TEXT,
    priority TEXT,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        io.id,
        io.instagram_handle,
        io.name,
        io.district,
        io.business_type,
        io.priority,
        io.created_at
    FROM instagram_outreach io
    WHERE io.outreach_status = 'NOT_CONTACTED'
    ORDER BY 
        CASE io.priority
            WHEN 'URGENT' THEN 1
            WHEN 'HIGH' THEN 2
            WHEN 'MEDIUM' THEN 3
            WHEN 'LOW' THEN 4
        END,
        io.created_at ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_outreach_contacts IS 'Возвращает следующих партнеров для контакта в порядке приоритета';

