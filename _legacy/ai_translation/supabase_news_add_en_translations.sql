-- Добавление полей для английских переводов новостей
-- Запустите этот скрипт в SQL Editor вашего проекта Supabase

ALTER TABLE news
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS preview_text_en TEXT,
  ADD COLUMN IF NOT EXISTS content_en TEXT;


