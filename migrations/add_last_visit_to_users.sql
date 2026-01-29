-- ============================================
-- Миграция: Добавление last_visit в таблицу users (Churn Prevention, шаг 1)
-- Дата: 2026-01-29
-- Описание: Дата последнего визита клиента — обновляется при каждой транзакции accrual/redemption
-- ============================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_visit TIMESTAMPTZ;

COMMENT ON COLUMN users.last_visit IS 'Дата и время последнего визита (транзакция accrual или redemption) для модуля реактивации';
