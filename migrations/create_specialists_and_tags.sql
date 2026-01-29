-- ============================================
-- Миграция: Специалисты, теги и связи
-- Для модульной архитектуры страниц партнёров
-- Выполните этот скрипт в Supabase SQL Editor
-- ============================================

-- 1. Таблица специалистов (мастера, тренеры, врачи)
CREATE TABLE IF NOT EXISTS specialists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_chat_id TEXT NOT NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  specialization TEXT,
  description TEXT,
  rating NUMERIC(2,1) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  reviews_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для specialists
CREATE INDEX IF NOT EXISTS idx_specialists_partner ON specialists(partner_chat_id);
CREATE INDEX IF NOT EXISTS idx_specialists_active ON specialists(partner_chat_id, is_active);

-- Foreign key (если partners существует)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'specialists_partner_chat_id_fkey'
  ) THEN
    ALTER TABLE specialists 
    ADD CONSTRAINT specialists_partner_chat_id_fkey 
    FOREIGN KEY (partner_chat_id) REFERENCES partners(chat_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Таблица тегов
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ru TEXT NOT NULL,
  name_en TEXT NOT NULL,
  emoji TEXT,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('dietary', 'service', 'specialist', 'general')),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для tags
CREATE INDEX IF NOT EXISTS idx_tags_type ON tags(tag_type);
CREATE INDEX IF NOT EXISTS idx_tags_code ON tags(code);

-- 3. Связь услуг и тегов
CREATE TABLE IF NOT EXISTS service_tags (
  service_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (service_id, tag_id)
);

-- Foreign keys для service_tags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'service_tags_service_id_fkey'
  ) THEN
    ALTER TABLE service_tags 
    ADD CONSTRAINT service_tags_service_id_fkey 
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'service_tags_tag_id_fkey'
  ) THEN
    ALTER TABLE service_tags 
    ADD CONSTRAINT service_tags_tag_id_fkey 
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Добавить поля в services (если не существуют)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'services' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE services ADD COLUMN image_url TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'services' AND column_name = 'menu_category'
  ) THEN
    ALTER TABLE services ADD COLUMN menu_category TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'services' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE services ADD COLUMN display_order INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'services' AND column_name = 'duration_minutes'
  ) THEN
    ALTER TABLE services ADD COLUMN duration_minutes INTEGER;
  END IF;
END $$;

-- 5. Заполнить базовые диетические теги
INSERT INTO tags (code, name_ru, name_en, emoji, tag_type, display_order) VALUES
  ('vegan', 'Веганское', 'Vegan', '🥬', 'dietary', 1),
  ('vegetarian', 'Вегетарианское', 'Vegetarian', '🥕', 'dietary', 2),
  ('gluten_free', 'Без глютена', 'Gluten-free', '🌾', 'dietary', 3),
  ('dairy_free', 'Без лактозы', 'Dairy-free', '🥛', 'dietary', 4),
  ('spicy', 'Острое', 'Spicy', '🌶️', 'dietary', 5),
  ('kids', 'Детское', 'Kids-friendly', '🧒', 'dietary', 6),
  ('halal', 'Халяль', 'Halal', '☪️', 'dietary', 7),
  ('kosher', 'Кошерное', 'Kosher', '✡️', 'dietary', 8),
  ('sugar_free', 'Без сахара', 'Sugar-free', '🍬', 'dietary', 9),
  ('organic', 'Органическое', 'Organic', '🌿', 'dietary', 10)
ON CONFLICT (code) DO NOTHING;

-- 6. Заполнить теги для услуг
INSERT INTO tags (code, name_ru, name_en, emoji, tag_type, display_order) VALUES
  ('for_kids', 'Для детей', 'For kids', '👶', 'service', 1),
  ('for_men', 'Для мужчин', 'For men', '👨', 'service', 2),
  ('for_women', 'Для женщин', 'For women', '👩', 'service', 3),
  ('express', 'Экспресс', 'Express', '⚡', 'service', 4),
  ('premium', 'Премиум', 'Premium', '⭐', 'service', 5),
  ('new', 'Новинка', 'New', '🆕', 'service', 6),
  ('popular', 'Популярное', 'Popular', '🔥', 'service', 7),
  ('discount', 'Со скидкой', 'Discount', '💰', 'service', 8)
ON CONFLICT (code) DO NOTHING;

-- 7. Заполнить теги для специалистов
INSERT INTO tags (code, name_ru, name_en, emoji, tag_type, display_order) VALUES
  ('top_master', 'Топ-мастер', 'Top master', '👑', 'specialist', 1),
  ('experienced', 'Опытный', 'Experienced', '🎖️', 'specialist', 2),
  ('speaks_english', 'Говорит по-английски', 'English speaking', '🇬🇧', 'specialist', 3),
  ('certified', 'Сертифицированный', 'Certified', '📜', 'specialist', 4)
ON CONFLICT (code) DO NOTHING;

-- 8. RLS политики для specialists
ALTER TABLE specialists ENABLE ROW LEVEL SECURITY;

-- Политика чтения: все могут читать активных специалистов
DROP POLICY IF EXISTS "specialists_select_policy" ON specialists;
CREATE POLICY "specialists_select_policy" ON specialists
  FOR SELECT USING (is_active = true);

-- Политика для партнёров: могут управлять своими специалистами
DROP POLICY IF EXISTS "specialists_partner_all" ON specialists;
CREATE POLICY "specialists_partner_all" ON specialists
  FOR ALL USING (true);

-- 9. RLS политики для tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_select_all" ON tags;
CREATE POLICY "tags_select_all" ON tags
  FOR SELECT USING (is_active = true);

-- 10. RLS политики для service_tags
ALTER TABLE service_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_tags_select_all" ON service_tags;
CREATE POLICY "service_tags_select_all" ON service_tags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_tags_manage" ON service_tags;
CREATE POLICY "service_tags_manage" ON service_tags
  FOR ALL USING (true);

-- 11. Комментарии
COMMENT ON TABLE specialists IS 'Специалисты/мастера партнёров (для модуля SpecialistsModule)';
COMMENT ON TABLE tags IS 'Теги для фильтрации услуг, блюд, специалистов';
COMMENT ON TABLE service_tags IS 'Связь многие-ко-многим между услугами и тегами';
COMMENT ON COLUMN services.image_url IS 'URL изображения услуги/блюда';
COMMENT ON COLUMN services.menu_category IS 'Категория в меню (для food партнёров)';
COMMENT ON COLUMN services.display_order IS 'Порядок отображения в списке';
COMMENT ON COLUMN services.duration_minutes IS 'Длительность услуги в минутах';

-- 12. Проверка создания
SELECT 'specialists' as table_name, COUNT(*) as count FROM specialists
UNION ALL
SELECT 'tags' as table_name, COUNT(*) as count FROM tags
UNION ALL
SELECT 'service_tags' as table_name, COUNT(*) as count FROM service_tags;
