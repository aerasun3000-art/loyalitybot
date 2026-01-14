
    # --- ECOSYSTEM 2.0 METHODS ---
    
    def get_active_deal(self, source_partner_id: str, target_partner_id: str) -> Optional[dict]:
        """Возвращает активную B2B сделку между партнерами."""
        if not self.client: return None
        try:
            # Ищем активную сделку
            response = self.client.table('partner_deals').select('*').match({
                'source_partner_chat_id': str(source_partner_id),
                'target_partner_chat_id': str(target_partner_id),
                'status': 'active'
            }).execute()
            
            if response.data:
                deal = response.data[0]
                # Проверка срока действия
                if deal.get('expires_at'):
                    # Простая проверка, предполагаем что expires_at в ISO формате
                    expires_str = deal['expires_at']
                    try:
                        expires = datetime.datetime.fromisoformat(expires_str.replace('Z', '+00:00'))
                        if expires < datetime.datetime.now(datetime.timezone.utc):
                            return None
                    except Exception:
                        pass # Если ошибка парсинга даты, считаем сделку активной (или можно наоборот)
                return deal
            return None
        except Exception as e:
            logging.error(f"Error getting active deal: {e}")
            return None

    def get_partner_config(self, partner_chat_id: str) -> dict:
        """Получает расширенную конфигурацию партнера."""
        if not self.client: return {}
        try:
            response = self.client.table('partners').select(
                'category_group, ui_config, default_cashback_percent, default_referral_commission_percent'
            ).eq('chat_id', str(partner_chat_id)).single().execute()
            return response.data or {}
        except Exception as e:
            logging.error(f"Error getting partner config: {e}")
            return {}

    def _get_referral_source(self, client_chat_id: str) -> Optional[str]:
        """Получает ID партнера, который пригласил клиента."""
        if not self.client: return None
        try:
            response = self.client.from_(USER_TABLE).select(PARTNER_ID_COLUMN).eq('chat_id', str(client_chat_id)).single().execute()
            if response.data:
                return response.data.get(PARTNER_ID_COLUMN)
            return None
        except Exception:
            return None

    def _calculate_accrual_points_with_deals(self, client_chat_id: int, partner_chat_id: int, raw_amount: float) -> tuple[int, str]:
        """
        Рассчитывает баллы с учетом B2B Deals.
        Возвращает: (points, description_suffix)
        """
        if raw_amount <= 0: return 0, ""

        # 1. Получаем источник реферала
        source_partner_id = self._get_referral_source(str(client_chat_id))
        
        # 2. Ищем сделку (Deal)
        deal = None
        if source_partner_id and str(source_partner_id) != str(partner_chat_id):
            deal = self.get_active_deal(source_partner_id, str(partner_chat_id))
            
        # 3. Определяем процент кэшбэка
        percent = 0.05 # Базовый дефолт
        deal_info = ""
        
        if deal:
            # Если есть сделка, берем процент оттуда
            percent = float(deal.get('client_cashback_percent', 5.0)) / 100.0
            deal_info = " (B2B Deal 🔥)"
        else:
            # Иначе берем дефолтный процент партнера или глобальный
            partner_config = self.get_partner_config(str(partner_chat_id))
            percent = float(partner_config.get('default_cashback_percent', 5.0)) / 100.0
            
        # 4. Расчет
        points = int(raw_amount * percent)
        return points, deal_info

    # Переопределяем execute_transaction для использования новой логики
    def execute_transaction_v2(self, client_chat_id: int, partner_chat_id: int, txn_type: str, raw_amount: float, allow_queue: bool = True) -> dict:
        """
        Версия 2.0 с поддержкой B2B Deals
        """
        # ... (Код аналогичен execute_transaction, но вызывает _calculate_accrual_points_with_deals)
        # Для минимизации изменений в огромном файле, я предложу заменить тело execute_transaction
        pass

