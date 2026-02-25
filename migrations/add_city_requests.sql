-- Таблица заявок на добавление нового города
CREATE TABLE IF NOT EXISTS city_requests (
  id SERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  city_name TEXT NOT NULL,
  requester_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_city_requests_status ON city_requests(status);
CREATE INDEX IF NOT EXISTS idx_city_requests_chat_id ON city_requests(chat_id);

-- Таблица одобренных городов (динамический список)
CREATE TABLE IF NOT EXISTS available_cities (
  name TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Заполняем available_cities текущим статическим списком из locations.js
-- чтобы при переходе на динамику ничего не пропало
INSERT INTO available_cities (name) VALUES
  ('Online'),
  ('New York'),
  ('Los Angeles'),
  ('Bay Area'),
  ('Chicago'),
  ('Miami'),
  ('Boston'),
  ('Seattle'),
  ('Nha Trang'),
  ('Almaty'),
  ('Astana'),
  ('Bishkek'),
  ('Osh'),
  ('Dubai')
ON CONFLICT (name) DO NOTHING;

-- RLS: разрешить фронтенду читать available_cities без авторизации
ALTER TABLE available_cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read available_cities" ON available_cities;
CREATE POLICY "Public read available_cities" ON available_cities
  FOR SELECT TO anon USING (true);

-- RLS: разрешить фронтенду вставлять в city_requests (через anon key)
ALTER TABLE city_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert city_requests" ON city_requests;
CREATE POLICY "Public insert city_requests" ON city_requests
  FOR INSERT TO anon WITH CHECK (true);
