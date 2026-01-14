-- ==============================================================================
-- Таблица постоянного кэша переводов для новостей, акций и другого контента
-- ==============================================================================
-- Запустите этот скрипт в SQL Editor Supabase один раз.
-- Таблица будет использоваться Python-кодом (ai_helper.translate_text_ai)
-- для сохранения и повторного использования переводов.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS translation_cache (
    id BIGSERIAL PRIMARY KEY,
    text_hash TEXT NOT NULL,
    source_lang TEXT NOT NULL,
    target_lang TEXT NOT NULL,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Уникальный индекс, чтобы один и тот же текст для одной пары языков
-- не дублировался в кэше.
CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_cache_unique
    ON translation_cache (text_hash, source_lang, target_lang);





