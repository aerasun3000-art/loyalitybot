-- Allow partner to disable client messages
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS allow_client_messages BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN partners.allow_client_messages IS 'Разрешить клиентам отправлять сообщения партнёру через бот';
