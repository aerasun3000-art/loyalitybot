-- ============================================
-- Churn Prevention, RPC-функции для Cloudflare Worker (вариант A)
-- Дата: 2026-01-29
-- ============================================

-- 1) compute_client_visit_stats()
-- Считает средний интервал визитов (accrual/redemption) по парам (client, partner)
-- и обновляет таблицу client_visit_stats. Возвращает количество обновлённых строк.

CREATE OR REPLACE FUNCTION public.compute_client_visit_stats(
    p_partner_chat_id TEXT DEFAULT NULL,
    p_min_visits INTEGER DEFAULT 2
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_rows_updated INTEGER := 0;
BEGIN
    WITH visits AS (
        SELECT
            t.client_chat_id,
            t.partner_chat_id,
            t.date_time::timestamptz AS dt
        FROM transactions t
        WHERE t.transaction_type IN ('accrual', 'redemption')
          AND (p_partner_chat_id IS NULL OR t.partner_chat_id = p_partner_chat_id)
    ),
    ordered AS (
        SELECT
            v.client_chat_id,
            v.partner_chat_id,
            v.dt,
            LAG(v.dt) OVER (
                PARTITION BY v.client_chat_id, v.partner_chat_id
                ORDER BY v.dt
            ) AS prev_dt
        FROM visits v
    ),
    diffs AS (
        SELECT
            o.client_chat_id,
            o.partner_chat_id,
            COUNT(*) FILTER (WHERE o.prev_dt IS NOT NULL) AS visit_count,
            AVG(
                EXTRACT(EPOCH FROM (o.dt - o.prev_dt)) / 86400.0
            ) AS avg_interval_days,
            MAX(o.dt) AS last_visit_at
        FROM ordered o
        GROUP BY o.client_chat_id, o.partner_chat_id
    ),
    filtered AS (
        SELECT *
        FROM diffs
        WHERE visit_count >= p_min_visits
          AND avg_interval_days > 0
    ),
    upsert AS (
        INSERT INTO client_visit_stats (
            client_chat_id,
            partner_chat_id,
            visit_count,
            avg_interval_days,
            last_visit_at,
            last_computed_at
        )
        SELECT
            f.client_chat_id,
            f.partner_chat_id,
            f.visit_count,
            f.avg_interval_days,
            f.last_visit_at,
            NOW()
        FROM filtered f
        ON CONFLICT (client_chat_id, partner_chat_id) DO UPDATE
        SET
            visit_count = EXCLUDED.visit_count,
            avg_interval_days = EXCLUDED.avg_interval_days,
            last_visit_at = EXCLUDED.last_visit_at,
            last_computed_at = NOW()
        RETURNING 1
    )
    SELECT COALESCE(COUNT(*), 0) INTO v_rows_updated FROM upsert;

    RETURN v_rows_updated;
END;
$$;


-- 2) get_churn_candidates()
-- Возвращает пары (client, partner), для которых:
--  - партнёр включил реактивацию (reactivation_enabled IS TRUE)
--  - days_since_last >= max(min_days, avg_interval_days * coefficient)
--  - не нарушен cooldown по последней отправке реактивации

CREATE OR REPLACE FUNCTION public.get_churn_candidates(
    p_partner_chat_id TEXT DEFAULT NULL,
    p_min_days_threshold INTEGER DEFAULT 7,
    p_coefficient_k NUMERIC DEFAULT 2.0,
    p_reactivation_cooldown_days INTEGER DEFAULT 14
)
RETURNS TABLE (
    client_chat_id TEXT,
    partner_chat_id TEXT,
    trigger_reason TEXT,
    days_since_last INTEGER,
    avg_interval_days NUMERIC
)
LANGUAGE sql
STABLE
AS $$
WITH base AS (
    SELECT
        cvs.client_chat_id,
        cvs.partner_chat_id,
        cvs.last_visit_at,
        cvs.avg_interval_days,
        COALESCE(p.reactivation_enabled, TRUE) AS enabled,
        COALESCE(p.reactivation_min_days, p_min_days_threshold) AS min_days,
        COALESCE(p.reactivation_coefficient, p_coefficient_k) AS coeff,
        COALESCE(p.reactivation_cooldown_days, p_reactivation_cooldown_days) AS cooldown_days
    FROM client_visit_stats cvs
    LEFT JOIN partners p
        ON p.chat_id = cvs.partner_chat_id
    WHERE (p_partner_chat_id IS NULL OR cvs.partner_chat_id = p_partner_chat_id)
),
last_events AS (
    SELECT
        e.client_chat_id,
        e.partner_chat_id,
        MAX(e.sent_at) AS last_sent_at
    FROM reactivation_events e
    WHERE e.status = 'sent'
    GROUP BY e.client_chat_id, e.partner_chat_id
)
SELECT
    b.client_chat_id,
    b.partner_chat_id,
    'churn'::TEXT AS trigger_reason,
    FLOOR(EXTRACT(EPOCH FROM (NOW()::timestamptz - b.last_visit_at)) / 86400.0)::INT AS days_since_last,
    b.avg_interval_days
FROM base b
LEFT JOIN last_events le
    ON le.client_chat_id = b.client_chat_id
   AND le.partner_chat_id = b.partner_chat_id
WHERE b.enabled IS TRUE
  AND b.last_visit_at IS NOT NULL
  AND b.avg_interval_days > 0
  AND (
        le.last_sent_at IS NULL
        OR NOW()::timestamptz >= le.last_sent_at + MAKE_INTERVAL(days => b.cooldown_days)
      )
  AND FLOOR(EXTRACT(EPOCH FROM (NOW()::timestamptz - b.last_visit_at)) / 86400.0)::INT >=
      GREATEST(
          b.min_days,
          CEIL(b.avg_interval_days * b.coeff)
      );
$$;

