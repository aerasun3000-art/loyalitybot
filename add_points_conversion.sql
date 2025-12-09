-- =====================================================
-- ДОБАВЛЕНИЕ ФУНКЦИИ КОНВЕРТАЦИИ ПРОМО-БАЛЛОВ
-- =====================================================
-- Добавляет возможность конвертировать баллы лидерборда 
-- в обычные баллы системы лояльности в конце периода

-- =====================================================
-- 1. ОБНОВЛЕНИЕ ТАБЛИЦЫ leaderboard_periods
-- =====================================================

-- Добавляем поле для курса конвертации (в процентах, например 10 = 10%)
ALTER TABLE leaderboard_periods 
ADD COLUMN IF NOT EXISTS points_conversion_rate NUMERIC(5, 2) DEFAULT 10.0;

-- Добавляем поле для включения/выключения конвертации
ALTER TABLE leaderboard_periods 
ADD COLUMN IF NOT EXISTS points_conversion_enabled BOOLEAN DEFAULT true;

-- Комментарии
COMMENT ON COLUMN leaderboard_periods.points_conversion_rate IS 'Курс конвертации промо-баллов в обычные баллы (в процентах, например 10.0 = 10%)';
COMMENT ON COLUMN leaderboard_periods.points_conversion_enabled IS 'Разрешена ли конвертация баллов для этого периода';

-- =====================================================
-- 2. ОБНОВЛЕНИЕ ТАБЛИЦЫ leaderboard_rankings
-- =====================================================

-- Добавляем поле для отслеживания конвертированных баллов
ALTER TABLE leaderboard_rankings 
ADD COLUMN IF NOT EXISTS points_converted BOOLEAN DEFAULT false;

-- Добавляем поле для количества конвертированных баллов
ALTER TABLE leaderboard_rankings 
ADD COLUMN IF NOT EXISTS points_converted_amount NUMERIC(10, 2) DEFAULT 0;

-- Добавляем поле для времени конвертации
ALTER TABLE leaderboard_rankings 
ADD COLUMN IF NOT EXISTS points_converted_at TIMESTAMP;

-- Комментарии
COMMENT ON COLUMN leaderboard_rankings.points_converted IS 'Были ли баллы конвертированы в обычные баллы';
COMMENT ON COLUMN leaderboard_rankings.points_converted_amount IS 'Количество конвертированных баллов';
COMMENT ON COLUMN leaderboard_rankings.points_converted_at IS 'Время конвертации баллов';

-- =====================================================
-- 3. ФУНКЦИЯ КОНВЕРТАЦИИ БАЛЛОВ
-- =====================================================

CREATE OR REPLACE FUNCTION convert_leaderboard_points_to_loyalty_points(
    period_id_param INTEGER,
    client_chat_id_param TEXT
)
RETURNS JSONB AS $$
DECLARE
    period_record RECORD;
    ranking_record RECORD;
    conversion_rate NUMERIC;
    leaderboard_points NUMERIC;
    loyalty_points NUMERIC;
    already_converted BOOLEAN;
    has_prize BOOLEAN;
    result JSONB;
BEGIN
    -- Получаем информацию о периоде
    SELECT 
        id,
        status,
        points_conversion_rate,
        points_conversion_enabled
    INTO period_record
    FROM leaderboard_periods
    WHERE id = period_id_param;
    
    -- Проверяем, существует ли период
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Период не найден'
        );
    END IF;
    
    -- Проверяем, завершён ли период и распределены ли призы
    IF period_record.status != 'rewards_distributed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Период ещё не завершён или призы не распределены'
        );
    END IF;
    
    -- Проверяем, разрешена ли конвертация
    IF NOT period_record.points_conversion_enabled THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Конвертация баллов не разрешена для этого периода'
        );
    END IF;
    
    -- Получаем информацию о рейтинге участника
    SELECT 
        total_score,
        points_converted,
        prize_type,
        prize_distributed
    INTO ranking_record
    FROM leaderboard_rankings
    WHERE period_id = period_id_param
    AND client_chat_id = client_chat_id_param;
    
    -- Проверяем, существует ли рейтинг
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Участник не найден в рейтинге этого периода'
        );
    END IF;
    
    -- Проверяем, не конвертированы ли уже баллы
    IF ranking_record.points_converted THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Баллы уже были конвертированы',
            'converted_amount', ranking_record.points_converted_amount
        );
    END IF;
    
    -- Проверяем, получил ли участник приз
    has_prize := (ranking_record.prize_type IS NOT NULL 
                  AND ranking_record.prize_type != 'none'
                  AND ranking_record.prize_distributed = true);
    
    IF has_prize THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Участники, получившие призы, не могут конвертировать баллы'
        );
    END IF;
    
    -- Вычисляем количество баллов для конвертации
    leaderboard_points := COALESCE(ranking_record.total_score, 0);
    conversion_rate := COALESCE(period_record.points_conversion_rate, 10.0);
    loyalty_points := ROUND(leaderboard_points * (conversion_rate / 100.0), 2);
    
    -- Проверяем, есть ли баллы для конвертации
    IF loyalty_points <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Недостаточно баллов для конвертации'
        );
    END IF;
    
    -- Обновляем запись в рейтинге
    UPDATE leaderboard_rankings
    SET 
        points_converted = true,
        points_converted_amount = loyalty_points,
        points_converted_at = NOW()
    WHERE period_id = period_id_param
    AND client_chat_id = client_chat_id_param;
    
    -- Возвращаем результат
    result := jsonb_build_object(
        'success', true,
        'leaderboard_points', leaderboard_points,
        'conversion_rate', conversion_rate,
        'loyalty_points', loyalty_points,
        'message', format('Конвертировано %.2f баллов лидерборда в %.2f баллов лояльности (курс: %.2f%%)', 
                         leaderboard_points, loyalty_points, conversion_rate)
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Ошибка при конвертации: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION convert_leaderboard_points_to_loyalty_points IS 'Конвертирует баллы лидерборда в обычные баллы системы лояльности по курсу периода';

-- =====================================================
-- ГОТОВО!
-- =====================================================











