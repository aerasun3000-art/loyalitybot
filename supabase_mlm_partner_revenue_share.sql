-- ============================================
-- MLM Партнерская система с Revenue Share
-- Создание таблиц и структуры для партнерской программы с 3 уровнями
-- ============================================

-- 1. Таблица партнеров MLM (расширение существующей таблицы partners)
-- Добавляем поля для MLM партнерской программы
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS partner_type TEXT DEFAULT 'regular' CHECK (partner_type IN ('regular', 'partner', 'regional', 'master'));

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS partner_level INTEGER DEFAULT 0 CHECK (partner_level >= 0 AND partner_level <= 3);

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS referred_by_chat_id TEXT REFERENCES partners(chat_id) ON DELETE SET NULL;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS partner_package_purchased_at TIMESTAMP;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS personal_income_monthly NUMERIC DEFAULT 0;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS client_base_count INTEGER DEFAULT 0;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS revenue_share_monthly NUMERIC DEFAULT 0;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS total_revenue_share_earned NUMERIC DEFAULT 0;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS is_revenue_share_active BOOLEAN DEFAULT false;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS revenue_share_activation_date TIMESTAMP;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS last_revenue_share_calculation TIMESTAMP;

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS pv_percent NUMERIC DEFAULT 10.0 CHECK (pv_percent >= 0 AND pv_percent <= 100);

ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS industry_type TEXT;

-- Индексы для партнеров
CREATE INDEX IF NOT EXISTS idx_partners_type ON partners(partner_type);
CREATE INDEX IF NOT EXISTS idx_partners_level ON partners(partner_level);
CREATE INDEX IF NOT EXISTS idx_partners_referred_by ON partners(referred_by_chat_id) WHERE referred_by_chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_revenue_active ON partners(is_revenue_share_active);

-- 2. Таблица сети партнеров (связи между партнерами)
CREATE TABLE IF NOT EXISTS partner_network (
    id SERIAL PRIMARY KEY,
    referrer_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
    referred_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 3),
    registered_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    client_base_shared BOOLEAN DEFAULT false,
    UNIQUE(referrer_chat_id, referred_chat_id)
);

-- Индексы для сети партнеров
CREATE INDEX IF NOT EXISTS idx_network_referrer ON partner_network(referrer_chat_id);
CREATE INDEX IF NOT EXISTS idx_network_referred ON partner_network(referred_chat_id);
CREATE INDEX IF NOT EXISTS idx_network_level ON partner_network(level);
CREATE INDEX IF NOT EXISTS idx_network_active ON partner_network(is_active);

-- 3. Таблица Revenue Share выплат
CREATE TABLE IF NOT EXISTS partner_revenue_share (
    id SERIAL PRIMARY KEY,
    partner_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
    source_partner_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 3),
    system_revenue NUMERIC NOT NULL,
    revenue_share_percent NUMERIC NOT NULL DEFAULT 5.0,
    calculated_amount NUMERIC NOT NULL,
    personal_income_limit NUMERIC NOT NULL,
    personal_income_30_percent NUMERIC NOT NULL,
    final_amount NUMERIC NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
    created_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP,
    description TEXT
);

-- Индексы для Revenue Share
CREATE INDEX IF NOT EXISTS idx_revenue_partner ON partner_revenue_share(partner_chat_id);
CREATE INDEX IF NOT EXISTS idx_revenue_source ON partner_revenue_share(source_partner_chat_id);
CREATE INDEX IF NOT EXISTS idx_revenue_level ON partner_revenue_share(level);
CREATE INDEX IF NOT EXISTS idx_revenue_status ON partner_revenue_share(status);
CREATE INDEX IF NOT EXISTS idx_revenue_period ON partner_revenue_share(period_start, period_end);

-- 4. Таблица комиссий за рекрутинг
CREATE TABLE IF NOT EXISTS partner_recruitment_commissions (
    id SERIAL PRIMARY KEY,
    referrer_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
    referred_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 2),
    subscription_amount NUMERIC NOT NULL,
    commission_percent NUMERIC NOT NULL,
    commission_amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
    created_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP,
    description TEXT
);

-- Индексы для комиссий рекрутинга
CREATE INDEX IF NOT EXISTS idx_recruitment_referrer ON partner_recruitment_commissions(referrer_chat_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_referred ON partner_recruitment_commissions(referred_chat_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_status ON partner_recruitment_commissions(status);

-- 5. Таблица условий активации Revenue Share
CREATE TABLE IF NOT EXISTS partner_activation_conditions (
    id SERIAL PRIMARY KEY,
    partner_chat_id TEXT NOT NULL UNIQUE REFERENCES partners(chat_id) ON DELETE CASCADE,
    uses_product BOOLEAN DEFAULT false,
    client_base_count INTEGER DEFAULT 0,
    personal_income_monthly NUMERIC DEFAULT 0,
    meets_all_conditions BOOLEAN DEFAULT false,
    last_check_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для условий активации
CREATE INDEX IF NOT EXISTS idx_activation_partner ON partner_activation_conditions(partner_chat_id);
CREATE INDEX IF NOT EXISTS idx_activation_meets ON partner_activation_conditions(meets_all_conditions);

-- 6. Функция для проверки условий активации Revenue Share
CREATE OR REPLACE FUNCTION check_revenue_share_activation(partner_chat_id_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    partner_record RECORD;
    meets_conditions BOOLEAN := false;
BEGIN
    -- Получаем данные партнера
    SELECT 
        personal_income_monthly,
        client_base_count,
        is_revenue_share_active
    INTO partner_record
    FROM partners
    WHERE chat_id = partner_chat_id_param;
    
    -- Проверяем условия:
    -- 1. Личный доход >= $500/мес
    -- 2. Клиентская база >= 20 клиентов
    -- 3. Использует продукт (personal_income > 0)
    IF partner_record.personal_income_monthly >= 500 
       AND partner_record.client_base_count >= 20 
       AND partner_record.personal_income_monthly > 0 THEN
        meets_conditions := true;
    END IF;
    
    -- Обновляем статус активации
    UPDATE partners
    SET 
        is_revenue_share_active = meets_conditions,
        revenue_share_activation_date = CASE 
            WHEN meets_conditions AND NOT is_revenue_share_active THEN NOW()
            ELSE revenue_share_activation_date
        END
    WHERE chat_id = partner_chat_id_param;
    
    -- Обновляем таблицу условий
    INSERT INTO partner_activation_conditions (
        partner_chat_id,
        uses_product,
        client_base_count,
        personal_income_monthly,
        meets_all_conditions,
        last_check_at,
        updated_at
    )
    VALUES (
        partner_chat_id_param,
        partner_record.personal_income_monthly > 0,
        partner_record.client_base_count,
        partner_record.personal_income_monthly,
        meets_conditions,
        NOW(),
        NOW()
    )
    ON CONFLICT (partner_chat_id) DO UPDATE
    SET
        uses_product = partner_record.personal_income_monthly > 0,
        client_base_count = partner_record.client_base_count,
        personal_income_monthly = partner_record.personal_income_monthly,
        meets_all_conditions = meets_conditions,
        last_check_at = NOW(),
        updated_at = NOW();
    
    RETURN meets_conditions;
END;
$$ LANGUAGE plpgsql;

-- 7. Функция для автоматического расчета PV на основе личного дохода
CREATE OR REPLACE FUNCTION calculate_pv_by_income(personal_income_param NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    calculated_pv NUMERIC;
BEGIN
    -- Логика расчета PV на основе личного дохода:
    -- $0-999/мес: PV = 3%
    -- $1,000-1,999/мес: PV = 5%
    -- $2,000-4,999/мес: PV = 7%
    -- $5,000+/мес: PV = 10%
    
    CASE
        WHEN personal_income_param >= 5000 THEN
            calculated_pv := 10.0;
        WHEN personal_income_param >= 2000 THEN
            calculated_pv := 7.0;
        WHEN personal_income_param >= 1000 THEN
            calculated_pv := 5.0;
        ELSE
            calculated_pv := 3.0;
    END CASE;
    
    RETURN calculated_pv;
END;
$$ LANGUAGE plpgsql;

-- 8. Функция для расчета Revenue Share с ограничением 30%
CREATE OR REPLACE FUNCTION calculate_revenue_share(
    partner_chat_id_param TEXT,
    source_partner_chat_id_param TEXT,
    system_revenue_param NUMERIC,
    level_param INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
    partner_record RECORD;
    revenue_share_percent NUMERIC := 5.0;
    calculated_amount NUMERIC;
    personal_income_limit NUMERIC;
    personal_income_30_percent NUMERIC;
    final_amount NUMERIC;
BEGIN
    -- Получаем данные партнера
    SELECT 
        personal_income_monthly,
        is_revenue_share_active
    INTO partner_record
    FROM partners
    WHERE chat_id = partner_chat_id_param;
    
    -- Проверяем активацию
    IF NOT partner_record.is_revenue_share_active THEN
        RETURN 0;
    END IF;
    
    -- Процент Revenue Share зависит от уровня
    revenue_share_percent := CASE level_param
        WHEN 1 THEN 5.0
        WHEN 2 THEN 5.0
        WHEN 3 THEN 5.0
        ELSE 0.0
    END;
    
    -- Рассчитываем сумму Revenue Share
    calculated_amount := system_revenue_param * (revenue_share_percent / 100.0);
    
    -- Рассчитываем лимит (30% от личного дохода)
    personal_income_30_percent := partner_record.personal_income_monthly * 0.30;
    
    -- Применяем ограничение
    final_amount := LEAST(calculated_amount, personal_income_30_percent);
    
    RETURN final_amount;
END;
$$ LANGUAGE plpgsql;

-- 9. Функция для автоматического обновления PV при изменении дохода
CREATE OR REPLACE FUNCTION auto_update_pv_on_income_change()
RETURNS TRIGGER AS $$
DECLARE
    new_pv NUMERIC;
BEGIN
    -- Автоматически обновляем PV при изменении личного дохода
    IF OLD.personal_income_monthly IS DISTINCT FROM NEW.personal_income_monthly THEN
        new_pv := calculate_pv_by_income(NEW.personal_income_monthly);
        
        -- Обновляем PV только если он изменился
        IF NEW.pv_percent IS NULL OR NEW.pv_percent != new_pv THEN
            NEW.pv_percent := new_pv;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления PV
DROP TRIGGER IF EXISTS trigger_auto_update_pv ON partners;
CREATE TRIGGER trigger_auto_update_pv
    BEFORE UPDATE OF personal_income_monthly ON partners
    FOR EACH ROW
    WHEN (OLD.personal_income_monthly IS DISTINCT FROM NEW.personal_income_monthly)
    EXECUTE FUNCTION auto_update_pv_on_income_change();

-- 10. Функция для обновления статистики партнера
CREATE OR REPLACE FUNCTION update_partner_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем статистику реферера
    IF NEW.referrer_chat_id IS NOT NULL THEN
        UPDATE partners 
        SET 
            partner_level = (
                SELECT MAX(level) 
                FROM partner_network 
                WHERE referrer_chat_id = NEW.referrer_chat_id
            ) + 1
        WHERE chat_id = NEW.referrer_chat_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления статистики
DROP TRIGGER IF EXISTS trigger_update_partner_stats ON partner_network;
CREATE TRIGGER trigger_update_partner_stats
    AFTER INSERT OR UPDATE ON partner_network
    FOR EACH ROW
    EXECUTE FUNCTION update_partner_stats();

-- 11. Функция для обновления Revenue Share при начислении
CREATE OR REPLACE FUNCTION update_revenue_share_total()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
        UPDATE partners
        SET 
            total_revenue_share_earned = COALESCE(total_revenue_share_earned, 0) + NEW.final_amount,
            revenue_share_monthly = (
                SELECT COALESCE(SUM(final_amount), 0)
                FROM partner_revenue_share
                WHERE partner_chat_id = NEW.partner_chat_id
                  AND status = 'paid'
                  AND period_start >= DATE_TRUNC('month', CURRENT_DATE)
            )
        WHERE chat_id = NEW.partner_chat_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления Revenue Share
DROP TRIGGER IF EXISTS trigger_update_revenue_share_total ON partner_revenue_share;
CREATE TRIGGER trigger_update_revenue_share_total
    AFTER UPDATE OF status ON partner_revenue_share
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_revenue_share_total();

-- 12. RLS политики для безопасности
ALTER TABLE partner_network ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_revenue_share ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_recruitment_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_activation_conditions ENABLE ROW LEVEL SECURITY;

-- Политики для partner_network
DROP POLICY IF EXISTS "Partners can view their own network" ON partner_network;
CREATE POLICY "Partners can view their own network" ON partner_network
    FOR SELECT
    USING (auth.uid()::text = referrer_chat_id OR auth.uid()::text = referred_chat_id);

-- Политики для partner_revenue_share
DROP POLICY IF EXISTS "Partners can view their own revenue share" ON partner_revenue_share;
CREATE POLICY "Partners can view their own revenue share" ON partner_revenue_share
    FOR SELECT
    USING (auth.uid()::text = partner_chat_id);

-- Политики для partner_recruitment_commissions
DROP POLICY IF EXISTS "Partners can view their own commissions" ON partner_recruitment_commissions;
CREATE POLICY "Partners can view their own commissions" ON partner_recruitment_commissions
    FOR SELECT
    USING (auth.uid()::text = referrer_chat_id);

-- Политики для partner_activation_conditions
DROP POLICY IF EXISTS "Partners can view their own activation" ON partner_activation_conditions;
CREATE POLICY "Partners can view their own activation" ON partner_activation_conditions
    FOR SELECT
    USING (auth.uid()::text = partner_chat_id);

-- 13. Комментарии к таблицам
COMMENT ON TABLE partner_network IS 'Сеть партнеров: связи между реферерами и приглашенными партнерами (до 3 уровней)';
COMMENT ON TABLE partner_revenue_share IS 'История выплат Revenue Share с ограничением 30% от личного дохода';
COMMENT ON TABLE partner_recruitment_commissions IS 'Комиссии за рекрутинг партнеров (5% за 1-го, 30% за 2-го)';
COMMENT ON TABLE partner_activation_conditions IS 'Условия активации Revenue Share для каждого партнера';

COMMENT ON COLUMN partners.partner_type IS 'Тип партнера: regular, partner, regional, master';
COMMENT ON COLUMN partners.partner_level IS 'Уровень партнера в сети (0-3)';
COMMENT ON COLUMN partners.referred_by_chat_id IS 'Chat ID партнера, который пригласил';
COMMENT ON COLUMN partners.personal_income_monthly IS 'Личный доход партнера от использования продукта ($/мес)';
COMMENT ON COLUMN partners.client_base_count IS 'Количество клиентов в базе партнера';
COMMENT ON COLUMN partners.revenue_share_monthly IS 'Revenue Share за текущий месяц';
COMMENT ON COLUMN partners.is_revenue_share_active IS 'Активен ли Revenue Share (выполнены все условия)';
COMMENT ON COLUMN partners.pv_percent IS 'PV (Partner Value) - процент от доходов партнера, который получает система (0-100%)';
COMMENT ON COLUMN partners.industry_type IS 'Тип отрасли партнера (cafe, salon, fitness, etc.) для настройки PV';

-- 14. Представление для статистики партнеров
CREATE OR REPLACE VIEW partner_statistics AS
SELECT 
    p.chat_id,
    p.name,
    p.company_name,
    p.partner_type,
    p.partner_level,
    p.personal_income_monthly,
    p.client_base_count,
    p.revenue_share_monthly,
    p.total_revenue_share_earned,
    p.is_revenue_share_active,
    COUNT(DISTINCT pn1.referred_chat_id) as direct_referrals,
    COUNT(DISTINCT pn2.referred_chat_id) as total_network_size,
    COALESCE(SUM(prs.final_amount), 0) as total_revenue_share_paid
FROM partners p
LEFT JOIN partner_network pn1 ON p.chat_id = pn1.referrer_chat_id AND pn1.level = 1
LEFT JOIN partner_network pn2 ON p.chat_id = pn2.referrer_chat_id
LEFT JOIN partner_revenue_share prs ON p.chat_id = prs.partner_chat_id AND prs.status = 'paid'
WHERE p.partner_type != 'regular'
GROUP BY p.chat_id, p.name, p.company_name, p.partner_type, p.partner_level,
         p.personal_income_monthly, p.client_base_count, p.revenue_share_monthly,
         p.total_revenue_share_earned, p.is_revenue_share_active;

