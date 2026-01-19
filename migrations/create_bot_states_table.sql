-- ============================================
-- Таблица для хранения состояний ботов (State Machine)
-- Используется для пошаговых диалогов (создание услуг, акций и т.д.)
-- ============================================

-- Создание таблицы bot_states
CREATE TABLE IF NOT EXISTS bot_states (
    chat_id TEXT PRIMARY KEY,
    state TEXT NOT NULL,  -- Текущее состояние (например: 'awaiting_service_title')
    data JSONB DEFAULT '{}',  -- Временные данные сессии
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_bot_states_state ON bot_states(state);
CREATE INDEX IF NOT EXISTS idx_bot_states_updated_at ON bot_states(updated_at);

-- Комментарии к таблице
COMMENT ON TABLE bot_states IS 'Хранит состояния пользователей для пошаговых диалогов в ботах';
COMMENT ON COLUMN bot_states.chat_id IS 'Telegram chat_id пользователя (PRIMARY KEY)';
COMMENT ON COLUMN bot_states.state IS 'Текущее состояние диалога (например: awaiting_service_title)';
COMMENT ON COLUMN bot_states.data IS 'Временные данные сессии в формате JSON';
COMMENT ON COLUMN bot_states.updated_at IS 'Время последнего обновления состояния (для очистки старых записей)';

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_bot_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_bot_states_updated_at ON bot_states;
CREATE TRIGGER trigger_update_bot_states_updated_at
    BEFORE UPDATE ON bot_states
    FOR EACH ROW
    EXECUTE FUNCTION update_bot_states_updated_at();
