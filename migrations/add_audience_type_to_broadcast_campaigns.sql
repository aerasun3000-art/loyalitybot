-- ============================================
-- Добавление audience_type в partner_broadcast_campaigns
-- Дата: 2026-02-19
-- ТЗ: Выбор аудитории рассылки партнёра
-- ============================================

ALTER TABLE partner_broadcast_campaigns
ADD COLUMN IF NOT EXISTS audience_type TEXT DEFAULT 'referral';

COMMENT ON COLUMN partner_broadcast_campaigns.audience_type IS 'Тип аудитории: referral (по ссылке), transactions (по визитам), combined (все)';
