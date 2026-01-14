-- ============================================
-- Calendar Integration - Database Schema
-- Расширение таблицы instagram_outreach для интеграции с Google Calendar
-- ============================================

-- 1. Добавляем поля для календаря в таблицу instagram_outreach
ALTER TABLE instagram_outreach
ADD COLUMN IF NOT EXISTS calendar_event_id TEXT,  -- ID события в Google Calendar
ADD COLUMN IF NOT EXISTS meeting_link TEXT,        -- Ссылка на Zoom/Google Meet/другое
ADD COLUMN IF NOT EXISTS meeting_duration INTEGER DEFAULT 30,  -- Длительность встречи в минутах
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE,  -- Отправлено ли напоминание
ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMP,  -- Когда последний раз синхронизировалось с календарем
ADD COLUMN IF NOT EXISTS meeting_type TEXT DEFAULT 'call' CHECK (meeting_type IN ('call', 'video_call', 'in_person', 'other'));  -- Тип встречи

-- 2. Создаем индекс для поиска по calendar_event_id
CREATE INDEX IF NOT EXISTS idx_instagram_outreach_calendar_event_id 
ON instagram_outreach(calendar_event_id) 
WHERE calendar_event_id IS NOT NULL;

-- 3. Создаем индекс для поиска предстоящих встреч
CREATE INDEX IF NOT EXISTS idx_instagram_outreach_call_scheduled 
ON instagram_outreach(call_scheduled_date) 
WHERE call_scheduled_date IS NOT NULL 
AND outreach_status = 'CALL_SCHEDULED';

-- 4. Создаем представление для предстоящих встреч
CREATE OR REPLACE VIEW upcoming_calls AS
SELECT 
    id,
    instagram_handle,
    name,
    district,
    business_type,
    call_scheduled_date,
    meeting_link,
    meeting_duration,
    meeting_type,
    calendar_event_id,
    reminder_sent,
    created_at
FROM instagram_outreach
WHERE outreach_status = 'CALL_SCHEDULED'
    AND call_scheduled_date IS NOT NULL
    AND call_scheduled_date >= NOW()
ORDER BY call_scheduled_date ASC;

COMMENT ON VIEW upcoming_calls IS 'Список предстоящих созвонов с партнерами';

-- 5. Создаем представление для встреч, требующих напоминания
-- (за 24 часа до встречи)
CREATE OR REPLACE VIEW calls_needing_reminder AS
SELECT 
    id,
    instagram_handle,
    name,
    district,
    call_scheduled_date,
    meeting_link,
    meeting_duration,
    calendar_event_id,
    reminder_sent
FROM instagram_outreach
WHERE outreach_status = 'CALL_SCHEDULED'
    AND call_scheduled_date IS NOT NULL
    AND call_scheduled_date BETWEEN NOW() AND NOW() + INTERVAL '25 hours'
    AND (reminder_sent = FALSE OR reminder_sent IS NULL)
ORDER BY call_scheduled_date ASC;

COMMENT ON VIEW calls_needing_reminder IS 'Список созвонов, требующих напоминания (за 24 часа)';

-- 6. Добавляем комментарии к новым полям
COMMENT ON COLUMN instagram_outreach.calendar_event_id IS 'ID события в Google Calendar';
COMMENT ON COLUMN instagram_outreach.meeting_link IS 'Ссылка на видеозвонок (Zoom, Google Meet, etc.)';
COMMENT ON COLUMN instagram_outreach.meeting_duration IS 'Длительность встречи в минутах (по умолчанию 30)';
COMMENT ON COLUMN instagram_outreach.reminder_sent IS 'Отправлено ли напоминание о встрече';
COMMENT ON COLUMN instagram_outreach.calendar_synced_at IS 'Время последней синхронизации с календарем';
COMMENT ON COLUMN instagram_outreach.meeting_type IS 'Тип встречи: call, video_call, in_person, other';

-- 7. Создаем функцию для автоматического обновления статуса после встречи
-- (можно вызывать вручную или через cron)
CREATE OR REPLACE FUNCTION mark_past_calls_as_completed()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE instagram_outreach
    SET 
        outreach_status = 'CLOSED',
        closed_date = NOW(),
        updated_at = NOW()
    WHERE outreach_status = 'CALL_SCHEDULED'
        AND call_scheduled_date IS NOT NULL
        AND call_scheduled_date < NOW() - INTERVAL '1 hour'  -- Встреча прошла больше часа назад
        AND closed_date IS NULL;  -- Еще не закрыта
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_past_calls_as_completed IS 'Автоматически помечает прошедшие встречи как завершенные';

-- ============================================
-- Готово! 
-- 
-- Следующие шаги:
-- 1. Настроить Google Calendar API (см. документацию)
-- 2. Создать calendar_manager.py для работы с API
-- 3. Интегрировать в admin_bot.py
-- ============================================
