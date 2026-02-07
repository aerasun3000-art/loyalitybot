-- Выполнить в Supabase SQL Editor один раз (целиком).
-- 1) Создаёт таблицу app_roles и политики.
-- 2) Добавляет модератора — замените YOUR_TELEGRAM_CHAT_ID на реальный chat_id.

-- ========== 1. Создание таблицы ==========
CREATE TABLE IF NOT EXISTS app_roles (
  chat_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('moderator', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE app_roles IS 'Роли доступа: moderator — видит все услуги всех партнёров; admin — расширенные права.';
COMMENT ON COLUMN app_roles.chat_id IS 'Telegram chat_id пользователя';
COMMENT ON COLUMN app_roles.role IS 'moderator | admin';

ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon to read app_roles" ON app_roles;
CREATE POLICY "Allow anon to read app_roles"
  ON app_roles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ========== 2. Назначить модераторов ==========
INSERT INTO app_roles (chat_id, role)
VALUES ('YOUR_TELEGRAM_CHAT_ID', 'moderator'),
       ('182392905', 'moderator')
ON CONFLICT (chat_id) DO UPDATE SET role = EXCLUDED.role;
