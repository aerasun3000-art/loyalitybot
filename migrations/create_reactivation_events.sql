-- ============================================
-- Churn Prevention, шаг 3: события реактивации (логирование + cooldown)
-- Дата: 2026-01-29
-- ============================================

CREATE TABLE IF NOT EXISTS reactivation_events (
    id BIGSERIAL PRIMARY KEY,
    client_chat_id TEXT NOT NULL,
    partner_chat_id TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'sent',
    trigger_reason TEXT DEFAULT 'churn',
    campaign_id BIGINT,
    message_text_snapshot TEXT,
    error_message TEXT,
    CONSTRAINT fk_reactivation_client FOREIGN KEY (client_chat_id) REFERENCES users(chat_id) ON DELETE CASCADE
);

COMMENT ON TABLE reactivation_events IS 'Лог отправок реактивации (Churn Prevention): для cooldown и отчётности';
COMMENT ON COLUMN reactivation_events.trigger_reason IS 'Причина триггера: churn и др.';
COMMENT ON COLUMN reactivation_events.status IS 'sent, failed';

CREATE INDEX IF NOT EXISTS idx_reactivation_events_cooldown
ON reactivation_events(client_chat_id, partner_chat_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactivation_events_partner_sent
ON reactivation_events(partner_chat_id, sent_at DESC);
