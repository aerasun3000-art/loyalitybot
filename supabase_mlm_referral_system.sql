-- MLM Реферальная система (Гибридная модель)
-- Создание таблиц и обновление структуры для реферальной программы клиентов

-- 1. Таблица дерева рефералов
CREATE TABLE IF NOT EXISTS referral_tree (
    id SERIAL PRIMARY KEY,
    referrer_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    referred_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 5),
    registered_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    total_earned_points INTEGER DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    last_transaction_at TIMESTAMP,
    UNIQUE(referrer_chat_id, referred_chat_id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_referrer ON referral_tree(referrer_chat_id);
CREATE INDEX IF NOT EXISTS idx_referred ON referral_tree(referred_chat_id);
CREATE INDEX IF NOT EXISTS idx_level ON referral_tree(level);
CREATE INDEX IF NOT EXISTS idx_referrer_active ON referral_tree(referrer_chat_id, is_active);

-- 2. Таблица начисленных реферальных бонусов
CREATE TABLE IF NOT EXISTS referral_rewards (
    id SERIAL PRIMARY KEY,
    referrer_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    referred_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('registration', 'transaction', 'achievement')),
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 5),
    points INTEGER NOT NULL,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для наград
CREATE INDEX IF NOT EXISTS idx_referrer_rewards ON referral_rewards(referrer_chat_id);
CREATE INDEX IF NOT EXISTS idx_referred_rewards ON referral_rewards(referred_chat_id);
CREATE INDEX IF NOT EXISTS idx_reward_type ON referral_rewards(reward_type);
CREATE INDEX IF NOT EXISTS idx_reward_created ON referral_rewards(created_at);

-- 3. Обновление таблицы users - добавление полей для реферальной системы
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_chat_id TEXT REFERENCES users(chat_id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_referrals INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referral_earnings INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_level TEXT DEFAULT 'bronze' CHECK (referral_level IN ('bronze', 'silver', 'gold', 'platinum'));

-- Индексы для users
CREATE INDEX IF NOT EXISTS idx_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referred_by ON users(referred_by_chat_id) WHERE referred_by_chat_id IS NOT NULL;

-- 4. Функция для генерации уникального реферального кода
CREATE OR REPLACE FUNCTION generate_referral_code(chat_id_param TEXT)
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    exists_check INTEGER;
BEGIN
    -- Генерируем код на основе chat_id (первые 6 символов хеша)
    code := UPPER(SUBSTRING(MD5(chat_id_param || NOW()::TEXT) FROM 1 FOR 6));
    
    -- Проверяем уникальность
    SELECT COUNT(*) INTO exists_check FROM users WHERE referral_code = code;
    
    -- Если код уже существует, добавляем суффикс
    WHILE exists_check > 0 LOOP
        code := UPPER(SUBSTRING(MD5(chat_id_param || NOW()::TEXT || RANDOM()::TEXT) FROM 1 FOR 6));
        SELECT COUNT(*) INTO exists_check FROM users WHERE referral_code = code;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- 5. Функция для обновления статистики рефералов
CREATE OR REPLACE FUNCTION update_referral_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем статистику реферера
    IF NEW.referrer_chat_id IS NOT NULL THEN
        UPDATE users 
        SET 
            total_referrals = (
                SELECT COUNT(*) 
                FROM referral_tree 
                WHERE referrer_chat_id = NEW.referrer_chat_id
            ),
            active_referrals = (
                SELECT COUNT(*) 
                FROM referral_tree 
                WHERE referrer_chat_id = NEW.referrer_chat_id 
                AND is_active = true
            ),
            total_referral_earnings = (
                SELECT COALESCE(SUM(points), 0)
                FROM referral_rewards
                WHERE referrer_chat_id = NEW.referrer_chat_id
            )
        WHERE chat_id = NEW.referrer_chat_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления статистики
DROP TRIGGER IF EXISTS trigger_update_referral_stats ON referral_tree;
CREATE TRIGGER trigger_update_referral_stats
    AFTER INSERT OR UPDATE ON referral_tree
    FOR EACH ROW
    EXECUTE FUNCTION update_referral_stats();

-- Триггер для обновления статистики при начислении наград
DROP TRIGGER IF EXISTS trigger_update_referral_earnings ON referral_rewards;
CREATE TRIGGER trigger_update_referral_earnings
    AFTER INSERT ON referral_rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_referral_stats();

-- 6. Функция для обновления уровня реферала
CREATE OR REPLACE FUNCTION update_referral_level()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем уровень на основе количества активных рефералов
    IF NEW.active_referrals IS NOT NULL THEN
        UPDATE users
        SET referral_level = CASE
            WHEN active_referrals >= 25 THEN 'platinum'
            WHEN active_referrals >= 10 THEN 'gold'
            WHEN active_referrals >= 5 THEN 'silver'
            ELSE 'bronze'
        END
        WHERE chat_id = NEW.chat_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления уровня
DROP TRIGGER IF EXISTS trigger_update_referral_level ON users;
CREATE TRIGGER trigger_update_referral_level
    AFTER UPDATE OF active_referrals ON users
    FOR EACH ROW
    WHEN (OLD.active_referrals IS DISTINCT FROM NEW.active_referrals)
    EXECUTE FUNCTION update_referral_level();

-- 7. RLS политики для безопасности
ALTER TABLE referral_tree ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Политики для referral_tree
DROP POLICY IF EXISTS "Users can view their own referral tree" ON referral_tree;
CREATE POLICY "Users can view their own referral tree" ON referral_tree
    FOR SELECT
    USING (auth.uid()::text = referrer_chat_id OR auth.uid()::text = referred_chat_id);

-- Политики для referral_rewards
DROP POLICY IF EXISTS "Users can view their own referral rewards" ON referral_rewards;
CREATE POLICY "Users can view their own referral rewards" ON referral_rewards
    FOR SELECT
    USING (auth.uid()::text = referrer_chat_id);

-- 8. Комментарии к таблицам
COMMENT ON TABLE referral_tree IS 'Дерево рефералов: связи между пригласившими и приглашёнными пользователями';
COMMENT ON TABLE referral_rewards IS 'История начисленных реферальных бонусов';
COMMENT ON COLUMN users.referral_code IS 'Уникальный реферальный код пользователя';
COMMENT ON COLUMN users.referred_by_chat_id IS 'Chat ID пользователя, который пригласил';
COMMENT ON COLUMN users.total_referrals IS 'Общее количество приглашённых пользователей';
COMMENT ON COLUMN users.active_referrals IS 'Количество активных рефералов (сделавших транзакцию за последние 30 дней)';
COMMENT ON COLUMN users.total_referral_earnings IS 'Общая сумма заработанных реферальных баллов';
COMMENT ON COLUMN users.referral_level IS 'Уровень в реферальной программе: bronze, silver, gold, platinum';

