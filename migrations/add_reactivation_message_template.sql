-- ============================================
-- Churn Prevention, шаг 6: шаблон сообщения реактивации на уровне партнёра
-- Дата: 2026-01-29
-- ============================================

ALTER TABLE partners
ADD COLUMN IF NOT EXISTS reactivation_message_template TEXT;

COMMENT ON COLUMN partners.reactivation_message_template IS 'Шаблон сообщения реактивации. Плейсхолдеры: {client_name}, {partner_name}, {offer_text}, {partner_contact_link}';
