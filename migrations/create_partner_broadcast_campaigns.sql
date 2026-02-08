-- ============================================
-- B2B/Partner Marketing: рассылки партнёра своей базе
-- Дата: 2026-01-29
-- ============================================

CREATE TABLE IF NOT EXISTS partner_broadcast_campaigns (
    id BIGSERIAL PRIMARY KEY,
    partner_chat_id TEXT NOT NULL,
    template_id TEXT NOT NULL DEFAULT 'referral_program',
    recipient_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    CONSTRAINT fk_broadcast_partner FOREIGN KEY (partner_chat_id) REFERENCES partners(chat_id) ON DELETE CASCADE
);

COMMENT ON TABLE partner_broadcast_campaigns IS 'Лог рассылок партнёра своей клиентской базе (B2B/маркетинг)';
COMMENT ON COLUMN partner_broadcast_campaigns.template_id IS 'Идентификатор шаблона: referral_program и др.';
COMMENT ON COLUMN partner_broadcast_campaigns.recipient_count IS 'Число получателей (активированные клиенты партнёра)';
COMMENT ON COLUMN partner_broadcast_campaigns.sent_count IS 'Фактически отправлено сообщений';

CREATE INDEX IF NOT EXISTS idx_broadcast_partner ON partner_broadcast_campaigns(partner_chat_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_started ON partner_broadcast_campaigns(partner_chat_id, started_at DESC);
