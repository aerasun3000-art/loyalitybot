-- ============================================
-- Таблицы для редактируемых шаблонов Instagram через админ-бот
-- ============================================

-- Таблица для оверрайдов шаблонов ответов (response_templates)
CREATE TABLE IF NOT EXISTS instagram_response_templates (
    template_key TEXT PRIMARY KEY,
    template_text TEXT NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE instagram_response_templates IS 'Оверрайды текстов шаблонов ответов для Instagram outreach, редактируемые из админ-бота';
COMMENT ON COLUMN instagram_response_templates.template_key IS 'Ключ шаблона (greeting, pricing, benefits, ...)';
COMMENT ON COLUMN instagram_response_templates.template_text IS 'Текст шаблона (с плейсхолдерами {var} при необходимости)';
COMMENT ON COLUMN instagram_response_templates.updated_by IS 'ID администратора (Telegram user id), изменившего шаблон';
COMMENT ON COLUMN instagram_response_templates.updated_at IS 'Время последнего обновления шаблона';


