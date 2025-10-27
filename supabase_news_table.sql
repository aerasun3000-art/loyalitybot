-- Создание таблицы новостей для системы лояльности
-- Запустите этот скрипт в SQL Editor вашего проекта Supabase

CREATE TABLE IF NOT EXISTS news (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  preview_text TEXT,
  image_url TEXT,
  author_chat_id TEXT,
  is_published BOOLEAN DEFAULT true,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Создаем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_news_published ON news(is_published);
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at DESC);

-- Включаем Row Level Security (RLS)
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

-- Политика для чтения: все могут читать опубликованные новости
CREATE POLICY "Anyone can view published news"
  ON news FOR SELECT
  USING (is_published = true);

-- Политика для вставки/обновления/удаления: только для сервисного ключа
-- (операции будут выполняться через бэкенд с использованием service role key)
CREATE POLICY "Service role can do everything"
  ON news FOR ALL
  USING (true)
  WITH CHECK (true);

-- Комментарии к таблице и полям
COMMENT ON TABLE news IS 'Таблица новостей для приложения лояльности';
COMMENT ON COLUMN news.id IS 'Уникальный идентификатор новости';
COMMENT ON COLUMN news.title IS 'Заголовок новости';
COMMENT ON COLUMN news.content IS 'Полный текст новости (может содержать разметку)';
COMMENT ON COLUMN news.preview_text IS 'Краткое описание/превью новости для списка';
COMMENT ON COLUMN news.image_url IS 'URL изображения новости (опционально)';
COMMENT ON COLUMN news.author_chat_id IS 'ID администратора, создавшего новость';
COMMENT ON COLUMN news.is_published IS 'Флаг публикации (true = опубликована, false = черновик)';
COMMENT ON COLUMN news.views_count IS 'Количество просмотров новости';
COMMENT ON COLUMN news.created_at IS 'Дата создания новости';
COMMENT ON COLUMN news.updated_at IS 'Дата последнего обновления новости';

