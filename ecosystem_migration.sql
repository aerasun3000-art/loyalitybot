-- Миграция для Экосистемы 2.0 (Multi-Niche + B2B Deals)

-- 1. Обновление таблицы partners
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS category_group TEXT DEFAULT 'beauty',
ADD COLUMN IF NOT EXISTS ui_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS default_cashback_percent NUMERIC DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS default_referral_commission_percent NUMERIC DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS work_mode TEXT DEFAULT 'offline' CHECK (work_mode IN ('online', 'offline', 'hybrid'));

-- Добавляем ограничение на category_group, если его нет
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partners_category_group_check') THEN
        ALTER TABLE partners 
        ADD CONSTRAINT partners_category_group_check 
        CHECK (category_group IN ('beauty', 'food', 'retail', 'activity', 'influencer'));
    END IF;
END $$;

-- Индексы для быстрой фильтрации
CREATE INDEX IF NOT EXISTS idx_partners_category_group ON partners(category_group);
CREATE INDEX IF NOT EXISTS idx_partners_work_mode ON partners(work_mode);
CREATE INDEX IF NOT EXISTS idx_partners_city ON partners(city);

-- 2. Создание таблицы B2B Сделок (Partner Deals)
CREATE TABLE IF NOT EXISTS partner_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_partner_chat_id TEXT REFERENCES partners(chat_id) ON DELETE CASCADE,
    target_partner_chat_id TEXT REFERENCES partners(chat_id) ON DELETE CASCADE,
    
    -- Условия сделки
    client_cashback_percent NUMERIC NOT NULL DEFAULT 5.0,
    referral_commission_percent NUMERIC NOT NULL DEFAULT 10.0,
    
    -- Статус и сроки
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'expired', 'paused')),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    
    -- Метаданные
    notes TEXT,
    
    -- Ограничение: только одна активная сделка между парой партнеров
    UNIQUE(source_partner_chat_id, target_partner_chat_id)
);

-- Индексы для быстрого поиска сделок при транзакциях
CREATE INDEX IF NOT EXISTS idx_deals_source ON partner_deals(source_partner_chat_id);
CREATE INDEX IF NOT EXISTS idx_deals_target ON partner_deals(target_partner_chat_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON partner_deals(status);

-- 3. Обновление таблицы partner_applications (для сохранения новых полей при регистрации)
ALTER TABLE partner_applications
ADD COLUMN IF NOT EXISTS category_group TEXT,
ADD COLUMN IF NOT EXISTS work_mode TEXT DEFAULT 'offline' CHECK (work_mode IN ('online', 'offline', 'hybrid')),
ADD COLUMN IF NOT EXISTS default_referral_commission_percent NUMERIC DEFAULT 10.0;

-- Комментарии
COMMENT ON TABLE partner_deals IS 'Индивидуальные B2B соглашения между партнерами о комиссиях';
COMMENT ON COLUMN partners.category_group IS 'Глобальная категория бизнеса для фильтрации (beauty, food, retail, influencer)';
COMMENT ON COLUMN partners.ui_config IS 'JSON конфигурация интерфейса (скрытие кнопок, кастомные тексты)';
COMMENT ON COLUMN partners.work_mode IS 'Режим работы: online (показывается всем городам), offline (только свой город), hybrid (всем городам)';
COMMENT ON COLUMN partners.default_referral_commission_percent IS 'Процент комиссии, который партнер платит системе за клиента от другого партнера (для Revenue Share)';
