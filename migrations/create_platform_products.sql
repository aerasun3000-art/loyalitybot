-- ============================================
-- Платформенные продукты (кросс-абонементы и т.п.)
-- Дата: 2026-01-29
-- ============================================

-- 1. Продукты платформы
CREATE TABLE IF NOT EXISTS platform_products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    product_type TEXT NOT NULL DEFAULT 'subscription'
        CHECK (product_type IN ('subscription', 'pass', 'bundle')),
    price_amount NUMERIC(12,2) NOT NULL,
    price_currency TEXT NOT NULL DEFAULT 'RUB',
    duration_days INTEGER,
    max_visits_total INTEGER,
    max_visits_per_partner INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    city TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE platform_products IS 'Продукты платформы: кросс-абонементы, пассы и т.п.';
COMMENT ON COLUMN platform_products.duration_days IS 'Срок действия в днях (NULL для разового)';
COMMENT ON COLUMN platform_products.max_visits_total IS 'Лимит визитов по продукту всего (NULL = без лимита)';
COMMENT ON COLUMN platform_products.max_visits_per_partner IS 'Лимит визитов в одного партнёра (NULL = без лимита)';

CREATE INDEX IF NOT EXISTS idx_platform_products_active ON platform_products(is_active);
CREATE INDEX IF NOT EXISTS idx_platform_products_city ON platform_products(city);

-- 2. Связь продукта с партнёрами
CREATE TABLE IF NOT EXISTS platform_product_partners (
    product_id BIGINT NOT NULL REFERENCES platform_products(id) ON DELETE CASCADE,
    partner_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
    payout_per_visit NUMERIC(10,2) NOT NULL DEFAULT 0,
    visit_limit_per_client INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (product_id, partner_chat_id)
);

COMMENT ON TABLE platform_product_partners IS 'Какие партнёры входят в продукт и ставка выплаты за визит';
COMMENT ON COLUMN platform_product_partners.visit_limit_per_client IS 'Лимит визитов одного клиента к этому партнёру по продукту (NULL = без лимита)';

CREATE INDEX IF NOT EXISTS idx_platform_product_partners_partner ON platform_product_partners(partner_chat_id);

-- 3. Покупки/подписки клиентов
CREATE TABLE IF NOT EXISTS client_product_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    client_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES platform_products(id) ON DELETE RESTRICT,
    purchase_amount NUMERIC(12,2),
    purchase_currency TEXT,
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'cancelled', 'pending_payment')),
    visits_total_used INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE client_product_subscriptions IS 'Покупки продуктов платформы клиентами';
COMMENT ON COLUMN client_product_subscriptions.visits_total_used IS 'Сколько визитов уже использовано по этой подписке';

CREATE INDEX IF NOT EXISTS idx_client_product_subscriptions_client ON client_product_subscriptions(client_chat_id);
CREATE INDEX IF NOT EXISTS idx_client_product_subscriptions_product ON client_product_subscriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_client_product_subscriptions_valid ON client_product_subscriptions(valid_until) WHERE status = 'active';

-- 4. Визиты по продукту
CREATE TABLE IF NOT EXISTS product_visits (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT NOT NULL REFERENCES client_product_subscriptions(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES platform_products(id) ON DELETE RESTRICT,
    client_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    partner_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
    visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT DEFAULT 'bot_manual'
        CHECK (source IN ('qr', 'bot_manual', 'web_widget')),
    status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed', 'rejected', 'pending')),
    payout_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    payout_currency TEXT NOT NULL DEFAULT 'RUB',
    payout_status TEXT NOT NULL DEFAULT 'not_processed'
        CHECK (payout_status IN ('not_processed', 'included_in_batch', 'paid')),
    payout_batch_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE product_visits IS 'Факты посещения партнёра по кросс-абонементу';
COMMENT ON COLUMN product_visits.payout_batch_id IS 'Ссылка на batch выплаты (заполняется при агрегации)';

CREATE INDEX IF NOT EXISTS idx_product_visits_subscription ON product_visits(subscription_id);
CREATE INDEX IF NOT EXISTS idx_product_visits_partner ON product_visits(partner_chat_id);
CREATE INDEX IF NOT EXISTS idx_product_visits_visited ON product_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_product_visits_payout_status ON product_visits(payout_status) WHERE payout_status = 'not_processed';

-- 5. Пакеты выплат партнёрам
CREATE TABLE IF NOT EXISTS partner_payout_batches (
    id BIGSERIAL PRIMARY KEY,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'paid_partially', 'paid')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE partner_payout_batches IS 'Пакеты выплат партнёрам за визиты по платформенным продуктам';

CREATE INDEX IF NOT EXISTS idx_partner_payout_batches_period ON partner_payout_batches(period_start, period_end);

-- 6. Строки выплат (по партнёру в batch)
CREATE TABLE IF NOT EXISTS partner_payout_items (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL REFERENCES partner_payout_batches(id) ON DELETE CASCADE,
    partner_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
    total_visits INTEGER NOT NULL DEFAULT 0,
    total_payout_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RUB',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (batch_id, partner_chat_id)
);

COMMENT ON TABLE partner_payout_items IS 'Строка выплаты одному партнёру в рамках batch';

CREATE INDEX IF NOT EXISTS idx_partner_payout_items_batch ON partner_payout_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_partner_payout_items_partner ON partner_payout_items(partner_chat_id);

-- FK для product_visits.payout_batch_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_visits_batch'
    ) THEN
        ALTER TABLE product_visits
            ADD CONSTRAINT fk_product_visits_batch
            FOREIGN KEY (payout_batch_id) REFERENCES partner_payout_batches(id) ON DELETE SET NULL;
    END IF;
END $$;
