-- Add google_maps_link column to partners table

ALTER TABLE partners
ADD COLUMN IF NOT EXISTS google_maps_link TEXT;

COMMENT ON COLUMN partners.google_maps_link IS 'Link to Google Maps location for the partner';
