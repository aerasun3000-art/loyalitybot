-- =====================================================
-- Система лидерборда и призов для промоутеров
-- =====================================================
-- Интеграция с гибридной моделью промоутеров и MLM системы

-- 1. Таблица периодов конкурсов
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

-- 2. Таблица рейтингов участников
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

-- 3. Таблица метрик для расчёта рейтинга
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

-- 4. Таблица распределения призов
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

-- 5. Обновление таблицы promoters
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS total_leaderboard_points NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS best_rank INTEGER;
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS best_rank_period_id INTEGER REFERENCES leaderboard_periods(id);
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS prizes_won INTEGER DEFAULT 0;
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS total_prize_value NUMERIC(10, 2) DEFAULT 0;

-- 6. Обновление таблицы users
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_leaderboard_points NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS leaderboard_wins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_leaderboard_period_id INTEGER REFERENCES leaderboard_periods(id);

-- 7. Функция для обновления updated_at
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

-- 8. Функция для пересчёта рангов
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
            current_rank := current_rank;
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

-- 9. Функция для обновления статистики промоутера
CREATE OR REPLACE FUNCTION update_promoter_leaderboard_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем лучший ранг промоутера
    IF NEW.final_rank IS NOT NULL AND NEW.prize_type != 'none' THEN
        UPDATE promoters
        SET 
            best_rank = LEAST(best_rank, NEW.final_rank) WHERE best_rank IS NULL OR best_rank > NEW.final_rank,
            best_rank_period_id = NEW.period_id,
            total_leaderboard_points = total_leaderboard_points + NEW.total_score
        WHERE client_chat_id = NEW.client_chat_id;
        
        -- Если выиграл приз
        IF NEW.prize_earned IS NOT NULL AND NEW.prize_type != 'none' THEN
            UPDATE promoters
            SET 
                prizes_won = prizes_won + 1,
                total_prize_value = total_prize_value + COALESCE(NEW.prize_value, 0)
            WHERE client_chat_id = NEW.client_chat_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления статистики промоутера
DROP TRIGGER IF EXISTS trigger_update_promoter_stats ON leaderboard_rankings;
CREATE TRIGGER trigger_update_promoter_stats
    AFTER INSERT OR UPDATE ON leaderboard_rankings
    FOR EACH ROW
    WHEN (NEW.final_rank IS NOT NULL)
    EXECUTE FUNCTION update_promoter_leaderboard_stats();

-- 10. Функция для автоматического создания месячного периода
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

-- 11. RLS политики для безопасности
ALTER TABLE leaderboard_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize_distributions ENABLE ROW LEVEL SECURITY;

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
    USING (auth.uid()::text = client_chat_id);

-- 12. Комментарии к таблицам
COMMENT ON TABLE leaderboard_periods IS 'Периоды конкурсов лидерборда (месяц, квартал, год)';
COMMENT ON TABLE leaderboard_rankings IS 'Рейтинги участников за каждый период';
COMMENT ON TABLE leaderboard_metrics IS 'Детальные метрики для расчёта рейтинга';
COMMENT ON TABLE prize_distributions IS 'Распределение призов победителям';
COMMENT ON COLUMN leaderboard_periods.prizes_config IS 'JSON конфигурация призов: {"1": {"type": "physical", "name": "MacBook", ...}, "2": {...}}';
COMMENT ON COLUMN leaderboard_rankings.total_score IS 'Общий рейтинг = referral_points * 1.0 + ugc_points * 1.2 + bonus_points * 1.5';

