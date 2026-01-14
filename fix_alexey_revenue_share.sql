-- ============================================
-- ИСПРАВЛЕНИЕ: Настройка Revenue Share для Алексея
-- Заполните реальные chat_id перед выполнением!
-- ============================================

-- Chat ID Алексея: 406631153
-- ============================================
-- ⚠️ ВАЖНО: Замените chat_id мастеров на реальные значения!
-- ============================================

-- ============================================
-- ШАГ 1: Найти chat_id всех партнеров (если не знаете)
-- ============================================
-- Выполните этот запрос, чтобы найти chat_id:
-- SELECT chat_id, name, company_name, partner_type 
-- FROM partners 
-- ORDER BY created_at DESC 
-- LIMIT 20;

-- ============================================
-- ШАГ 2: Установить referred_by_chat_id для мастеров
-- ============================================

-- Chat ID Алексея: 406631153
-- ⚠️ Замените chat_id мастеров на реальные значения!
UPDATE partners
SET referred_by_chat_id = '406631153'
WHERE chat_id IN (
    'ЗАМЕНИТЕ_НА_CHAT_ID_МАСТЕРА_1',
    'ЗАМЕНИТЕ_НА_CHAT_ID_МАСТЕРА_2',
    'ЗАМЕНИТЕ_НА_CHAT_ID_МАСТЕРА_3'
)
AND (referred_by_chat_id IS NULL OR referred_by_chat_id != '406631153');

-- ============================================
-- ШАГ 3: Установить partner_type='master' и partner_level=3
-- ============================================

UPDATE partners
SET 
    partner_type = 'master',
    partner_level = 3
WHERE chat_id IN (
    'ЗАМЕНИТЕ_НА_CHAT_ID_МАСТЕРА_1',
    'ЗАМЕНИТЕ_НА_CHAT_ID_МАСТЕРА_2',
    'ЗАМЕНИТЕ_НА_CHAT_ID_МАСТЕРА_3'
)
AND (partner_type != 'master' OR partner_level != 3);

-- ============================================
-- ШАГ 4: Создать записи в partner_network
-- ============================================

-- Chat ID Алексея: 406631153
-- ⚠️ Замените chat_id мастеров на реальные значения!
INSERT INTO partner_network (referrer_chat_id, referred_chat_id, level, is_active)
VALUES 
    ('406631153', 'ЗАМЕНИТЕ_НА_CHAT_ID_МАСТЕРА_1', 1, true),
    ('406631153', 'ЗАМЕНИТЕ_НА_CHAT_ID_МАСТЕРА_2', 1, true),
    ('406631153', 'ЗАМЕНИТЕ_НА_CHAT_ID_МАСТЕРА_3', 1, true)
ON CONFLICT (referrer_chat_id, referred_chat_id) 
DO UPDATE SET 
    level = 1,
    is_active = true;

-- ============================================
-- ШАГ 5: Убедиться, что Алексей существует в partners
-- ============================================

-- Если Алексея нет в partners, нужно создать запись
-- Chat ID Алексея: 406631153
-- INSERT INTO partners (chat_id, name, company_name, partner_type, partner_level)
-- VALUES ('406631153', 'Алексей', 'Компания Алексея', 'regular', 0)
-- ON CONFLICT (chat_id) DO NOTHING;

-- ============================================
-- ШАГ 6: Проверка результата
-- ============================================

-- После выполнения всех шагов, проверьте результат:
SELECT 
    p.chat_id,
    p.name,
    p.referred_by_chat_id as linked_to_alexey,
    p.partner_type,
    p.partner_level,
    CASE 
        WHEN pn.id IS NOT NULL THEN '✅ В сети'
        ELSE '❌ НЕТ в partner_network'
    END as network_status
FROM partners p
LEFT JOIN partner_network pn ON (
    pn.referred_chat_id = p.chat_id 
    AND pn.referrer_chat_id = '406631153'
)
WHERE p.chat_id IN (
    'ЗАМЕНИТЕ_НА_CHAT_ID_МАСТЕРА_1',
    'ЗАМЕНИТЕ_НА_CHAT_ID_МАСТЕРА_2',
    'ЗАМЕНИТЕ_НА_CHAT_ID_МАСТЕРА_3'
)
ORDER BY p.name;

