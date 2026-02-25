-- Add approval_status to promotions for moderation flow
-- Existing promotions become Approved; new ones from partners start as Pending

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'Approved'
    CHECK (approval_status IN ('Pending', 'Approved', 'Rejected'));

COMMENT ON COLUMN promotions.approval_status IS 'Модерация: Pending — на проверке, Approved — одобрено, Rejected — отклонено';

-- Backfill existing promotions
UPDATE promotions SET approval_status = 'Approved' WHERE approval_status IS NULL OR approval_status = '';

CREATE INDEX IF NOT EXISTS idx_promotions_approval_status ON promotions(approval_status);
