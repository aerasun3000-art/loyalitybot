-- Удаляем таблицу, если она существует с неправильной структурой
DROP TABLE IF EXISTS app_settings;

-- Создаем таблицу для хранения настроек приложения
CREATE TABLE app_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by TEXT
);

-- Вставляем дефолтное значение для фона
INSERT INTO app_settings (setting_key, setting_value, description, updated_by)
VALUES ('background_image', '/bg/sakura.jpg', 'Путь к фоновому изображению главной страницы', 'system');

-- Создаем индекс для быстрого поиска
CREATE INDEX idx_app_settings_key ON app_settings(setting_key);

