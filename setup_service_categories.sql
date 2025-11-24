-- ============================================
-- Настройка категорий услуг для партнеров
-- Используем поле business_type в таблице partner_applications
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase
-- ============================================

-- 1. Добавляем поле business_type в partner_applications, если его еще нет
ALTER TABLE partner_applications 
ADD COLUMN IF NOT EXISTS business_type TEXT;

-- 2. Добавляем поле business_type в partners, если его еще нет (для синхронизации)
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS business_type TEXT;

-- 3. Создаем индексы для быстрого поиска по категориям
CREATE INDEX IF NOT EXISTS idx_partner_applications_business_type ON partner_applications(business_type);
CREATE INDEX IF NOT EXISTS idx_partners_business_type ON partners(business_type);

-- 4. Добавляем комментарии
COMMENT ON COLUMN partner_applications.business_type IS 'Категория услуг партнера: nail_care, brow_design, hair_salon, hair_removal, facial_aesthetics, lash_services, massage_therapy, makeup_pmu, body_wellness, nutrition_coaching, mindfulness_coaching, image_consulting';
COMMENT ON COLUMN partners.business_type IS 'Категория услуг партнера (копируется из partner_applications при одобрении)';

-- 5. Возможные значения business_type (для справки):
-- 'nail_care' - Ногтевой сервис (Nail Care) 💅
-- 'brow_design' - Коррекция и окрашивание бровей (Brow Design) 👁️
-- 'hair_salon' - Парикмахерские услуги (Hair Salon Services) 💇‍♀️
-- 'hair_removal' - Депиляция (Hair Removal) ⚡
-- 'facial_aesthetics' - Косметология (Facial Aesthetics) ✨
-- 'lash_services' - Наращивание и ламинирование ресниц (Lash Services) 👀
-- 'massage_therapy' - Массаж (Massage Therapy) 💆‍♀️
-- 'makeup_pmu' - Визаж и перманент (Make-up & PMU) 💄
-- 'body_wellness' - Телесная терапия (Body Wellness) 🌸
-- 'nutrition_coaching' - Нутрициология и питание (Nutrition Coaching) 🍎
-- 'mindfulness_coaching' - Ментальное здоровье (Mindfulness & Coaching) 🧠
-- 'image_consulting' - Стиль (Image Consulting) 👔

