-- B2B Partner-initiated deals: platform fee and acceptance tracking
ALTER TABLE partner_deals
ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;

COMMENT ON COLUMN partner_deals.platform_fee_percent IS 'Процент комиссии платформы с B2B сделки (0 = бесплатно на старте)';
COMMENT ON COLUMN partner_deals.accepted_at IS 'Когда целевой партнёр принял предложение (peer-to-peer)';
