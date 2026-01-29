-- ============================================
-- Churn Prevention, шаг 5: настройки реактивации на уровне партнёра
-- Дата: 2026-01-29
-- ============================================

ALTER TABLE partners
ADD COLUMN IF NOT EXISTS reactivation_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reactivation_min_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS reactivation_coefficient NUMERIC(4,2) DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS reactivation_cooldown_days INTEGER DEFAULT 14;

COMMENT ON COLUMN partners.reactivation_enabled IS 'Включена ли авто-реактивация для этого партнёра';
COMMENT ON COLUMN partners.reactivation_min_days IS 'Минимальный порог дней без визита для триггера реактивации';
COMMENT ON COLUMN partners.reactivation_coefficient IS 'Коэффициент превышения среднего интервала (например, 2.0 = в 2 раза дольше обычного)';
COMMENT ON COLUMN partners.reactivation_cooldown_days IS 'Сколько дней не отправлять повторную реактивацию одному клиенту';
