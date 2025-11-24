-- ПРАВИЛЬНЫЙ SQL запрос для таблицы services
-- В таблице НЕТ полей: name, icon
-- Есть только: id, partner_chat_id, title, description, price_points, is_active, created_at, approval_status

SELECT 
  id,
  title,
  description,
  price_points,
  approval_status,
  is_active,
  created_at
FROM services
WHERE approval_status = 'Approved' 
  AND is_active = true
LIMIT 20;

