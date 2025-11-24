-- =====================================================
-- Система промоутеров, UGC контента и лидерборда
-- =====================================================
-- Выполните этот SQL после миграции MLM системы
-- Порядок: 1) supabase_mlm_referral_system_clean.sql
--          2) supabase_promoters_ugc_leaderboard.sql (этот файл)
--          3) supabase_leaderboard_prizes_system.sql (опционально, если нужны дополнительные функции)

-- =====================================================
-- 1. ТАБЛИЦЫ ПРОМОУТЕРОВ
-- =====================================================

-- Таблица промоутеров
CREATE TABLE IF NOT EXISTS promoters (
    id SERIAL PRIMARY KEY,
    client_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    promoter_level TEXT DEFAULT 'novice' CHECK (promoter_level IN ('novice', 'active', 'pro', 'master')),
    total_publications INTEGER DEFAULT 0,
    approved_publications INTEGER DEFAULT 0,
    total_earned_points INTEGER DEFAULT 0,
    promo_code TEXT UNIQUE,
    joined_at TIMESTAMP DEFAULT NOW(),
    last_publication_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Индексы для промоутеров
CREATE INDEX IF NOT EXISTS idx_promoter_chat_id ON promoters(client_chat_id);
CREATE INDEX IF NOT EXISTS idx_promoter_code ON promoters(promo_code);
CREATE INDEX IF NOT EXISTS idx_promoter_active ON promoters(is_active) WHERE is_active = true;

-- =====================================================
-- 2. ТАБЛИЦЫ UGC КОНТЕНТА
-- =====================================================

-- Таблица UGC контента
CREATE TABLE IF NOT EXISTS ugc_content (
    id SERIAL PRIMARY KEY,
    promoter_chat_id TEXT NOT NULL REFERENCES promoters(client_chat_id) ON DELETE CASCADE,
    content_url TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'telegram', 'vk', 'other')),
    promo_code TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    moderator_notes TEXT,
    likes_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    reward_points INTEGER DEFAULT 0,
    submitted_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    verified_at TIMESTAMP
);

-- Индексы для UGC контента
CREATE INDEX IF NOT EXISTS idx_ugc_promoter ON ugc_content(promoter_chat_id);
CREATE INDEX IF NOT EXISTS idx_ugc_status ON ugc_content(status);
CREATE INDEX IF NOT EXISTS idx_ugc_platform ON ugc_content(platform);
CREATE INDEX IF NOT EXISTS idx_ugc_submitted ON ugc_content(submitted_at);

-- =====================================================
-- 3. ТАБЛИЦЫ ПРОМО-МАТЕРИАЛОВ
-- =====================================================

-- Таблица промо-материалов
CREATE TABLE IF NOT EXISTS promo_materials (
    id SERIAL PRIMARY KEY,
    material_type TEXT NOT NULL CHECK (material_type IN ('logo', 'banner', 'template', 'text', 'video', 'qr')),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_type TEXT,
    platform TEXT, -- для каких платформ подходит ('instagram', 'telegram', 'vk', 'all')
    is_active BOOLEAN DEFAULT true,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для промо-материалов
CREATE INDEX IF NOT EXISTS idx_materials_type ON promo_materials(material_type);
CREATE INDEX IF NOT EXISTS idx_materials_active ON promo_materials(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_materials_platform ON promo_materials(platform);

-- Таблица загрузок материалов (опционально, для аналитики)
CREATE TABLE IF NOT EXISTS material_downloads (
    id SERIAL PRIMARY KEY,
    material_id INTEGER NOT NULL REFERENCES promo_materials(id) ON DELETE CASCADE,
    promoter_chat_id TEXT NOT NULL REFERENCES promoters(client_chat_id) ON DELETE CASCADE,
    downloaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_downloads_material ON material_downloads(material_id);
CREATE INDEX IF NOT EXISTS idx_downloads_promoter ON material_downloads(promoter_chat_id);

-- =====================================================
-- 4. ТАБЛИЦЫ ЛИДЕРБОРДА
-- =====================================================

-- Таблица периодов конкурсов
CREATE TABLE IF NOT EXISTS leaderboard_periods (
    id SERIAL PRIMARY KEY,
    period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
    period_name TEXT NOT NULL, -- "Ноябрь 2025", "Q4 2025", "2025"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'rewards_distributed')),
    prizes_config JSONB NOT NULL, -- Конфигурация призов
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    rewards_distributed_at TIMESTAMP,
    description TEXT
);

-- Индексы для периодов
CREATE INDEX IF NOT EXISTS idx_period_type ON leaderboard_periods(period_type);
CREATE INDEX IF NOT EXISTS idx_period_status ON leaderboard_periods(status);
CREATE INDEX IF NOT EXISTS idx_period_dates ON leaderboard_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_period_active ON leaderboard_periods(status, start_date, end_date) WHERE status = 'active';

-- Таблица рейтингов участников
CREATE TABLE IF NOT EXISTS leaderboard_rankings (
    id SERIAL PRIMARY KEY,
    period_id INTEGER NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    client_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    total_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
    referral_points NUMERIC(10, 2) DEFAULT 0,
    ugc_points NUMERIC(10, 2) DEFAULT 0,
    bonus_points NUMERIC(10, 2) DEFAULT 0,
    final_rank INTEGER,
    prize_earned TEXT, -- Описание приза
    prize_type TEXT CHECK (prize_type IN ('physical', 'points', 'gift_card', 'none')),
    prize_distributed BOOLEAN DEFAULT false,
    prize_distributed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(period_id, client_chat_id)
);

-- Индексы для рейтингов
CREATE INDEX IF NOT EXISTS idx_rankings_period ON leaderboard_rankings(period_id);
CREATE INDEX IF NOT EXISTS idx_rankings_client ON leaderboard_rankings(client_chat_id);
CREATE INDEX IF NOT EXISTS idx_rankings_score ON leaderboard_rankings(period_id, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_rankings_rank ON leaderboard_rankings(period_id, final_rank) WHERE final_rank IS NOT NULL;

-- Таблица метрик для расчёта рейтинга
CREATE TABLE IF NOT EXISTS leaderboard_metrics (
    id SERIAL PRIMARY KEY,
    period_id INTEGER NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    client_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL, -- 'referral_registration', 'referral_transaction', 'ugc_publication', 'ugc_viral', 'achievement', 'regularity_bonus'
    metric_value NUMERIC(10, 2) NOT NULL,
    description TEXT,
    related_id INTEGER, -- ID связанной записи (referral_rewards.id, ugc_content.id, etc.)
    related_table TEXT, -- Таблица связанной записи
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для метрик
CREATE INDEX IF NOT EXISTS idx_metrics_period_client ON leaderboard_metrics(period_id, client_chat_id);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON leaderboard_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_related ON leaderboard_metrics(related_table, related_id) WHERE related_id IS NOT NULL;

-- Таблица распределения призов
CREATE TABLE IF NOT EXISTS prize_distributions (
    id SERIAL PRIMARY KEY,
    period_id INTEGER NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    client_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    prize_type TEXT NOT NULL CHECK (prize_type IN ('physical', 'points', 'gift_card')),
    prize_name TEXT NOT NULL,
    prize_description TEXT,
    prize_value NUMERIC(10, 2), -- Стоимость приза в баллах/рублях
    points_awarded INTEGER, -- Если приз в баллах
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'shipped', 'delivered', 'points_distributed', 'cancelled')),
    delivery_address TEXT,
    delivery_phone TEXT,
    tracking_number TEXT,
    notes TEXT,
    distributed_by TEXT, -- ID администратора
    distributed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для распределения призов
CREATE INDEX IF NOT EXISTS idx_distributions_period ON prize_distributions(period_id);
CREATE INDEX IF NOT EXISTS idx_distributions_client ON prize_distributions(client_chat_id);
CREATE INDEX IF NOT EXISTS idx_distributions_status ON prize_distributions(status);
CREATE INDEX IF NOT EXISTS idx_distributions_rank ON prize_distributions(period_id, rank);

-- =====================================================
-- 5. ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ ТАБЛИЦ
-- =====================================================

-- Обновление таблицы users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_promoter BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS promoter_since TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_leaderboard_points NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS leaderboard_wins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_leaderboard_period_id INTEGER REFERENCES leaderboard_periods(id);

-- Обновление таблицы promoters (если уже существует)
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS total_leaderboard_points NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS best_rank INTEGER;
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS best_rank_period_id INTEGER REFERENCES leaderboard_periods(id);
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS prizes_won INTEGER DEFAULT 0;
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS total_prize_value NUMERIC(10, 2) DEFAULT 0;

-- =====================================================
-- 6. ФУНКЦИИ
-- =====================================================

-- Функция для генерации промо-кода
CREATE OR REPLACE FUNCTION generate_promo_code(chat_id_param TEXT)
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
    attempts INTEGER := 0;
    max_attempts INTEGER := 10;
BEGIN
    LOOP
        -- Генерируем случайный код формата PROMO-XXXXXX
        new_code := 'PROMO-' || UPPER(SUBSTRING(MD5(chat_id_param || NOW()::TEXT || RANDOM()::TEXT) FROM 1 FOR 6));
        
        -- Проверяем уникальность
        SELECT EXISTS(SELECT 1 FROM promoters WHERE promo_code = new_code) INTO code_exists;
        
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
        
        attempts := attempts + 1;
        IF attempts >= max_attempts THEN
            -- Если не удалось сгенерировать уникальный код, используем хеш с timestamp
            new_code := 'PROMO-' || UPPER(SUBSTRING(MD5(chat_id_param || EXTRACT(EPOCH FROM NOW())::TEXT) FROM 1 FOR 6));
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления статистики промоутера при одобрении UGC
CREATE OR REPLACE FUNCTION update_promoter_on_ugc_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        -- Обновляем статистику промоутера
        UPDATE promoters
        SET 
            approved_publications = approved_publications + 1,
            total_publications = total_publications + 1,
            total_earned_points = total_earned_points + COALESCE(NEW.reward_points, 0),
            last_publication_at = NOW()
        WHERE client_chat_id = NEW.promoter_chat_id;
        
        -- Обновляем время одобрения
        NEW.approved_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления статистики при одобрении UGC
DROP TRIGGER IF EXISTS trigger_update_promoter_on_ugc_approval ON ugc_content;
CREATE TRIGGER trigger_update_promoter_on_ugc_approval
    AFTER UPDATE OF status ON ugc_content
    FOR EACH ROW
    WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
    EXECUTE FUNCTION update_promoter_on_ugc_approval();

-- Функция для обновления статистики промоутера при выигрыше приза
CREATE OR REPLACE FUNCTION update_promoter_on_prize_win()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.prize_earned IS NOT NULL AND NEW.prize_type != 'none' THEN
        UPDATE promoters
        SET 
            prizes_won = prizes_won + 1,
            total_prize_value = total_prize_value + COALESCE(NEW.prize_value, 0),
            best_rank = CASE 
                WHEN best_rank IS NULL OR best_rank > NEW.final_rank THEN NEW.final_rank 
                ELSE best_rank 
            END,
            best_rank_period_id = CASE 
                WHEN best_rank IS NULL OR best_rank > NEW.final_rank THEN NEW.period_id 
                ELSE best_rank_period_id 
            END
        WHERE client_chat_id = NEW.client_chat_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления статистики при выигрыше приза
DROP TRIGGER IF EXISTS trigger_update_promoter_on_prize_win ON leaderboard_rankings;
CREATE TRIGGER trigger_update_promoter_on_prize_win
    AFTER INSERT OR UPDATE ON leaderboard_rankings
    FOR EACH ROW
    WHEN (NEW.prize_earned IS NOT NULL AND NEW.prize_type != 'none')
    EXECUTE FUNCTION update_promoter_on_prize_win();

-- Функция для пересчёта рангов в лидерборде
CREATE OR REPLACE FUNCTION recalculate_leaderboard_ranks(period_id_param INTEGER)
RETURNS void AS $$
DECLARE
    ranking_record RECORD;
    current_rank INTEGER := 1;
    previous_score NUMERIC := -1;
BEGIN
    -- Обновляем final_rank на основе total_score
    FOR ranking_record IN
        SELECT id, total_score
        FROM leaderboard_rankings
        WHERE period_id = period_id_param
        ORDER BY total_score DESC, created_at ASC
    LOOP
        -- Если очки отличаются, увеличиваем ранг
        IF ranking_record.total_score != previous_score THEN
            previous_score := ranking_record.total_score;
        END IF;
        
        -- Обновляем ранг
        UPDATE leaderboard_rankings
        SET final_rank = current_rank
        WHERE id = ranking_record.id;
        
        current_rank := current_rank + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Функция для автоматической активации периодов лидерборда
CREATE OR REPLACE FUNCTION activate_upcoming_periods()
RETURNS INTEGER AS $$
DECLARE
    activated_count INTEGER := 0;
    period_record RECORD;
BEGIN
    -- Активируем периоды, которые должны начаться сегодня
    FOR period_record IN
        SELECT id, period_name
        FROM leaderboard_periods
        WHERE status = 'upcoming'
        AND start_date <= CURRENT_DATE
        AND end_date >= CURRENT_DATE
    LOOP
        UPDATE leaderboard_periods
        SET status = 'active'
        WHERE id = period_record.id;
        
        activated_count := activated_count + 1;
        
        RAISE NOTICE 'Период "%" активирован', period_record.period_name;
    END LOOP;
    
    -- Завершаем периоды, которые закончились
    FOR period_record IN
        SELECT id, period_name
        FROM leaderboard_periods
        WHERE status = 'active'
        AND end_date < CURRENT_DATE
    LOOP
        UPDATE leaderboard_periods
        SET status = 'completed'
        WHERE id = period_record.id;
        
        RAISE NOTICE 'Период "%" завершён', period_record.period_name;
    END LOOP;
    
    RETURN activated_count;
END;
$$ LANGUAGE plpgsql;

-- Функция для создания месячного периода лидерборда
CREATE OR REPLACE FUNCTION create_monthly_leaderboard_period(target_month DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
    period_start DATE;
    period_end DATE;
    period_name TEXT;
    period_id INTEGER;
    default_prizes JSONB;
BEGIN
    -- Определяем начало и конец месяца
    period_start := DATE_TRUNC('month', target_month)::DATE;
    period_end := (DATE_TRUNC('month', target_month) + INTERVAL '1 month - 1 day')::DATE;
    
    -- Генерируем название периода
    period_name := TO_CHAR(target_month, 'Month YYYY');
    
    -- Конфигурация призов по умолчанию для месячного конкурса
    default_prizes := jsonb_build_object(
        '1', jsonb_build_object(
            'type', 'physical',
            'name', 'AirPods Pro',
            'alternative_points', 5000,
            'description', 'AirPods Pro 2'
        ),
        '2', jsonb_build_object(
            'type', 'physical',
            'name', 'Apple Watch SE',
            'alternative_points', 3000,
            'description', 'Apple Watch SE 2'
        ),
        '3', jsonb_build_object(
            'type', 'points',
            'points', 2000,
            'description', '2000 баллов'
        ),
        '4-10', jsonb_build_object(
            'type', 'points',
            'points', 1000,
            'description', '1000 баллов'
        )
    );
    
    -- Создаём период
    INSERT INTO leaderboard_periods (
        period_type,
        period_name,
        start_date,
        end_date,
        status,
        prizes_config
    ) VALUES (
        'monthly',
        period_name,
        period_start,
        period_end,
        'upcoming',
        default_prizes
    ) RETURNING id INTO period_id;
    
    RETURN period_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления updated_at в leaderboard_rankings
CREATE OR REPLACE FUNCTION update_leaderboard_rankings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_rankings_updated_at ON leaderboard_rankings;
CREATE TRIGGER trigger_update_rankings_updated_at
    BEFORE UPDATE ON leaderboard_rankings
    FOR EACH ROW
    EXECUTE FUNCTION update_leaderboard_rankings_updated_at();

-- =====================================================
-- 7. RLS ПОЛИТИКИ
-- =====================================================

-- Включаем RLS для всех таблиц
ALTER TABLE promoters ENABLE ROW LEVEL SECURITY;
ALTER TABLE ugc_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize_distributions ENABLE ROW LEVEL SECURITY;

-- Политики для promoters (пользователи видят только себя)
DROP POLICY IF EXISTS "Users can view their own promoter info" ON promoters;
CREATE POLICY "Users can view their own promoter info" ON promoters
    FOR SELECT
    USING (auth.uid()::text = client_chat_id OR client_chat_id = current_setting('app.current_user_id', true));

-- Политики для ugc_content (пользователи видят только свой контент)
DROP POLICY IF EXISTS "Users can view their own UGC" ON ugc_content;
CREATE POLICY "Users can view their own UGC" ON ugc_content
    FOR SELECT
    USING (auth.uid()::text = promoter_chat_id OR promoter_chat_id = current_setting('app.current_user_id', true));

-- Политики для promo_materials (все могут видеть активные материалы)
DROP POLICY IF EXISTS "Anyone can view active promo materials" ON promo_materials;
CREATE POLICY "Anyone can view active promo materials" ON promo_materials
    FOR SELECT
    USING (is_active = true);

-- Политики для leaderboard_periods (все могут видеть активные периоды)
DROP POLICY IF EXISTS "Anyone can view active periods" ON leaderboard_periods;
CREATE POLICY "Anyone can view active periods" ON leaderboard_periods
    FOR SELECT
    USING (status IN ('active', 'completed', 'rewards_distributed'));

-- Политики для leaderboard_rankings (все могут видеть рейтинги активных периодов)
DROP POLICY IF EXISTS "Anyone can view active rankings" ON leaderboard_rankings;
CREATE POLICY "Anyone can view active rankings" ON leaderboard_rankings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM leaderboard_periods 
            WHERE id = leaderboard_rankings.period_id 
            AND status IN ('active', 'completed', 'rewards_distributed')
        )
    );

-- Политики для prize_distributions (пользователи видят только свои призы)
DROP POLICY IF EXISTS "Users can view their own prizes" ON prize_distributions;
CREATE POLICY "Users can view their own prizes" ON prize_distributions
    FOR SELECT
    USING (auth.uid()::text = client_chat_id OR client_chat_id = current_setting('app.current_user_id', true));

-- =====================================================
-- 8. КОММЕНТАРИИ
-- =====================================================

COMMENT ON TABLE promoters IS 'Промоутеры - клиенты, которые активно продвигают бренд';
COMMENT ON TABLE ugc_content IS 'UGC контент - пользовательский контент от промоутеров';
COMMENT ON TABLE promo_materials IS 'Промо-материалы для использования промоутерами';
COMMENT ON TABLE leaderboard_periods IS 'Периоды конкурсов лидерборда (месяц, квартал, год)';
COMMENT ON TABLE leaderboard_rankings IS 'Рейтинги участников за каждый период';
COMMENT ON TABLE leaderboard_metrics IS 'Детальные метрики для расчёта рейтинга';
COMMENT ON TABLE prize_distributions IS 'Распределение призов победителям';

COMMENT ON FUNCTION generate_promo_code IS 'Генерирует уникальный промо-код для промоутера';
COMMENT ON FUNCTION update_promoter_on_ugc_approval IS 'Обновляет статистику промоутера при одобрении UGC контента';
COMMENT ON FUNCTION recalculate_leaderboard_ranks IS 'Пересчитывает ранги участников в лидерборде';
COMMENT ON FUNCTION activate_upcoming_periods IS 'Автоматически активирует периоды лидерборда, которые должны начаться сегодня';
COMMENT ON FUNCTION create_monthly_leaderboard_period IS 'Создаёт месячный период лидерборда с призами по умолчанию';

-- =====================================================
-- ГОТОВО!
-- =====================================================
-- После выполнения этой миграции:
-- 1. Выполните init_beta_data.sql для инициализации данных
-- 2. Проверьте созданные таблицы через SQL запросы
-- 3. Запустите боты и протестируйте систему
