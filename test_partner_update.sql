-- ============================================
-- Тестовый запрос для проверки обновления данных партнера
-- Замените 'YOUR_PARTNER_CHAT_ID' на реальный chat_id партнера
-- ============================================

-- Тест 1: Проверка существования партнера в partners
SELECT 
    'partners' as table_name,
    chat_id,
    name,
    company_name,
    city,
    district
FROM partners
WHERE chat_id = 'YOUR_PARTNER_CHAT_ID';

-- Тест 2: Проверка существования партнера в partner_applications
SELECT 
    'partner_applications' as table_name,
    chat_id,
    name,
    company_name,
    city,
    district,
    status
FROM partner_applications
WHERE chat_id = 'YOUR_PARTNER_CHAT_ID';

-- Тест 3: Попытка обновления через anon роль (симуляция)
-- ВНИМАНИЕ: Этот запрос может не сработать напрямую, так как он выполняется от service_role
-- Но он покажет, есть ли данные для обновления
UPDATE partner_applications
SET name = name  -- Обновляем на то же значение (тест)
WHERE chat_id = 'YOUR_PARTNER_CHAT_ID'
RETURNING chat_id, name, company_name;
