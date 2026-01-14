
    def get_active_deal(self, source_partner_id: str, target_partner_id: str) -> Optional[dict]:
        """
        Возвращает активную B2B сделку между партнерами.
        """
        if not self.client:
            return None
        try:
            response = self.client.table('partner_deals').select('*').match({
                'source_partner_chat_id': source_partner_id,
                'target_partner_chat_id': target_partner_id,
                'status': 'active'
            }).execute()
            
            if response.data:
                deal = response.data[0]
                # Проверка срока действия
                if deal.get('expires_at'):
                    expires = datetime.datetime.fromisoformat(deal['expires_at'].replace('Z', '+00:00'))
                    if expires < datetime.datetime.now(datetime.timezone.utc):
                        return None
                return deal
            return None
        except Exception as e:
            logging.error(f"Error getting active deal: {e}")
            return None

    def set_partner_category(self, partner_chat_id: str, category: str) -> bool:
        """Устанавливает категорию бизнеса партнера"""
        if not self.client:
            return False
        try:
            self.client.table('partners').update({
                'category_group': category
            }).eq('chat_id', str(partner_chat_id)).execute()
            return True
        except Exception as e:
            logging.error(f"Error setting partner category: {e}")
            return False

    def get_partner_config(self, partner_chat_id: str) -> dict:
        """Получает конфигурацию партнера (категория, ui_config)"""
        if not self.client:
            return {}
        try:
            response = self.client.table('partners').select(
                'category_group, ui_config, business_type'
            ).eq('chat_id', str(partner_chat_id)).single().execute()
            return response.data or {}
        except Exception as e:
            logging.error(f"Error getting partner config: {e}")
            return {}
