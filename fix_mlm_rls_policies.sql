-- ============================================
-- Исправление RLS политик для MLM системы
-- Политики для работы с service role (Telegram боты)
-- ============================================

-- Отключаем RLS для таблиц, которые используются через service role
-- Доступ контролируется через бэкенд (боты)

-- 1. Политики для partner_network
DROP POLICY IF EXISTS "Partners can view their own network" ON partner_network;
DROP POLICY IF EXISTS "Service role can manage network" ON partner_network;

-- Разрешаем все операции через service role
CREATE POLICY "Service role can manage network" ON partner_network
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. Политики для partner_revenue_share
DROP POLICY IF EXISTS "Partners can view their own revenue share" ON partner_revenue_share;
DROP POLICY IF EXISTS "Service role can manage revenue share" ON partner_revenue_share;

-- Разрешаем все операции через service role
CREATE POLICY "Service role can manage revenue share" ON partner_revenue_share
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Политики для partner_recruitment_commissions
DROP POLICY IF EXISTS "Partners can view their own commissions" ON partner_recruitment_commissions;
DROP POLICY IF EXISTS "Service role can manage commissions" ON partner_recruitment_commissions;

-- Разрешаем все операции через service role
CREATE POLICY "Service role can manage commissions" ON partner_recruitment_commissions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. Политики для partner_activation_conditions
DROP POLICY IF EXISTS "Partners can view their own activation" ON partner_activation_conditions;
DROP POLICY IF EXISTS "Service role can manage activation" ON partner_activation_conditions;

-- Разрешаем все операции через service role
CREATE POLICY "Service role can manage activation" ON partner_activation_conditions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Обновляем функцию check_revenue_share_activation для работы с service role
-- Функция должна использовать SECURITY DEFINER для обхода RLS
CREATE OR REPLACE FUNCTION check_revenue_share_activation(partner_chat_id_param TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
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

-- Комментарий
COMMENT ON FUNCTION check_revenue_share_activation IS 'Проверяет условия активации Revenue Share. Использует SECURITY DEFINER для обхода RLS.';

