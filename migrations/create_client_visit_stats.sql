-- ============================================
-- Churn Prevention, шаг 2: статистика визитов клиента по партнёру
-- Дата: 2026-01-29
-- ============================================

CREATE TABLE IF NOT EXISTS client_visit_stats (
    client_chat_id TEXT NOT NULL,
    partner_chat_id TEXT NOT NULL,
    visit_count INTEGER NOT NULL,
    avg_interval_days NUMERIC(10,2) NOT NULL,
    last_visit_at TIMESTAMPTZ,
    last_computed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (client_chat_id, partner_chat_id),
    CONSTRAINT fk_client_visit_stats_client FOREIGN KEY (client_chat_id) REFERENCES users(chat_id) ON DELETE CASCADE
);

COMMENT ON TABLE client_visit_stats IS 'Персональный интервал визитов (Churn Prevention): средний интервал в днях между визитами клиента к партнёру';
COMMENT ON COLUMN client_visit_stats.avg_interval_days IS 'Среднее число дней между последовательными визитами (accrual/redemption)';
COMMENT ON COLUMN client_visit_stats.visit_count IS 'Количество визитов, по которым посчитан интервал';
COMMENT ON COLUMN client_visit_stats.last_visit_at IS 'Дата последнего визита по этой паре (client, partner)';

CREATE INDEX IF NOT EXISTS idx_client_visit_stats_last_visit ON client_visit_stats(last_visit_at);
CREATE INDEX IF NOT EXISTS idx_client_visit_stats_computed ON client_visit_stats(last_computed_at);
CREATE INDEX IF NOT EXISTS idx_client_visit_stats_partner ON client_visit_stats(partner_chat_id);
