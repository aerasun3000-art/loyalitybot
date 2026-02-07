-- Роли пользователей приложения (модератор, админ).
-- Модератор видит все услуги всех партнёров независимо от пригласившего.
-- Назначение ролей: вручную через SQL или админ-инструменты (service_role).

CREATE TABLE IF NOT EXISTS app_roles (
  chat_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('moderator', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE app_roles IS 'Роли доступа: moderator — видит все услуги всех партнёров; admin — расширенные права. Роль первичнее пригласившего партнёра.';
COMMENT ON COLUMN app_roles.chat_id IS 'Telegram chat_id пользователя';
COMMENT ON COLUMN app_roles.role IS 'moderator | admin';

-- Чтение разрешаем anon для проверки своей роли на фронте
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon to read app_roles" ON app_roles;
CREATE POLICY "Allow anon to read app_roles"
  ON app_roles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT/UPDATE/DELETE только через service_role (назначение модераторов вручную или админкой)
-- Явной политики для service_role не требуется: service_role обходит RLS.

-- Пример назначения модератора (выполнить в Supabase SQL Editor после создания таблицы):
-- INSERT INTO app_roles (chat_id, role) VALUES ('123456789', 'moderator') ON CONFLICT (chat_id) DO UPDATE SET role = EXCLUDED.role;
