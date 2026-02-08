-- Миграция: Обновление constraint для category_group
-- Добавляет новые категории: education, sports_fitness, entertainment, healthcare, services

-- Удаляем старый constraint
ALTER TABLE partners 
DROP CONSTRAINT IF EXISTS partners_category_group_check;

-- Добавляем новый constraint с расширенным списком категорий
ALTER TABLE partners
ADD CONSTRAINT partners_category_group_check 
CHECK (category_group IN (
    'beauty',           -- Красота и здоровье
    'food',             -- Еда (Кафе/Ресторан)
    'education',        -- Образование
    'retail',           -- Розница (Магазин)
    'sports_fitness',   -- Спорт и фитнес
    'entertainment',    -- Развлечения
    'healthcare',       -- Здравоохранение
    'services',         -- Услуги
    'self_discovery',   -- Самопознание
    'activity',         -- Активности (legacy)
    'influencer',       -- Блогер/Инфлюенсер
    'b2b'               -- B2B
));

-- Также обновляем constraint для partner_applications если он существует
ALTER TABLE partner_applications 
DROP CONSTRAINT IF EXISTS partner_applications_category_group_check;

ALTER TABLE partner_applications
ADD CONSTRAINT partner_applications_category_group_check 
CHECK (category_group IS NULL OR category_group IN (
    'beauty',
    'food',
    'education',
    'retail',
    'sports_fitness',
    'entertainment',
    'healthcare',
    'services',
    'self_discovery',
    'activity',
    'influencer',
    'b2b'
));

-- Комментарий
COMMENT ON COLUMN partners.category_group IS 'Глобальная категория бизнеса: beauty, food, education, retail, sports_fitness, entertainment, healthcare, services, self_discovery, influencer';
