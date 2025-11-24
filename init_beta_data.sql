-- =====================================================
-- ИНИЦИАЛИЗАЦИЯ ДАННЫХ ДЛЯ БЕТА-ТЕСТИРОВАНИЯ
-- =====================================================
-- Выполните этот SQL после основных миграций

-- 1. Создание первого периода лидерборда (текущий месяц)
DO $$
DECLARE
    period_id INTEGER;
    period_start DATE;
    period_end DATE;
    period_name TEXT;
    default_prizes JSONB;
BEGIN
    -- Определяем начало и конец текущего месяца
    period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    period_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    
    -- Генерируем название периода
    period_name := TO_CHAR(CURRENT_DATE, 'Month YYYY');
    
    -- Конфигурация призов для бета (упрощённая)
    default_prizes := jsonb_build_object(
        '1', jsonb_build_object(
            'type', 'physical',
            'name', 'MacBook Pro',
            'alternative_points', 100000,
            'description', 'MacBook Pro 16" M3 Pro'
        ),
        '2', jsonb_build_object(
            'type', 'physical',
            'name', 'iPhone 15 Pro',
            'alternative_points', 80000,
            'description', 'iPhone 15 Pro 256GB'
        ),
        '3', jsonb_build_object(
            'type', 'physical',
            'name', 'AirPods Pro',
            'alternative_points', 30000,
            'description', 'AirPods Pro 2'
        ),
        '4-10', jsonb_build_object(
            'type', 'points',
            'points', 1000,
            'description', '1000 баллов'
        )
    );
    
    -- Проверяем, не создан ли уже период
    SELECT id INTO period_id 
    FROM leaderboard_periods 
    WHERE start_date = period_start AND end_date = period_end;
    
    IF period_id IS NULL THEN
        -- Создаём период
        INSERT INTO leaderboard_periods (
            period_type,
            period_name,
            start_date,
            end_date,
            status,
            prizes_config,
            description
        ) VALUES (
            'monthly',
            period_name,
            period_start,
            period_end,
            'active',
            default_prizes,
            'Первый месячный конкурс лидерборда'
        ) RETURNING id INTO period_id;
        
        RAISE NOTICE 'Период лидерборда создан: ID = %, Название = %', period_id, period_name;
    ELSE
        -- Активируем существующий период
        UPDATE leaderboard_periods
        SET status = 'active'
        WHERE id = period_id;
        
        RAISE NOTICE 'Период лидерборда активирован: ID = %', period_id;
    END IF;
END $$;

-- 2. Добавление тестовых промо-материалов
INSERT INTO promo_materials (material_type, title, description, file_url, platform, is_active)
VALUES 
    (
        'logo',
        'Логотип MindBeauty',
        'Основной логотип компании для использования в контенте',
        'https://example.com/logo.png',
        'all',
        true
    ),
    (
        'banner',
        'Баннер для Instagram Stories',
        'Баннер 1080x1920 для Instagram Stories',
        'https://example.com/banner-instagram-stories.png',
        'instagram',
        true
    ),
    (
        'banner',
        'Баннер для Instagram Post',
        'Баннер 1080x1080 для обычных постов в Instagram',
        'https://example.com/banner-instagram-post.png',
        'instagram',
        true
    ),
    (
        'template',
        'Шаблон поста с промо-кодом',
        'Готовый шаблон поста с местом для промо-кода',
        'https://example.com/template-promo.png',
        'all',
        true
    ),
    (
        'text',
        'Примеры текстов для постов',
        'Коллекция готовых текстов для публикаций',
        'https://example.com/texts-examples.txt',
        'all',
        true
    ),
    (
        'qr',
        'QR-код для скачивания приложения',
        'QR-код для быстрого скачивания приложения',
        'https://example.com/qr-app.png',
        'all',
        true
    )
ON CONFLICT DO NOTHING;

-- 3. Проверка существующих пользователей (опционально - для тестирования)
-- Можно добавить тестового промоутера вручную через админ-бота

-- 4. Создание функции для автоматической активации периодов (если ещё не создана)
-- Эта функция должна вызываться периодически (например, через cron)

COMMENT ON FUNCTION activate_upcoming_periods() IS 
    'Автоматически активирует периоды лидерборда, которые должны начаться сегодня';

-- 5. Проверка основных индексов
DO $$
BEGIN
    -- Проверяем наличие основных индексов
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'promoters' AND indexname = 'idx_promoter_chat_id'
    ) THEN
        RAISE NOTICE 'Индекс idx_promoter_chat_id отсутствует';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'leaderboard_periods' AND indexname = 'idx_period_active'
    ) THEN
        RAISE NOTICE 'Индекс idx_period_active отсутствует';
    END IF;
    
    RAISE NOTICE 'Проверка индексов завершена';
END $$;

