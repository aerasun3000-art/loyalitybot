-- ============================================
-- Миграция: Добавление onboarding_seen в таблицу users
-- Описание: Флаг «онбординг уже показывали» — сохраняется на сервере, чтобы модалка не всплывала снова (в т.ч. в Telegram WebView)
-- ============================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS onboarding_seen BOOLEAN DEFAULT false;

COMMENT ON COLUMN users.onboarding_seen IS 'Пользователь нажал «Больше не показывать» в модалке онбординга на главной';
