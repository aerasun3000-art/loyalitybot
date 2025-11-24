-- ============================================
-- Создание тестовых категорий услуг для демонстрации
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase
-- ============================================

-- 0. Убеждаемся, что все необходимые поля существуют в таблицах
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS category TEXT;

-- 1. Создаем тестовых партнеров с разными категориями услуг
INSERT INTO partners (chat_id, name, company_name, city, district, business_type)
VALUES
  -- Ногтевой сервис
  ('partner_nail_001', 'Анна Иванова', 'Салон красоты "Нежность"', 'Москва', 'Центральный', 'nail_care'),
  ('partner_nail_002', 'Мария Петрова', 'Nail Studio "Элегант"', 'Москва', 'Северный', 'nail_care'),
  
  -- Парикмахерские услуги
  ('partner_hair_001', 'Елена Смирнова', 'Hair Salon "Стиль"', 'Москва', 'Центральный', 'hair_salon'),
  ('partner_hair_002', 'Ольга Козлова', 'Салон "Волшебные локоны"', 'Москва', 'Южный', 'hair_salon'),
  
  -- Косметология
  ('partner_facial_001', 'Ирина Волкова', 'Косметология "Сияние"', 'Москва', 'Центральный', 'facial_aesthetics'),
  ('partner_facial_002', 'Татьяна Новикова', 'Beauty Studio "Идеал"', 'Москва', 'Западный', 'facial_aesthetics'),
  
  -- Массаж
  ('partner_massage_001', 'Светлана Морозова', 'Массажный салон "Релакс"', 'Москва', 'Центральный', 'massage_therapy'),
  
  -- Ресницы
  ('partner_lash_001', 'Анастасия Лебедева', 'Lash Studio "Взгляд"', 'Москва', 'Северный', 'lash_services'),
  
  -- Брови
  ('partner_brow_001', 'Виктория Соколова', 'Brow Studio "Арка"', 'Москва', 'Центральный', 'brow_design'),
  
  -- Депиляция
  ('partner_hair_removal_001', 'Екатерина Попова', 'Студия депиляции "Гладкость"', 'Москва', 'Южный', 'hair_removal'),
  
  -- Телесная терапия
  ('partner_body_001', 'Алексей Серов', 'Body Wellness Studio "Баланс"', 'Москва', 'Центральный', 'body_wellness'),
  
  -- Нутрициология и питание
  ('partner_nutrition_001', 'Марина Орлова', 'Nutrition Coaching "Здоровье"', 'Москва', 'Центральный', 'nutrition_coaching'),
  
  -- Ментальное здоровье
  ('partner_mindfulness_001', 'Екатерина Лебедева', 'Mindfulness Center "Гармония"', 'Москва', 'Северный', 'mindfulness_coaching'),
  
  -- Стиль
  ('partner_image_001', 'Ольга Соколова', 'Image Consulting "Стиль жизни"', 'Москва', 'Западный', 'image_consulting')
ON CONFLICT (chat_id) DO NOTHING;

-- 2. Создаем услуги для каждого партнера
-- Ногтевой сервис - партнер 1
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_nail_001', 'Классический маникюр', 'Обработка ногтей, придание формы, покрытие лаком', 500, 'nail_care', 'Approved', true),
  ('partner_nail_001', 'Маникюр с дизайном', 'Классический маникюр + художественный дизайн', 800, 'nail_care', 'Approved', true),
  ('partner_nail_001', 'Покрытие гель-лаком', 'Маникюр + покрытие гель-лаком (стойкость 2-3 недели)', 1000, 'nail_care', 'Approved', true),
  ('partner_nail_001', 'Наращивание ногтей', 'Наращивание ногтей гелем или акрилом', 2000, 'nail_care', 'Approved', true);

-- Ногтевой сервис - партнер 2
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_nail_002', 'Европейский маникюр', 'Бережный уход за ногтями без обрезного маникюра', 600, 'nail_care', 'Approved', true),
  ('partner_nail_002', 'SPA-маникюр', 'Маникюр с уходовыми процедурами и массажем', 1200, 'nail_care', 'Approved', true),
  ('partner_nail_002', 'Френч маникюр', 'Классический французский маникюр', 900, 'nail_care', 'Approved', true);

-- Парикмахерские услуги - партнер 1
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_hair_001', 'Женская стрижка', 'Стрижка с укладкой', 1500, 'hair_salon', 'Approved', true),
  ('partner_hair_001', 'Мужская стрижка', 'Классическая мужская стрижка', 800, 'hair_salon', 'Approved', true),
  ('partner_hair_001', 'Окрашивание волос', 'Полное окрашивание волос', 3000, 'hair_salon', 'Approved', true),
  ('partner_hair_001', 'Мелирование', 'Частичное окрашивание волос', 2500, 'hair_salon', 'Approved', true),
  ('partner_hair_001', 'Укладка', 'Укладка волос феном и щипцами', 1200, 'hair_salon', 'Approved', true);

-- Парикмахерские услуги - партнер 2
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_hair_002', 'Стрижка + укладка', 'Комплексная услуга: стрижка и укладка', 1800, 'hair_salon', 'Approved', true),
  ('partner_hair_002', 'Окрашивание + тонирование', 'Полное окрашивание с тонированием', 3500, 'hair_salon', 'Approved', true),
  ('partner_hair_002', 'Кератиновое выпрямление', 'Выпрямление и восстановление волос', 5000, 'hair_salon', 'Approved', true);

-- Косметология - партнер 1
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_facial_001', 'Чистка лица', 'Механическая чистка лица', 2000, 'facial_aesthetics', 'Approved', true),
  ('partner_facial_001', 'Ультразвуковая чистка', 'Чистка лица ультразвуком', 2500, 'facial_aesthetics', 'Approved', true),
  ('partner_facial_001', 'Увлажняющая маска', 'Процедура увлажнения кожи лица', 1500, 'facial_aesthetics', 'Approved', true),
  ('partner_facial_001', 'Массаж лица', 'Лимфодренажный массаж лица', 1800, 'facial_aesthetics', 'Approved', true);

-- Косметология - партнер 2
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_facial_002', 'Комплексный уход за лицом', 'Полный комплекс процедур по уходу за кожей', 4000, 'facial_aesthetics', 'Approved', true),
  ('partner_facial_002', 'Пилинг лица', 'Химический пилинг для обновления кожи', 3000, 'facial_aesthetics', 'Approved', true),
  ('partner_facial_002', 'Инъекции красоты', 'Консультация и процедуры инъекционной косметологии', 8000, 'facial_aesthetics', 'Approved', true);

-- Массаж - партнер 1
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_massage_001', 'Классический массаж', 'Общий массаж тела (60 минут)', 2500, 'massage_therapy', 'Approved', true),
  ('partner_massage_001', 'Антицеллюлитный массаж', 'Массаж проблемных зон', 3000, 'massage_therapy', 'Approved', true),
  ('partner_massage_001', 'Расслабляющий массаж', 'Спокойный расслабляющий массаж', 2000, 'massage_therapy', 'Approved', true),
  ('partner_massage_001', 'Массаж спины', 'Массаж спины и шеи (30 минут)', 1500, 'massage_therapy', 'Approved', true);

-- Ресницы - партнер 1
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_lash_001', 'Наращивание ресниц классика', 'Классическое наращивание ресниц', 3000, 'lash_services', 'Approved', true),
  ('partner_lash_001', 'Наращивание ресниц объем', 'Объемное наращивание ресниц (2D-3D)', 4000, 'lash_services', 'Approved', true),
  ('partner_lash_001', 'Ламинирование ресниц', 'Ламинирование и окрашивание ресниц', 2500, 'lash_services', 'Approved', true),
  ('partner_lash_001', 'Коррекция ресниц', 'Коррекция наращенных ресниц', 2000, 'lash_services', 'Approved', true);

-- Брови - партнер 1
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_brow_001', 'Коррекция бровей', 'Коррекция формы бровей', 800, 'brow_design', 'Approved', true),
  ('partner_brow_001', 'Окрашивание бровей', 'Окрашивание бровей краской', 1200, 'brow_design', 'Approved', true),
  ('partner_brow_001', 'Ламинирование бровей', 'Ламинирование и укладка бровей', 2000, 'brow_design', 'Approved', true),
  ('partner_brow_001', 'Татуаж бровей', 'Перманентный макияж бровей', 5000, 'brow_design', 'Approved', true);

-- Депиляция - партнер 1
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_hair_removal_001', 'Шугаринг ног', 'Удаление волос на ногах', 2000, 'hair_removal', 'Approved', true),
  ('partner_hair_removal_001', 'Шугаринг бикини', 'Удаление волос в зоне бикини', 2500, 'hair_removal', 'Approved', true),
  ('partner_hair_removal_001', 'Лазерная эпиляция', 'Лазерная эпиляция (1 зона)', 4000, 'hair_removal', 'Approved', true),
  ('partner_hair_removal_001', 'Восковая депиляция', 'Депиляция воском', 1800, 'hair_removal', 'Approved', true);

-- Телесная терапия - партнер 1
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_body_001', 'Рефлексотерапия тела', 'Сеанс мягкой телесной терапии для расслабления мышц', 3200, 'body_wellness', 'Approved', true),
  ('partner_body_001', 'Миофасциальный релиз', 'Работа с глубокими мышечными слоями для восстановления подвижности', 3600, 'body_wellness', 'Approved', true),
  ('partner_body_001', 'Телесно-ориентированная терапия', 'Индивидуальная работа с телом и дыханием', 3800, 'body_wellness', 'Approved', true);

-- Нутрициология и питание - партнер 1
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_nutrition_001', 'Первичная консультация нутрициолога', 'Анализ рациона и составление плана питания', 2500, 'nutrition_coaching', 'Approved', true),
  ('partner_nutrition_001', 'Персональное меню на неделю', 'Подбор индивидуального меню с учетом целей клиента', 3000, 'nutrition_coaching', 'Approved', true),
  ('partner_nutrition_001', 'Сопровождение на месяц', 'Поддержка и корректировка питания в течение 4 недель', 5500, 'nutrition_coaching', 'Approved', true);

-- Ментальное здоровье - партнер 1
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_mindfulness_001', 'Mindfulness-сессия', 'Практики осознанности для снижения стресса', 2800, 'mindfulness_coaching', 'Approved', true),
  ('partner_mindfulness_001', 'Коучинг по развитию устойчивости', 'Личная встреча с коучем по эмоциональной устойчивости', 3400, 'mindfulness_coaching', 'Approved', true),
  ('partner_mindfulness_001', 'Групповая медитация', 'Практика медитации в мини-группе', 2000, 'mindfulness_coaching', 'Approved', true);

-- Стиль - партнер 1
INSERT INTO services (partner_chat_id, title, description, price_points, category, approval_status, is_active)
VALUES
  ('partner_image_001', 'Анализ гардероба', 'Разбор гардероба и подбор базовых комплектов', 4200, 'image_consulting', 'Approved', true),
  ('partner_image_001', 'Персональный шопинг-сопровожение', 'Совместный шопинг с подбором вещей под стиль клиента', 5200, 'image_consulting', 'Approved', true),
  ('partner_image_001', 'Создание образа для мероприятия', 'Полный подбор аутфита и аксессуаров под событие', 4600, 'image_consulting', 'Approved', true);

-- Проверка созданных данных
SELECT 
  p.company_name,
  p.business_type,
  COUNT(s.id) as services_count
FROM partners p
LEFT JOIN services s ON p.chat_id = s.partner_chat_id
WHERE p.chat_id LIKE 'partner_%'
GROUP BY p.company_name, p.business_type
ORDER BY p.business_type, p.company_name;

