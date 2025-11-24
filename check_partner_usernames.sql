-- =====================================================
-- Проверка username и contact_link партнёров
-- Этот скрипт поможет найти проблемные записи
-- =====================================================

-- 1. Проверка всех партнёров с их username и contact_link
SELECT 
    chat_id,
    name,
    company_name,
    username,
    contact_link,
    CASE 
        WHEN username IS NULL OR username = '' THEN '❌ Username не заполнен'
        WHEN contact_link IS NULL OR contact_link = '' THEN '❌ Contact_link не заполнен'
        WHEN contact_link NOT LIKE 'https://t.me/%' THEN '❌ Неверный формат contact_link'
        WHEN LENGTH(TRIM(BOTH '@' FROM username)) < 5 THEN '❌ Username слишком короткий'
        ELSE '✅ OK'
    END as status
FROM partners
ORDER BY 
    CASE 
        WHEN username IS NULL OR username = '' THEN 1
        WHEN contact_link IS NULL OR contact_link = '' THEN 2
        ELSE 3
    END,
    name;

-- 2. Проверка партнёров с пустым или неправильным contact_link
SELECT 
    chat_id,
    name,
    username,
    contact_link,
    'https://t.me/' || TRIM(BOTH '@' FROM username) as should_be_link
FROM partners
WHERE username IS NOT NULL 
  AND username != ''
  AND (contact_link IS NULL 
       OR contact_link = '' 
       OR contact_link != 'https://t.me/' || TRIM(BOTH '@' FROM username));

-- 3. Проверка партнёров с потенциально несуществующими username
-- (username содержит недопустимые символы или слишком короткий)
SELECT 
    chat_id,
    name,
    username,
    contact_link
FROM partners
WHERE username IS NOT NULL 
  AND username != ''
  AND (
    LENGTH(TRIM(BOTH '@' FROM username)) < 5
    OR username !~ '^[a-zA-Z0-9_@]+$'
  );

-- 4. Обновление contact_link для партнёров с правильным username
-- (раскомментируйте, если нужно исправить)
/*
UPDATE partners 
SET contact_link = 'https://t.me/' || TRIM(BOTH '@' FROM username)
WHERE username IS NOT NULL 
  AND username != ''
  AND (contact_link IS NULL 
       OR contact_link = '' 
       OR contact_link != 'https://t.me/' || TRIM(BOTH '@' FROM username));
*/

