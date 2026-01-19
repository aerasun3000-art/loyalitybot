"""
Сервис для выплат комиссий через TON блокчейн
"""
import os
import logging
from decimal import Decimal
from typing import List, Dict, Optional
from datetime import datetime
from supabase_manager import SupabaseManager

# Пока используем requests для TON Center API
# В будущем можно перейти на pytonlib для работы с кошельками
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Константы
NANO_TON = 1_000_000_000  # 1 TON = 1e9 nanoTON
MIN_PAYOUT_AMOUNT_USD = Decimal('10.00')  # Минимальная сумма выплаты


class TONPaymentService:
    """
    Сервис для отправки TON транзакций и управления выплатами
    """
    
    def __init__(self, supabase_manager: SupabaseManager):
        """
        Инициализация TON Payment Service
        
        Args:
            supabase_manager: Экземпляр SupabaseManager для работы с БД
        """
        self.db = supabase_manager
        self.wallet_address = os.getenv('TON_WALLET_ADDRESS')
        self.wallet_seed = os.getenv('TON_WALLET_SEED')  # КРИТИЧНО: хранить в секретах!
        self.network = os.getenv('TON_NETWORK', 'testnet')  # testnet или mainnet
        self.api_key = os.getenv('TON_API_KEY')
        
        # TON Center API URL
        if self.network == 'mainnet':
            self.ton_api_url = 'https://toncenter.com/api/v2'
        else:
            self.ton_api_url = 'https://testnet.toncenter.com/api/v2'
        
        if not self.wallet_address:
            logger.warning("TON_WALLET_ADDRESS не установлен в переменных окружения")
        if not self.wallet_seed:
            logger.warning("TON_WALLET_SEED не установлен в переменных окружения (КРИТИЧНО для отправки транзакций!)")
    
    def get_ton_exchange_rate(self) -> Decimal:
        """
        Получает актуальный курс TON/USD
        
        Сначала пытается получить из БД, если нет - из внешнего API
        
        Returns:
            Decimal: Курс TON/USD (1 TON = X USD)
        """
        try:
            # 1. Попробовать получить из БД (последний актуальный)
            result = self.db.client.table('ton_exchange_rates').select('rate').is_(
                'effective_until', 'null'
            ).order('effective_from', desc=True).limit(1).execute()
            
            if result.data and len(result.data) > 0:
                rate = Decimal(str(result.data[0]['rate']))
                logger.debug(f"Курс TON/USD из БД: {rate}")
                return rate
        except Exception as e:
            logger.warning(f"Не удалось получить курс из БД: {e}")
        
        # 2. Получить из внешнего API (Binance)
        try:
            response = requests.get(
                'https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT',
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                price_usdt = Decimal(str(data['price']))
                # USDT ≈ USD
                rate = price_usdt
                
                # Сохранить в БД
                self._save_ton_exchange_rate(rate, 'binance')
                
                logger.info(f"Курс TON/USD из Binance: {rate}")
                return rate
        except Exception as e:
            logger.warning(f"Не удалось получить курс из Binance: {e}")
        
        # 3. Fallback на CoinGecko
        try:
            response = requests.get(
                'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                rate = Decimal(str(data['the-open-network']['usd']))
                
                # Сохранить в БД
                self._save_ton_exchange_rate(rate, 'coingecko')
                
                logger.info(f"Курс TON/USD из CoinGecko: {rate}")
                return rate
        except Exception as e:
            logger.warning(f"Не удалось получить курс из CoinGecko: {e}")
        
        # 4. Fallback на дефолтный курс (если все API недоступны)
        default_rate = Decimal('5.00')  # Примерный курс (нужно обновлять вручную)
        logger.error(f"Все источники курса недоступны, использую дефолтный: {default_rate}")
        return default_rate
    
    def _save_ton_exchange_rate(self, rate: Decimal, source: str):
        """
        Сохраняет курс TON/USD в БД
        
        Args:
            rate: Курс TON/USD
            source: Источник курса (binance, coingecko, manual)
        """
        try:
            # Обновить effective_until для предыдущих курсов
            self.db.client.table('ton_exchange_rates').update({
                'effective_until': datetime.now().isoformat()
            }).is_('effective_until', 'null').execute()
            
            # Вставить новый курс
            self.db.client.table('ton_exchange_rates').insert({
                'rate': float(rate),
                'source': source,
                'effective_from': datetime.now().isoformat()
            }).execute()
        except Exception as e:
            logger.error(f"Ошибка при сохранении курса в БД: {e}")
    
    def usd_to_ton(self, amount_usd: Decimal) -> Dict[str, Decimal]:
        """
        Конвертирует USD в TON
        
        Args:
            amount_usd: Сумма в USD
            
        Returns:
            Dict с ключами:
                - ton_amount: Сумма в TON
                - amount_nano: Сумма в нанотонах
                - exchange_rate: Использованный курс
        """
        exchange_rate = self.get_ton_exchange_rate()
        ton_amount = amount_usd / exchange_rate
        amount_nano = int(ton_amount * NANO_TON)
        
        return {
            'ton_amount': ton_amount,
            'amount_nano': amount_nano,
            'exchange_rate': exchange_rate
        }
    
    def send_ton_payment(
        self,
        to_address: str,
        amount_nano: int,
        comment: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Отправляет TON транзакцию
        
        ⚠️ ВНИМАНИЕ: Это базовая реализация через TON Center API.
        Для production нужно использовать pytonlib с подписанием транзакций.
        
        Args:
            to_address: Адрес получателя (TON кошелек)
            amount_nano: Сумма в нанотонах
            comment: Комментарий к транзакции (опционально)
            
        Returns:
            Dict с ключами:
                - success: bool
                - tx_hash: str (если success=True)
                - tx_lt: int
                - block_seqno: int
                - error: str (если success=False)
        """
        if not self.wallet_seed:
            return {
                'success': False,
                'error': 'TON_WALLET_SEED не установлен. Невозможно отправить транзакцию.'
            }
        
        if not self.wallet_address:
            return {
                'success': False,
                'error': 'TON_WALLET_ADDRESS не установлен. Невозможно отправить транзакцию.'
            }
        
        # ⚠️ TODO: Реализовать реальную отправку транзакции через pytonlib
        # Сейчас возвращаем заглушку для тестирования
        logger.warning("⚠️ send_ton_payment: Используется заглушка. Для production нужна реализация через pytonlib.")
        
        # Заглушка для тестирования
        fake_tx_hash = f"test_tx_{datetime.now().timestamp()}"
        
        return {
            'success': True,
            'tx_hash': fake_tx_hash,
            'tx_lt': 123456789,
            'block_seqno': 999999,
            'error': None
        }
    
    def process_revenue_share_payment(
        self,
        revenue_share_id: int
    ) -> bool:
        """
        Обрабатывает выплату Revenue Share
        
        Args:
            revenue_share_id: ID записи в partner_revenue_share
            
        Returns:
            bool: True если выплата успешно обработана
        """
        try:
            # 1. Получить запись из partner_revenue_share
            result = self.db.client.table('partner_revenue_share').select(
                'id, partner_chat_id, final_amount, amount_usd, status, ton_tx_hash'
            ).eq('id', revenue_share_id).single().execute()
            
            if not result.data:
                logger.error(f"Revenue Share {revenue_share_id} не найдена")
                return False
            
            revenue_share = result.data
            
            # 2. Проверить статус (должен быть 'approved')
            if revenue_share.get('status') != 'approved':
                logger.warning(f"Revenue Share {revenue_share_id} не в статусе 'approved': {revenue_share.get('status')}")
                return False
            
            # 3. Проверить что еще не выплачено
            if revenue_share.get('ton_tx_hash'):
                logger.info(f"Revenue Share {revenue_share_id} уже выплачена: {revenue_share.get('ton_tx_hash')}")
                return True
            
            # 4. Получить адрес кошелька партнера
            partner_chat_id = revenue_share['partner_chat_id']
            partner_result = self.db.client.table('partners').select(
                'ton_wallet_address, ton_payments_enabled'
            ).eq('chat_id', partner_chat_id).single().execute()
            
            if not partner_result.data:
                logger.error(f"Партнер {partner_chat_id} не найден")
                return False
            
            partner = partner_result.data
            
            if not partner.get('ton_payments_enabled'):
                logger.info(f"TON выплаты отключены для партнера {partner_chat_id}")
                return False
            
            wallet_address = partner.get('ton_wallet_address')
            if not wallet_address:
                logger.warning(f"У партнера {partner_chat_id} не указан TON кошелек")
                return False
            
            # 5. Получить сумму в USD
            amount_usd = Decimal(str(revenue_share.get('amount_usd') or revenue_share.get('final_amount', 0)))
            if amount_usd <= 0:
                logger.warning(f"Некорректная сумма для Revenue Share {revenue_share_id}: {amount_usd}")
                return False
            
            # 6. Конвертировать USD → TON
            conversion = self.usd_to_ton(amount_usd)
            ton_amount = conversion['ton_amount']
            amount_nano = conversion['amount_nano']
            exchange_rate = conversion['exchange_rate']
            
            # 7. Отправить транзакцию
            payment_result = self.send_ton_payment(
                to_address=wallet_address,
                amount_nano=amount_nano,
                comment=f"Revenue Share #{revenue_share_id}"
            )
            
            if not payment_result['success']:
                logger.error(f"Ошибка отправки TON транзакции: {payment_result.get('error')}")
                return False
            
            # 8. Сохранить результат в ton_payments
            ton_payment_data = {
                'partner_chat_id': partner_chat_id,
                'revenue_share_id': revenue_share_id,
                'payment_type': 'revenue_share',
                'amount_usd': float(amount_usd),
                'amount_nano': amount_nano,
                'ton_amount': float(ton_amount),
                'exchange_rate': float(exchange_rate),
                'ton_tx_hash': payment_result['tx_hash'],
                'ton_tx_lt': payment_result.get('tx_lt'),
                'ton_block_seqno': payment_result.get('block_seqno'),
                'from_address': self.wallet_address,
                'to_address': wallet_address,
                'status': 'sent',
                'sent_at': datetime.now().isoformat(),
                'comment': f"Revenue Share #{revenue_share_id}"
            }
            
            ton_payment_result = self.db.client.table('ton_payments').insert(ton_payment_data).execute()
            ton_payment_id = ton_payment_result.data[0]['id'] if ton_payment_result.data else None
            
            # 9. Обновить статус в partner_revenue_share
            self.db.client.table('partner_revenue_share').update({
                'status': 'paid_ton',
                'ton_tx_hash': payment_result['tx_hash'],
                'ton_payment_id': ton_payment_id
            }).eq('id', revenue_share_id).execute()
            
            logger.info(f"Revenue Share {revenue_share_id} успешно выплачена: {payment_result['tx_hash']}")
            return True
            
        except Exception as e:
            logger.error(f"Ошибка при обработке Revenue Share выплаты {revenue_share_id}: {e}")
            return False
    
    def process_referral_commissions_batch(
        self,
        partner_chat_id: str,
        min_amount_usd: Decimal = MIN_PAYOUT_AMOUNT_USD
    ) -> bool:
        """
        Обрабатывает выплату накопленных реферальных комиссий партнера
        
        Выплачивает только если накопилось >= min_amount_usd
        
        Args:
            partner_chat_id: Chat ID партнера
            min_amount_usd: Минимальная сумма для выплаты (по умолчанию $10)
            
        Returns:
            bool: True если выплата успешно обработана
        """
        try:
            # 1. Получить все pending комиссии партнера
            result = self.db.client.table('referral_rewards').select(
                'id, amount_usd, status'
            ).eq('referrer_chat_id', partner_chat_id).eq(
                'status', 'pending'
            ).like('reward_type', 'commission_%').execute()
            
            if not result.data:
                logger.info(f"Нет pending комиссий для партнера {partner_chat_id}")
                return True
            
            # 2. Суммировать amount_usd
            total_amount_usd = sum(Decimal(str(r.get('amount_usd', 0))) for r in result.data)
            
            if total_amount_usd < min_amount_usd:
                logger.info(f"Накопленная сумма {total_amount_usd} USD < порога {min_amount_usd} USD для партнера {partner_chat_id}")
                return True
            
            # 3. Получить адрес кошелька партнера
            partner_result = self.db.client.table('partners').select(
                'ton_wallet_address, ton_payments_enabled'
            ).eq('chat_id', partner_chat_id).single().execute()
            
            if not partner_result.data:
                logger.error(f"Партнер {partner_chat_id} не найден")
                return False
            
            partner = partner_result.data
            
            if not partner.get('ton_payments_enabled'):
                logger.info(f"TON выплаты отключены для партнера {partner_chat_id}")
                return False
            
            wallet_address = partner.get('ton_wallet_address')
            if not wallet_address:
                logger.warning(f"У партнера {partner_chat_id} не указан TON кошелек")
                return False
            
            # 4. Конвертировать USD → TON
            conversion = self.usd_to_ton(total_amount_usd)
            ton_amount = conversion['ton_amount']
            amount_nano = conversion['amount_nano']
            exchange_rate = conversion['exchange_rate']
            
            # 5. Отправить транзакцию
            payment_result = self.send_ton_payment(
                to_address=wallet_address,
                amount_nano=amount_nano,
                comment=f"Referral commissions for {partner_chat_id}"
            )
            
            if not payment_result['success']:
                logger.error(f"Ошибка отправки TON транзакции: {payment_result.get('error')}")
                return False
            
            # 6. Сохранить результат в ton_payments
            ton_payment_data = {
                'partner_chat_id': partner_chat_id,
                'payment_type': 'referral_commission',
                'amount_usd': float(total_amount_usd),
                'amount_nano': amount_nano,
                'ton_amount': float(ton_amount),
                'exchange_rate': float(exchange_rate),
                'ton_tx_hash': payment_result['tx_hash'],
                'ton_tx_lt': payment_result.get('tx_lt'),
                'ton_block_seqno': payment_result.get('block_seqno'),
                'from_address': self.wallet_address,
                'to_address': wallet_address,
                'status': 'sent',
                'sent_at': datetime.now().isoformat(),
                'comment': f"Batch referral commissions for {partner_chat_id}"
            }
            
            ton_payment_result = self.db.client.table('ton_payments').insert(ton_payment_data).execute()
            ton_payment_id = ton_payment_result.data[0]['id'] if ton_payment_result.data else None
            
            # 7. Обновить статусы всех комиссий
            reward_ids = [r['id'] for r in result.data]
            self.db.client.table('referral_rewards').update({
                'status': 'paid_ton',
                'ton_tx_hash': payment_result['tx_hash'],
                'ton_payment_id': ton_payment_id
            }).in_('id', reward_ids).execute()
            
            logger.info(f"Реферальные комиссии для партнера {partner_chat_id} успешно выплачены: {payment_result['tx_hash']}, сумма: {total_amount_usd} USD")
            return True
            
        except Exception as e:
            logger.error(f"Ошибка при обработке реферальных комиссий для партнера {partner_chat_id}: {e}")
            return False
