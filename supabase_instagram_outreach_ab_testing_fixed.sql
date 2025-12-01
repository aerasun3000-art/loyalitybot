-- ============================================
-- Instagram Outreach A/B Testing - Database Schema (ИСПРАВЛЕННАЯ ВЕРСИЯ)
-- Добавляет поддержку A/B тестирования сообщений
-- ============================================

-- 1. Добавляем поля для A/B тестирования в таблицу instagram_outreach
ALTER TABLE instagram_outreach
ADD COLUMN IF NOT EXISTS template_variant TEXT,  -- 'A', 'B', 'C' - вариант шаблона
ADD COLUMN IF NOT EXISTS template_variant_name TEXT,  -- Название варианта ('Короткое', 'Подробное', etc.)
ADD COLUMN IF NOT EXISTS template_group TEXT DEFAULT 'first_contact',  -- Группа шаблонов
ADD COLUMN IF NOT EXISTS opened_message BOOLEAN DEFAULT false,  -- Прочитал ли сообщение
ADD COLUMN IF NOT EXISTS clicked_link BOOLEAN DEFAULT false;   -- Перешел ли по ссылке

-- 2. Создаем таблицу для хранения вариантов шаблонов
CREATE TABLE IF NOT EXISTS outreach_template_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_group TEXT NOT NULL,  -- 'first_contact', 'follow_up_1', etc.
    variant_name TEXT NOT NULL,    -- 'A', 'B', 'C'
    variant_label TEXT,            -- 'Короткое', 'Подробное', 'С выгодой'
    template_text TEXT NOT NULL,
    variables JSONB,  -- Список переменных шаблона
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(template_group, variant_name)
);

-- 3. Создаем индекс для быстрого поиска вариантов
CREATE INDEX IF NOT EXISTS idx_template_variants_group 
ON outreach_template_variants(template_group, is_active);

-- 4. Создаем таблицу для статистики A/B тестов
CREATE TABLE IF NOT EXISTS outreach_ab_test_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_group TEXT NOT NULL,
    variant_name TEXT NOT NULL,
    date DATE NOT NULL,
    
    -- Метрики
    messages_sent INTEGER DEFAULT 0,
    messages_opened INTEGER DEFAULT 0,
    replies_received INTEGER DEFAULT 0,
    interested_count INTEGER DEFAULT 0,
    closed_deals INTEGER DEFAULT 0,
    
    -- Конверсии
    open_rate DECIMAL(5, 2) DEFAULT 0,  -- Процент открытий
    reply_rate DECIMAL(5, 2) DEFAULT 0,  -- Процент ответов
    interest_rate DECIMAL(5, 2) DEFAULT 0,  -- Процент заинтересованных
    conversion_rate DECIMAL(5, 2) DEFAULT 0,  -- Процент закрытых сделок
    
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(template_group, variant_name, date)
);

-- 5. Создаем представление для анализа результатов A/B тестов
CREATE OR REPLACE VIEW outreach_ab_test_results AS
SELECT 
    io.template_group,
    io.template_variant,
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE io.opened_message = true) as total_opened,
    COUNT(*) FILTER (WHERE io.outreach_status = 'REPLIED') as total_replied,
    COUNT(*) FILTER (WHERE io.outreach_status = 'INTERESTED') as total_interested,
    COUNT(*) FILTER (WHERE io.outreach_status = 'CLOSED') as total_closed,
    ROUND(
        COUNT(*) FILTER (WHERE io.opened_message = true)::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) as open_rate,
    ROUND(
        COUNT(*) FILTER (WHERE io.outreach_status = 'REPLIED')::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) as reply_rate,
    ROUND(
        COUNT(*) FILTER (WHERE io.outreach_status = 'INTERESTED')::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) as interest_rate,
    ROUND(
        COUNT(*) FILTER (WHERE io.outreach_status = 'CLOSED')::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) as conversion_rate,
    AVG(io.response_time_hours) FILTER (WHERE io.response_time_hours IS NOT NULL) as avg_response_time_hours
FROM instagram_outreach io
WHERE io.outreach_status = 'SENT' 
  AND io.template_variant IS NOT NULL
GROUP BY io.template_group, io.template_variant;

COMMENT ON VIEW outreach_ab_test_results IS 'Агрегированная статистика результатов A/B тестирования шаблонов';

-- 6. Создаем функцию для автоматического обновления статистики (УПРОЩЕННАЯ ВЕРСИЯ)
CREATE OR REPLACE FUNCTION update_ab_test_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем дневную статистику при отправке сообщения
    IF NEW.outreach_status = 'SENT' AND NEW.template_variant IS NOT NULL THEN
        INSERT INTO outreach_ab_test_stats (
            template_group,
            variant_name,
            date,
            messages_sent
        ) VALUES (
            COALESCE(NEW.template_group, 'first_contact'),
            NEW.template_variant,
            CURRENT_DATE,
            1
        )
        ON CONFLICT (template_group, variant_name, date)
        DO UPDATE SET
            messages_sent = outreach_ab_test_stats.messages_sent + 1;
    END IF;
    
    -- Обновляем при открытии сообщения
    IF NEW.opened_message = true AND NEW.template_variant IS NOT NULL AND (OLD IS NULL OR OLD.opened_message = false) THEN
        INSERT INTO outreach_ab_test_stats (
            template_group,
            variant_name,
            date,
            messages_opened
        ) VALUES (
            COALESCE(NEW.template_group, 'first_contact'),
            NEW.template_variant,
            CURRENT_DATE,
            1
        )
        ON CONFLICT (template_group, variant_name, date)
        DO UPDATE SET
            messages_opened = outreach_ab_test_stats.messages_opened + 1;
    END IF;
    
    -- Обновляем при ответе
    IF NEW.outreach_status = 'REPLIED' AND NEW.template_variant IS NOT NULL AND (OLD IS NULL OR OLD.outreach_status != 'REPLIED') THEN
        INSERT INTO outreach_ab_test_stats (
            template_group,
            variant_name,
            date,
            replies_received
        ) VALUES (
            COALESCE(NEW.template_group, 'first_contact'),
            NEW.template_variant,
            CURRENT_DATE,
            1
        )
        ON CONFLICT (template_group, variant_name, date)
        DO UPDATE SET
            replies_received = outreach_ab_test_stats.replies_received + 1;
    END IF;
    
    -- Обновляем при заинтересованности
    IF NEW.outreach_status = 'INTERESTED' AND NEW.template_variant IS NOT NULL AND (OLD IS NULL OR OLD.outreach_status != 'INTERESTED') THEN
        INSERT INTO outreach_ab_test_stats (
            template_group,
            variant_name,
            date,
            interested_count
        ) VALUES (
            COALESCE(NEW.template_group, 'first_contact'),
            NEW.template_variant,
            CURRENT_DATE,
            1
        )
        ON CONFLICT (template_group, variant_name, date)
        DO UPDATE SET
            interested_count = outreach_ab_test_stats.interested_count + 1;
    END IF;
    
    -- Обновляем при закрытии сделки
    IF NEW.outreach_status = 'CLOSED' AND NEW.template_variant IS NOT NULL AND (OLD IS NULL OR OLD.outreach_status != 'CLOSED') THEN
        INSERT INTO outreach_ab_test_stats (
            template_group,
            variant_name,
            date,
            closed_deals
        ) VALUES (
            COALESCE(NEW.template_group, 'first_contact'),
            NEW.template_variant,
            CURRENT_DATE,
            1
        )
        ON CONFLICT (template_group, variant_name, date)
        DO UPDATE SET
            closed_deals = outreach_ab_test_stats.closed_deals + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Создаем триггер для автоматического обновления статистики
DROP TRIGGER IF EXISTS trigger_update_ab_test_stats ON instagram_outreach;
CREATE TRIGGER trigger_update_ab_test_stats
    AFTER INSERT OR UPDATE ON instagram_outreach
    FOR EACH ROW
    EXECUTE FUNCTION update_ab_test_stats();

-- 8. Добавляем комментарии к новым полям
COMMENT ON COLUMN instagram_outreach.template_variant IS 'Вариант шаблона для A/B тестирования (A, B, C, etc.)';
COMMENT ON COLUMN instagram_outreach.template_variant_name IS 'Название варианта шаблона для отображения';
COMMENT ON COLUMN instagram_outreach.template_group IS 'Группа шаблонов (first_contact, follow_up_1, etc.)';
COMMENT ON COLUMN instagram_outreach.opened_message IS 'Прочитал ли партнер сообщение';
COMMENT ON COLUMN instagram_outreach.clicked_link IS 'Перешел ли партнер по ссылке в сообщении';

-- 9. Вставляем начальные варианты шаблонов
INSERT INTO outreach_template_variants (template_group, variant_name, variant_label, template_text, variables, is_active)
VALUES 
    ('first_contact', 'A', 'Короткое (текущее)', 
     'Привет {name}! 👋\n\nВидел твои работы в {district} — супер! 🔥\n\nМы запускаем эксклюзивную программу для бьюти-мастеров.\nНужен партнер в {district} для {business_type}.\n\nЧто дает:\n✅ Эксклюзивные права на район\n✅ Обмен клиентами\n✅ $29/месяц (раннее предложение)\n\nОбсудим? 💬',
     '["name", "district", "business_type"]'::jsonb,
     true),
    ('first_contact', 'B', 'Подробное',
     'Привет {name}! 👋\n\nЯ из {company_name}. Мы создаем кроссмаркетинговую систему лояльности для бьюти-мастеров в Нью-Йорке.\n\nВ каждом районе мы берем только ОДНОГО партнера на каждую сферу услуг.\n\nДля {district} нам нужен мастер в {business_type}.\n\nПреимущества:\n✅ Эксклюзивные права\n✅ Обмен клиентами\n✅ Раннее предложение — $29/месяц\n✅ Полная поддержка и аналитика\n\nИнтересно узнать больше?\n{link}\n\nИли можем обсудить в личке! 💬',
     '["name", "company_name", "district", "business_type", "link"]'::jsonb,
     true),
    ('first_contact', 'C', 'С акцентом на выгоду',
     'Привет {name}! 👋\n\nТы делаешь отличные {business_type} в {district}!\n\nХочешь получать больше клиентов?\n\nМы ищем ОДНОГО партнера в {district} для нашей системы обмена клиентами.\n\n💰 Что это дает:\n• Новые клиенты от других партнеров\n• Эксклюзивные права в районе\n• Всего $29/месяц (вместо $99)\n\nПример: наши партнеры получают в среднем 5-10 новых клиентов в месяц от сети.\n\nГотов обсудить? 💬',
     '["name", "district", "business_type"]'::jsonb,
     true)
ON CONFLICT (template_group, variant_name) DO NOTHING;

-- 10. Создаем индекс для быстрого поиска по вариантам
CREATE INDEX IF NOT EXISTS idx_outreach_template_variant 
ON instagram_outreach(template_group, template_variant) 
WHERE template_variant IS NOT NULL;

COMMENT ON TABLE outreach_template_variants IS 'Варианты шаблонов для A/B тестирования';
COMMENT ON TABLE outreach_ab_test_stats IS 'Дневная статистика результатов A/B тестирования';



