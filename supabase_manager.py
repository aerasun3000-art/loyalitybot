import os
import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError
import pandas as pd
import logging 
from dateutil import parser # Добавлена библиотека для безопасного парсинга дат

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# -----------------------------------------------------------------
# КОНСТАНТЫ СХЕМЫ БАЗЫ ДАННЫХ
# -----------------------------------------------------------------
USER_TABLE = 'users'
PHONE_COLUMN = 'phone'
BALANCE_COLUMN = 'balance'
PARTNER_ID_COLUMN = 'referral_source'
TRANSACTION_TABLE = 'transactions'

class SupabaseManager:
    """Управляет всеми взаимодействиями с базой данных Supabase."""

    def __init__(self):
        supabase_url: str = os.environ.get("SUPABASE_URL")
        supabase_key: str = os.environ.get("SUPABASE_KEY")

        if not supabase_url or not supabase_key:
            self.client = None
            logging.warning("Переменные SUPABASE_URL или SUPABASE_KEY не найдены. Методы БД будут недоступны.")
        else:
            self.client: Client = create_client(supabase_url, supabase_key)

        self.CASHBACK_PERCENT = 0.05
        
        bonus_from_env = os.getenv("WELCOME_BONUS_AMOUNT", "100") 
        try:
            self._WELCOME_BONUS = int(bonus_from_env) 
        except ValueError:
            self._WELCOME_BONUS = 100
            logging.error(f"Не удалось преобразовать WELCOME_BONUS_AMOUNT '{bonus_from_env}' в число. Установлено значение 100.")

    # Доступ к константе для client_handler.py (согласно контракту)
    @property
    def WELCOME_BONUS_AMOUNT(self):
        return self._WELCOME_BONUS

    # -----------------------------------------------------------------
    # I. МЕТОДЫ ПРОВЕРКИ СУЩЕСТВОВАНИЯ И СТАТУСА 
    # -----------------------------------------------------------------

    def client_exists(self, chat_id: int) -> bool:
        """Проверяет, существует ли клиент по Chat ID."""
        if not self.client: return False
        try:
            response = self.client.from_(USER_TABLE).select('chat_id').eq('chat_id', str(chat_id)).limit(1).execute()
            if response.data: return True
            response_temp = self.client.from_(USER_TABLE).select('chat_id').eq('chat_id', f"VIA_PARTNER_{str(chat_id)}").limit(1).execute()
            return bool(response_temp.data)
        except Exception:
            return False

    def get_client_by_phone(self, phone: str) -> dict | None:
        """Возвращает данные клиента по номеру телефона."""
        if not self.client: return None
        try:
            # Убеждаемся, что номер ищется в чистом виде (без форматирования)
            clean_phone = phone.replace('+', '').replace(' ', '').replace('-', '').strip()
            response = self.client.from_(USER_TABLE).select('*').eq(PHONE_COLUMN, clean_phone).limit(1).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logging.error(f"Error getting client by phone: {e}")
            return None

    # -----------------------------------------------------------------
    # II. МЕТОДЫ РЕГИСТРАЦИИ (Атомарные)
    # -----------------------------------------------------------------
    
    # -----------------------------------------------------------------
    # НОВЫЙ МЕТОД: Ручная регистрация (для bot.py) - заменяет 2 старых метода.
    # -----------------------------------------------------------------
    def handle_manual_registration(self, phone: str, partner_id: str, welcome_bonus: int = None) -> tuple[str, str | None]:
        """
        Атомарно обрабатывает регистрацию клиента по номеру телефона, устраняя дублирование.
        Возвращает: (сообщение_для_бота, ошибка_текст)
        """
        if not self.client: 
            return "Ошибка инициализации базы данных.", "DB_INIT_ERROR"
            
        if welcome_bonus is None: 
            welcome_bonus = self._WELCOME_BONUS
        
        clean_phone = phone.replace('+', '').replace(' ', '').replace('-', '').strip()
        client_data = self.get_client_by_phone(clean_phone)

        # 1. СЦЕНАРИЙ: Клиент УЖЕ СУЩЕСТВУЕТ
        if client_data:
            client_chat_id_original = client_data['chat_id']
            current_balance = client_data.get(BALANCE_COLUMN, 0)

            # Проверка, был ли уже начислен приветственный бонус (по транзакциям)
            try:
                response = self.client.from_(TRANSACTION_TABLE).select('id').eq('client_chat_id', client_chat_id_original).eq('operation_type', 'enrollment_bonus').limit(1).execute()
                if response.data:
                    # Сценарий 3: Бонус уже начислен
                    return "Бонус уже был начислен этому клиенту.", "БОНУС_УЖЕ_АКТИВИРОВАН"
            except Exception as e:
                logging.error(f"Ошибка БД при проверке enrollment_bonus: {e}")
                return "Ошибка проверки транзакций.", "DB_TXN_CHECK_ERROR"

            # Сценарий 2: Клиент существует, но бонуса нет (баланс=0)
            if current_balance == 0:
                new_balance = welcome_bonus
                description = f"Начисление стартового бонуса ({welcome_bonus} баллов) вручную партнером: {partner_id}"
                
                update_data = {
                    BALANCE_COLUMN: new_balance,
                    PARTNER_ID_COLUMN: partner_id, 
                    'status': 'active'
                }

                # Обновляем временный ID, если он есть, на ID партнера для записи транзакции
                client_chat_id_for_txn = client_chat_id_original
                if client_chat_id_original.startswith("VIA_PARTNER_"):
                    # Это помогает избежать ошибок FK в транзакциях
                    update_data['chat_id'] = partner_id 
                    client_chat_id_for_txn = partner_id 

                try:
                    self.client.from_(USER_TABLE).update(update_data).eq('chat_id', client_chat_id_original).execute()
                    self.record_transaction(client_chat_id_for_txn, partner_id, welcome_bonus, 'enrollment_bonus', description, raw_amount=0.00)
                    
                    return (
                        f"Клиент **{phone}** найден и активирован. Начислен стартовый бонус: {welcome_bonus} баллов. "
                        f"Новый баланс: {new_balance}.", 
                        None
                    )
                except APIError as e:
                    logging.error(f"Ошибка БД при ручной регистрации (С2): {e}")
                    return f"Ошибка БД при обновлении клиента {phone}.", "DB_UPDATE_ERROR"
            else:
                 # Клиент существует, и баланс > 0 (бонус скорее всего был начислен, но на всякий случай)
                 return f"Баланс клиента составляет {current_balance} баллов. Начисление стартового бонуса невозможно.", "БАЛАНС_НЕ_НУЛЕВОЙ"

        # 2. СЦЕНАРИЙ: Клиент НЕ НАЙДЕН (Чистая регистрация)
        else:
            # Сценарий 1: Новый клиент
            temp_chat_id = f"VIA_PARTNER_{clean_phone}" 
            
            client_data = {
                'chat_id': temp_chat_id, PHONE_COLUMN: clean_phone, 'status': 'active', BALANCE_COLUMN: welcome_bonus,
                'registered_via': 'partner_invite', PARTNER_ID_COLUMN: partner_id, 
                'name': f"Клиент {clean_phone[-4:]}", 'reg_date': datetime.datetime.now().isoformat()
            }
            
            try:
                self.client.from_(USER_TABLE).insert(client_data).execute()
                
                transaction_data = {
                    'client_chat_id': temp_chat_id, 'partner_chat_id': partner_id, 'total_amount': 0,
                    'earned_points': welcome_bonus, 'spent_points': 0, 'operation_type': 'enrollment_bonus', 
                    'description': 'Приветственный бонус при регистрации через Партнера',
                    'date_time': datetime.datetime.now().isoformat()
                }
                self.client.from_(TRANSACTION_TABLE).insert(transaction_data).execute()
                
                message = (
                    f"Новый клиент **{phone}** успешно зарегистрирован и получил **{welcome_bonus}** баллов.\n"
                    f"Обязательно отправьте клиенту ссылку на Клиентский бот для активации."
                )
                return message, None
            
            except APIError as e:
                logging.error(f"Ошибка БД при ручной регистрации (С1): {e}")
                return f"Ошибка БД при регистрации клиента: {e}", "DB_INSERT_ERROR"
            
    # -----------------------------------------------------------------
    # МЕТОДЫ РЕГИСТРАЦИИ ПО ССЫЛКЕ (для client_handler.py)
    # -----------------------------------------------------------------
    def register_client_via_link(self, chat_id: int, partner_chat_id: str, phone: str | None, name: str | None, welcome_bonus: int = None) -> tuple[str, str | None] | tuple[None, str]:
        """Регистрирует клиента, пришедшего по ссылке (Клиентский бот)."""
        if not self.client: return None, "DB is not initialized."
        client_chat_id = str(chat_id)
        if welcome_bonus is None: welcome_bonus = self._WELCOME_BONUS 
        
        if self.client_exists(client_chat_id):
             return None, "Клиент уже зарегистрирован в боте."
        
        # 1. Проверка существования по Номеру телефона - Логика АКТИВАЦИИ
        if phone:
            existing_client = self.client.from_(USER_TABLE).select('chat_id', BALANCE_COLUMN).eq(PHONE_COLUMN, phone).limit(1).execute().data
            if existing_client:
                old_chat_id = existing_client[0].get('chat_id')
                if old_chat_id.startswith("VIA_PARTNER_"):
                    # Если клиент найден по телефону, но имеет временный ID, активируем его
                    self.update_client_chat_id(old_chat_id, client_chat_id)
                    return f"✅ Клиент {name} (ранее зарегистрированный) успешно активирован!", None
                else:
                     # Если клиент найден по телефону и ID настоящий, это дубликат, который надо предотвратить.
                     return None, "Клиент с этим номером уже зарегистрирован."
        
        # 2. Новая прямая регистрация (чистая вставка)
        client_data = {
            'chat_id': client_chat_id, 
            PHONE_COLUMN: phone,
            'status': 'active',
            BALANCE_COLUMN: welcome_bonus,
            'registered_via': 'partner_link', 
            PARTNER_ID_COLUMN: partner_chat_id, 
            'name': name,
            'reg_date': datetime.datetime.now().isoformat()
        }
        
        try:
            self.client.from_(USER_TABLE).insert(client_data).execute()
        except APIError as e:
             return None, f"Ошибка БД при регистрации клиента: {e}"

        try:
            transaction_data = {
                'client_chat_id': client_chat_id, 'partner_chat_id': partner_chat_id, 'total_amount': 0, 
                'earned_points': welcome_bonus, 'spent_points': 0, 'operation_type': 'enrollment_bonus', 
                'description': 'Приветственный бонус при регистрации по реферальной ссылке',
                'date_time': datetime.datetime.now().isoformat() 
            }
            self.client.from_(TRANSACTION_TABLE).insert(transaction_data).execute()
        except APIError as e:
             logging.error(f"Ошибка БД при записи бонуса (link): {e}")
             return None, f"Ошибка БД при записи бонуса: {e}"

        client_message = (
            f"🎉 Клиент **{name}** успешно зарегистрирован по ссылке и получил **{welcome_bonus}** баллов!"
        )
        return client_message, None

    def update_client_chat_id(self, old_id: str, new_id: str) -> bool:
        """Обновляет временный chat_id клиента на настоящий ID в всех таблицах."""
        if not self.client: return False
        try:
            self.client.from_(USER_TABLE).update({'chat_id': new_id}).eq('chat_id', old_id).execute()
            self.client.from_(TRANSACTION_TABLE).update({'client_chat_id': new_id}).eq('client_chat_id', old_id).execute()
            self.client.from_('nps_ratings').update({'client_chat_id': new_id}).eq('client_chat_id', old_id).execute()
            return True
        except Exception as e:
            logging.error(f"Error updating client chat ID: {e}")
            return False

    # -----------------------------------------------------------------
    # III. МЕТОДЫ БАЛАНСА И ТРАНЗАКЦИЙ
    # -----------------------------------------------------------------
    
    def get_client_balance(self, chat_id: int) -> int:
        """Возвращает текущий баланс клиента."""
        if not self.client: return 0
        try:
            response = self.client.from_(USER_TABLE).select(BALANCE_COLUMN).eq('chat_id', str(chat_id)).limit(1).execute()
            if response.data:
                return int(response.data[0].get(BALANCE_COLUMN, 0))
            return 0
        except Exception:
            return 0

    def record_transaction(self, client_chat_id: int, partner_chat_id: int, points: int, transaction_type: str, description: str, raw_amount: float = 0.00) -> bool:
        """Записывает транзакцию в таблицу 'transactions'."""
        if not self.client: return False
        
        earned = points if transaction_type in ['accrual', 'enrollment_bonus'] else 0
        spent = points if transaction_type == 'redemption' else 0
        amount_for_db = int(raw_amount) if raw_amount == 0.00 else raw_amount 

        try:
            data = {
                "client_chat_id": str(client_chat_id), "partner_chat_id": str(partner_chat_id), 
                "date_time": datetime.datetime.now().isoformat(), "total_amount": amount_for_db,
                "earned_points": earned, "spent_points": spent, "operation_type": transaction_type, 
                "description": description,
            }
            self.client.from_(TRANSACTION_TABLE).insert(data).execute()  
            return True
        except Exception as e:
            logging.error(f"Error recording transaction: {e}")
            return False

    def execute_transaction(self, client_chat_id: int, partner_chat_id: int, txn_type: str, raw_amount: float) -> dict:
        """Выполняет атомарное начисление или списание баллов."""
        if not self.client: return {"success": False, "error": "DB is not initialized.", "new_balance": 0}

        current_balance = self.get_client_balance(client_chat_id)
        
        transaction_amount_points = 0 
        type_for_record = ''

        if txn_type == 'accrual':
            transaction_amount_points = int(raw_amount * self.CASHBACK_PERCENT) 
            new_balance = current_balance + transaction_amount_points
            description = f"Начисление {transaction_amount_points} бонусов за чек {raw_amount} руб. (Партнер: {partner_chat_id})"
            type_for_record = 'accrual'
            
        elif txn_type == 'spend':
            transaction_amount_points = int(raw_amount)
            if transaction_amount_points > current_balance:
                return {"success": False, "error": "Недостаточно бонусов для списания.", "new_balance": current_balance}

            new_balance = current_balance - transaction_amount_points
            description = f"Списание {transaction_amount_points} бонусов (Партнер: {partner_chat_id})"
            type_for_record = 'redemption'
        
        else:
            return {"success": False, "error": "Неверный тип транзакции.", "new_balance": current_balance}
            
        try:
            self.client.from_(USER_TABLE).update({BALANCE_COLUMN: new_balance}).eq('chat_id', str(client_chat_id)).execute()
            self.record_transaction(client_chat_id, partner_chat_id, transaction_amount_points, type_for_record, description, raw_amount=raw_amount)
            
            return {"success": True, "new_balance": new_balance, "points": transaction_amount_points}
            
        except APIError as e:
            logging.error(f"Ошибка БД при execute_transaction: {e}")
            return {"success": False, "error": f"Ошибка БД: {e}", "new_balance": current_balance}
        except Exception as e:
            logging.error(f"Неизвестная ошибка при execute_transaction: {e}")
            return {"success": False, "error": f"Неизвестная ошибка: {e}", "new_balance": current_balance}


    # -----------------------------------------------------------------
    # IV. МЕТОДЫ ДЛЯ ПАРТНЕРСКОГО ПОРТАЛА И АНАЛИТИКИ
    # -----------------------------------------------------------------

    def get_client_analytics(self, client_chat_id: int) -> dict:
        """Calculates key analytical metrics (LTV, transaction frequency) for a client."""
        if not self.client:
            return {'ltv_rub': 0.0, 'total_transactions': 0, 'months_active': 0, 'freq_per_month': 0.0, 'reg_date': None}

        client_chat_id = str(client_chat_id)
        stats = {'ltv_rub': 0.0, 'total_transactions': 0, 'months_active': 0, 'freq_per_month': 0.0, 'reg_date': None}

        try:
            user_response = self.client.from_(USER_TABLE).select('reg_date').eq('chat_id', client_chat_id).limit(1).execute()
            if not user_response.data or not user_response.data[0].get('reg_date'):
                return stats 

            reg_date_str = user_response.data[0]['reg_date']
            stats['reg_date'] = reg_date_str
            
            # Безопасный парсинг даты
            reg_date = parser.isoparse(reg_date_str)
            
            now = datetime.datetime.now(reg_date.tzinfo) # Используем tzinfo для корректного расчета
            delta = now - reg_date
            months_active = max(1, round(delta.days / 30.44)) 
            stats['months_active'] = months_active

            # !!! ИСПРАВЛЕНО: Заменено 'date' на 'date_time'
            txn_response = self.client.from_(TRANSACTION_TABLE).select('operation_type, total_amount, date_time').eq('client_chat_id', client_chat_id).execute()
            transactions = txn_response.data
            
            total_accrual_amount = 0.0
            total_transactions = 0
            
            for txn in transactions:
                total_transactions += 1
                if txn.get('operation_type') == 'accrual': 
                    total_accrual_amount += txn.get('total_amount', 0.0) 

            stats['ltv_rub'] = round(total_accrual_amount, 2)
            stats['total_transactions'] = total_transactions
            
            if months_active > 0:
                stats['freq_per_month'] = round(total_transactions / months_active, 2)

        except Exception as e:
            logging.error(f"Error fetching client analytics for {client_chat_id}: {e}")

        return stats

    def get_client_details_for_partner(self, client_chat_id: int) -> dict | None:
        """Получает основные детали клиента, включая аналитические метрики LTV и Частоту."""
        if not self.client: return None
        try:
            response = self.client.from_(USER_TABLE).select('*').eq('chat_id', str(client_chat_id)).limit(1).execute()
            if not response.data: return None
            
            client_data = response.data[0]
            analytics = self.get_client_analytics(client_chat_id)
            
            return {
                "chat_id": client_data.get('chat_id'),
                "name": client_data.get('name', 'Не указано'),
                "balance": client_data.get(BALANCE_COLUMN, 0),
                "status": client_data.get('status', 'Bronze'),
                "phone": client_data.get(PHONE_COLUMN, 'Не указан'),
                "reg_date": analytics['reg_date'],
                "ltv_rub": analytics['ltv_rub'], 
                "total_transactions": analytics['total_transactions'], 
                "freq_per_month": analytics['freq_per_month'], 
            }
        except Exception:
            return None


    def get_partner_stats(self, partner_chat_id: str) -> dict:
        """Собирает ключевую статистику для Партнера."""
        if not self.client: return {}
        partner_chat_id = str(partner_chat_id)
        stats = {
            'total_referrals': 0, 'total_transactions': 0, 'total_accrued_points': 0,
            'total_spent_rub': 0.0, 'avg_nps_rating': 0.0, 'promoters': 0, 'detractors': 0
        }

        try:
            referrals_response = self.client.from_(USER_TABLE).select('chat_id').eq(PARTNER_ID_COLUMN, partner_chat_id).execute()
            stats['total_referrals'] = len(referrals_response.data)

            txn_response = self.client.from_(TRANSACTION_TABLE).select('operation_type, total_amount, earned_points, spent_points').eq('partner_chat_id', partner_chat_id).execute()
            transactions = txn_response.data
            
            stats['total_transactions'] = len(transactions)
            
            for txn in transactions:
                if txn.get('operation_type') == 'accrual': 
                    stats['total_spent_rub'] += txn.get('total_amount', 0.0) 
                    
                if txn.get('operation_type') in ['accrual', 'enrollment_bonus']: 
                    stats['total_accrued_points'] += txn.get('earned_points', 0) 

            nps_response = self.client.from_('nps_ratings').select('rating').eq('partner_chat_id', partner_chat_id).execute()
            ratings = [r['rating'] for r in nps_response.data]

            if ratings:
                stats['avg_nps_rating'] = round(sum(ratings) / len(ratings), 2)
                stats['promoters'] = sum(1 for r in ratings if r >= 9)
                stats['detractors'] = sum(1 for r in ratings if r <= 6)

        except Exception as e:
            logging.error(f"Error fetching partner stats for {partner_chat_id}: {e}")

        return stats
    
    def get_advanced_partner_stats(self, partner_chat_id: str, period_days: int = 30) -> dict:
        """
        Расширенная статистика партнера с детальными бизнес-метриками.
        
        Args:
            partner_chat_id: ID партнера
            period_days: Период для анализа в днях (по умолчанию 30)
        
        Returns:
            dict с метриками: средний чек, churn rate, конверсии, тренды и т.д.
        """
        if not self.client: 
            return {}
        
        partner_chat_id = str(partner_chat_id)
        now = datetime.datetime.now()
        period_start = now - datetime.timedelta(days=period_days)
        
        stats = {
            # Базовые метрики
            'period_days': period_days,
            'total_clients': 0,
            'active_clients': 0,  # Клиенты с транзакциями за период
            'new_clients': 0,  # Новые клиенты за период
            
            # Финансовые метрики
            'total_revenue': 0.0,  # Общий оборот
            'avg_check': 0.0,  # Средний чек
            'avg_ltv': 0.0,  # Средний LTV клиента
            
            # Транзакционные метрики
            'total_transactions': 0,
            'accrual_transactions': 0,  # Количество начислений
            'redemption_transactions': 0,  # Количество списаний
            'total_points_accrued': 0,
            'total_points_redeemed': 0,
            
            # Метрики вовлеченности
            'returning_clients': 0,  # Клиенты с >1 транзакцией за период
            'avg_frequency': 0.0,  # Средняя частота покупок
            'churn_rate': 0.0,  # Процент ушедших клиентов
            
            # NPS метрики
            'avg_nps': 0.0,
            'nps_score': 0,  # Чистый NPS индекс
            'promoters': 0,
            'passives': 0,
            'detractors': 0,
            
            # Конверсионные метрики
            'registration_to_first_purchase': 0.0,  # % клиентов с первой покупкой
            'repeat_purchase_rate': 0.0,  # % повторных покупок
        }
        
        try:
            # Получаем всех клиентов партнера
            all_clients_response = self.client.from_(USER_TABLE).select('chat_id, reg_date').eq(PARTNER_ID_COLUMN, partner_chat_id).execute()
            all_clients = all_clients_response.data
            stats['total_clients'] = len(all_clients)
            
            # Новые клиенты за период
            new_clients = [c for c in all_clients if c.get('reg_date') and parser.isoparse(c['reg_date']) >= period_start]
            stats['new_clients'] = len(new_clients)
            
            # Получаем транзакции за период
            txn_response = self.client.from_(TRANSACTION_TABLE).select('*').eq('partner_chat_id', partner_chat_id).gte('date_time', period_start.isoformat()).execute()
            transactions = txn_response.data
            
            stats['total_transactions'] = len(transactions)
            
            # Анализ транзакций
            accrual_amounts = []
            active_clients_set = set()
            client_transaction_counts = {}
            client_revenues = {}
            
            for txn in transactions:
                client_id = txn.get('client_chat_id')
                operation_type = txn.get('operation_type')
                
                active_clients_set.add(client_id)
                client_transaction_counts[client_id] = client_transaction_counts.get(client_id, 0) + 1
                
                if operation_type == 'accrual':
                    stats['accrual_transactions'] += 1
                    amount = txn.get('total_amount', 0.0)
                    stats['total_revenue'] += amount
                    accrual_amounts.append(amount)
                    stats['total_points_accrued'] += txn.get('earned_points', 0)
                    
                    # Учитываем revenue по клиентам
                    client_revenues[client_id] = client_revenues.get(client_id, 0.0) + amount
                    
                elif operation_type == 'redemption':
                    stats['redemption_transactions'] += 1
                    stats['total_points_redeemed'] += txn.get('spent_points', 0)
                elif operation_type == 'enrollment_bonus':
                    stats['total_points_accrued'] += txn.get('earned_points', 0)
            
            stats['active_clients'] = len(active_clients_set)
            
            # Средний чек
            if accrual_amounts:
                stats['avg_check'] = round(sum(accrual_amounts) / len(accrual_amounts), 2)
            
            # Средний LTV
            if client_revenues:
                stats['avg_ltv'] = round(sum(client_revenues.values()) / len(client_revenues), 2)
            
            # Клиенты с повторными покупками
            stats['returning_clients'] = sum(1 for count in client_transaction_counts.values() if count > 1)
            
            # Средняя частота покупок (транзакций на активного клиента)
            if stats['active_clients'] > 0:
                stats['avg_frequency'] = round(stats['total_transactions'] / stats['active_clients'], 2)
            
            # Churn rate (упрощенная формула: клиенты без транзакций за период / всего клиентов)
            if stats['total_clients'] > 0:
                inactive_clients = stats['total_clients'] - stats['active_clients']
                stats['churn_rate'] = round((inactive_clients / stats['total_clients']) * 100, 2)
            
            # NPS метрики за период
            nps_response = self.client.from_('nps_ratings').select('rating').eq('partner_chat_id', partner_chat_id).gte('created_at', period_start.isoformat()).execute()
            ratings = [r['rating'] for r in nps_response.data]
            
            if ratings:
                stats['avg_nps'] = round(sum(ratings) / len(ratings), 2)
                stats['promoters'] = sum(1 for r in ratings if r >= 9)
                stats['passives'] = sum(1 for r in ratings if r in [7, 8])
                stats['detractors'] = sum(1 for r in ratings if r <= 6)
                
                # Чистый NPS индекс
                total_ratings = len(ratings)
                stats['nps_score'] = round(((stats['promoters'] - stats['detractors']) / total_ratings) * 100, 0)
            
            # Конверсионные метрики
            # Регистрация -> Первая покупка
            clients_with_purchases = len(client_revenues)
            if stats['total_clients'] > 0:
                stats['registration_to_first_purchase'] = round((clients_with_purchases / stats['total_clients']) * 100, 2)
            
            # Повторные покупки
            if clients_with_purchases > 0:
                stats['repeat_purchase_rate'] = round((stats['returning_clients'] / clients_with_purchases) * 100, 2)
            
        except Exception as e:
            logging.error(f"Error fetching advanced partner stats for {partner_chat_id}: {e}")
        
        return stats
    
    def get_partner_stats_by_period(self, partner_chat_id: str, start_date: str, end_date: str) -> dict:
        """
        Получает статистику партнера за указанный период (для графиков).
        
        Args:
            partner_chat_id: ID партнера
            start_date: Начало периода (ISO format: YYYY-MM-DD)
            end_date: Конец периода (ISO format: YYYY-MM-DD)
        
        Returns:
            dict с данными по дням для построения графиков
        """
        if not self.client:
            return {}
        
        partner_chat_id = str(partner_chat_id)
        
        try:
            start_dt = parser.isoparse(start_date)
            end_dt = parser.isoparse(end_date)
        except Exception as e:
            logging.error(f"Invalid date format: {e}")
            return {}
        
        result = {
            'period': {'start': start_date, 'end': end_date},
            'daily_stats': [],  # Массив объектов {date, revenue, transactions, clients}
            'totals': {
                'revenue': 0.0,
                'transactions': 0,
                'unique_clients': 0,
                'points_accrued': 0
            }
        }
        
        try:
            # Получаем все транзакции за период
            txn_response = self.client.from_(TRANSACTION_TABLE).select('*').eq('partner_chat_id', partner_chat_id).gte('date_time', start_dt.isoformat()).lte('date_time', end_dt.isoformat()).execute()
            transactions = txn_response.data
            
            # Группируем по дням
            daily_data = {}
            all_clients = set()
            
            for txn in transactions:
                txn_date_str = txn.get('date_time', '')
                if not txn_date_str:
                    continue
                
                txn_date = parser.isoparse(txn_date_str).date()
                date_key = txn_date.isoformat()
                
                if date_key not in daily_data:
                    daily_data[date_key] = {
                        'date': date_key,
                        'revenue': 0.0,
                        'transactions': 0,
                        'clients': set(),
                        'points_accrued': 0
                    }
                
                daily_data[date_key]['transactions'] += 1
                daily_data[date_key]['clients'].add(txn.get('client_chat_id'))
                all_clients.add(txn.get('client_chat_id'))
                
                if txn.get('operation_type') == 'accrual':
                    amount = txn.get('total_amount', 0.0)
                    daily_data[date_key]['revenue'] += amount
                    result['totals']['revenue'] += amount
                
                if txn.get('operation_type') in ['accrual', 'enrollment_bonus']:
                    points = txn.get('earned_points', 0)
                    daily_data[date_key]['points_accrued'] += points
                    result['totals']['points_accrued'] += points
            
            # Преобразуем в массив для фронтенда
            for date_key in sorted(daily_data.keys()):
                day_data = daily_data[date_key]
                result['daily_stats'].append({
                    'date': day_data['date'],
                    'revenue': round(day_data['revenue'], 2),
                    'transactions': day_data['transactions'],
                    'unique_clients': len(day_data['clients']),
                    'points_accrued': day_data['points_accrued']
                })
            
            result['totals']['transactions'] = len(transactions)
            result['totals']['unique_clients'] = len(all_clients)
            result['totals']['revenue'] = round(result['totals']['revenue'], 2)
            
        except Exception as e:
            logging.error(f"Error fetching partner stats by period: {e}")
        
        return result
    
    def export_partner_data_to_csv(self, partner_chat_id: str, period_days: int = 30) -> tuple[bool, str]:
        """
        Экспортирует данные партнера в CSV формат.
        
        Args:
            partner_chat_id: ID партнера
            period_days: Период для экспорта в днях
        
        Returns:
            tuple[bool, str]: (успех, путь к файлу или сообщение об ошибке)
        """
        if not self.client:
            return False, "Database not initialized"
        
        partner_chat_id = str(partner_chat_id)
        now = datetime.datetime.now()
        period_start = now - datetime.timedelta(days=period_days)
        
        try:
            # Получаем транзакции
            txn_response = self.client.from_(TRANSACTION_TABLE).select('*').eq('partner_chat_id', partner_chat_id).gte('date_time', period_start.isoformat()).execute()
            
            if not txn_response.data:
                return False, "No data to export"
            
            # Создаем DataFrame
            df = pd.DataFrame(txn_response.data)
            
            # Форматируем колонки для читаемости
            if 'date_time' in df.columns:
                df['date_time'] = pd.to_datetime(df['date_time']).dt.strftime('%Y-%m-%d %H:%M:%S')
            
            # Переименовываем колонки на русский (опционально)
            column_mapping = {
                'date_time': 'Дата и время',
                'client_chat_id': 'ID клиента',
                'operation_type': 'Тип операции',
                'total_amount': 'Сумма (руб)',
                'earned_points': 'Начислено баллов',
                'spent_points': 'Списано баллов',
                'description': 'Описание'
            }
            
            # Выбираем нужные колонки
            export_columns = [col for col in column_mapping.keys() if col in df.columns]
            df_export = df[export_columns].rename(columns=column_mapping)
            
            # Создаем имя файла
            filename = f"partner_{partner_chat_id}_export_{now.strftime('%Y%m%d_%H%M%S')}.csv"
            filepath = os.path.join(os.path.dirname(__file__), 'exports', filename)
            
            # Создаем директорию exports если её нет
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            # Сохраняем в CSV
            df_export.to_csv(filepath, index=False, encoding='utf-8-sig')  # utf-8-sig для Excel
            
            logging.info(f"Exported data for partner {partner_chat_id} to {filepath}")
            return True, filepath
            
        except Exception as e:
            logging.error(f"Error exporting partner data: {e}")
            return False, f"Export error: {str(e)}"
    
    def get_partner_cohort_analysis(self, partner_chat_id: str) -> dict:
        """
        Когортный анализ клиентов партнера (по месяцам регистрации).
        
        Args:
            partner_chat_id: ID партнера
        
        Returns:
            dict с когортными данными
        """
        if not self.client:
            return {}
        
        partner_chat_id = str(partner_chat_id)
        
        result = {
            'cohorts': [],  # Массив когорт с метриками
            'retention_matrix': []  # Матрица удержания
        }
        
        try:
            # Получаем всех клиентов партнера
            clients_response = self.client.from_(USER_TABLE).select('chat_id, reg_date').eq(PARTNER_ID_COLUMN, partner_chat_id).execute()
            clients = clients_response.data
            
            if not clients:
                return result
            
            # Группируем по месяцам регистрации
            cohort_groups = {}
            for client in clients:
                if not client.get('reg_date'):
                    continue
                
                reg_date = parser.isoparse(client['reg_date'])
                cohort_month = reg_date.strftime('%Y-%m')
                
                if cohort_month not in cohort_groups:
                    cohort_groups[cohort_month] = []
                
                cohort_groups[cohort_month].append(client['chat_id'])
            
            # Анализируем каждую когорту
            for cohort_month in sorted(cohort_groups.keys()):
                client_ids = cohort_groups[cohort_month]
                
                # Получаем транзакции для когорты
                txn_response = self.client.from_(TRANSACTION_TABLE).select('client_chat_id, date_time, total_amount').eq('partner_chat_id', partner_chat_id).in_('client_chat_id', client_ids).execute()
                
                cohort_revenue = sum(txn.get('total_amount', 0) for txn in txn_response.data if txn.get('operation_type') == 'accrual')
                cohort_transactions = len(txn_response.data)
                
                result['cohorts'].append({
                    'month': cohort_month,
                    'clients_count': len(client_ids),
                    'total_revenue': round(cohort_revenue, 2),
                    'total_transactions': cohort_transactions,
                    'avg_revenue_per_client': round(cohort_revenue / len(client_ids), 2) if client_ids else 0
                })
            
        except Exception as e:
            logging.error(f"Error in cohort analysis: {e}")
        
        return result
        
    def get_all_clients(self) -> pd.DataFrame:
        """Получает всех клиентов."""
        if not self.client: return pd.DataFrame()
        try:
            response = self.client.from_(USER_TABLE).select('*').execute()
            return pd.DataFrame(response.data) if response.data else pd.DataFrame()
        except Exception:
            return pd.DataFrame()

    def get_all_partners(self) -> pd.DataFrame:
        """Получает все заявки партнеров."""
        if not self.client: return pd.DataFrame()
        try:
            response = self.client.from_('partner_applications').select('*').execute()
            return pd.DataFrame(response.data) if response.data else pd.DataFrame()
        except Exception:
            return pd.DataFrame()
            
    def update_partner_status(self, partner_id: str, new_status: str) -> bool:
        """Обновляет статус партнера."""
        if not self.client: return False
        try:
            self.client.from_('partner_applications').update({'status': new_status}).eq('chat_id', partner_id).execute()
            # Если партнер одобрен — гарантируем наличие записи в таблице partners (для FK)
            if new_status == 'Approved':
                self.ensure_partner_record(partner_id)
            return True
        except Exception:
            return False

    def record_nps_rating(self, client_chat_id: str, partner_chat_id: str, rating: int, master_name: str | None = None) -> bool:
        """Записывает оценку NPS клиента."""
        if not self.client: return False
        try:
            data = {
                "client_chat_id": client_chat_id, "partner_chat_id": partner_chat_id, "rating": rating,
                "master_name": master_name, "created_at": datetime.datetime.now().isoformat(),
            }
            self.client.from_('nps_ratings').insert(data).execute()
            return True
        except APIError as e:
            logging.error(f"Error recording NPS rating (API): {e}")
            return False
        except Exception as e:
            logging.error(f"Unknown error recording NPS rating: {e}")
            return False

    # -----------------------------------------------------------------
    # V. МЕТОДЫ ДЛЯ ПАРТНЕРОВ
    # -----------------------------------------------------------------

    def partner_exists(self, chat_id: int) -> bool:
        """Проверяет, существует ли партнер по Chat ID."""
        if not self.client: return False
        try:
            response = self.client.from_('partner_applications').select('chat_id').eq('chat_id', str(chat_id)).limit(1).execute()
            return bool(response.data)
        except Exception as e:
            logging.error(f"Error checking partner existence: {e}")
            return False

    def get_partner_status(self, chat_id: int) -> str:
        """Возвращает статус партнера."""
        if not self.client: return 'Unknown'
        try:
            response = self.client.from_('partner_applications').select('status').eq('chat_id', str(chat_id)).limit(1).execute()
            if response.data:
                return response.data[0].get('status', 'Unknown')
            return 'Unknown'
        except Exception as e:
            logging.error(f"Error getting partner status: {e}")
            return 'Unknown'

    def approve_partner(self, chat_id: int) -> bool:
        """Одобряет заявку партнера."""
        if not self.client: return False
        try:
            self.client.from_('partner_applications').update({'status': 'Approved'}).eq('chat_id', str(chat_id)).execute()
            # Создаем/обновляем запись в partners для соблюдения внешних ключей
            self.ensure_partner_record(str(chat_id))
            return True
        except Exception as e:
            logging.error(f"Error approving partner: {e}")
            return False

    def reject_partner(self, chat_id: int) -> bool:
        """Отклоняет заявку партнера."""
        if not self.client: return False
        try:
            self.client.from_('partner_applications').update({'status': 'Rejected'}).eq('chat_id', str(chat_id)).execute()
            return True
        except Exception as e:
            logging.error(f"Error rejecting partner: {e}")
            return False

    def ensure_partner_record(self, partner_chat_id: str) -> bool:
        """Гарантирует, что в таблице partners есть запись с данным chat_id (для FK ссылок).
        Создает или обновляет запись, копируя данные из заявки.
        """
        if not self.client:
            return False
        try:
            # Получаем данные из заявки
            app_response = self.client.from_('partner_applications').select('*').eq('chat_id', partner_chat_id).limit(1).execute()
            if not app_response.data:
                logging.error(f"ensure_partner_record: application not found for {partner_chat_id}")
                return False
                
            app_data = app_response.data[0]
            
            # Формируем запись для partners, копируя только доступные поля из заявки
            record = {
                'chat_id': str(partner_chat_id),
                'name': app_data.get('name') or app_data.get('contact_person') or 'Партнер',
                'company_name': app_data.get('company_name', '')
            }
            
            # upsert по chat_id — если строка есть, не меняем другие поля
            self.client.from_('partners').upsert(record, on_conflict='chat_id').execute()
            return True
        except Exception as e:
            logging.error(f"ensure_partner_record failed for {partner_chat_id}: {e}")
            return False

    def add_promotion(self, promo_data: dict) -> bool:
        """Добавляет новую акцию с валидацией и нормализацией полей.
        Требуемые поля таблицы promotions: partner_chat_id (text), title (text), description (text),
        discount_value (text), start_date (date, YYYY-MM-DD), end_date (date, YYYY-MM-DD).
        Не передаем явные id/created_at (есть default), статус трактуем как is_active: True.
        """
        if not self.client:
            return False

        # Ожидаемые поля из бота и маппинг в таблицу
        title = promo_data.get('title')
        description = promo_data.get('description')
        discount_value = promo_data.get('discount_value')
        partner_chat_id = str(promo_data.get('partner_chat_id', '')).strip()
        start_date = promo_data.get('start_date')  # ожидается YYYY-MM-DD
        end_date = promo_data.get('end_date')      # ожидается YYYY-MM-DD

        # Простейшая валидация обязательных полей
        if not title or not description or not discount_value or not partner_chat_id or not end_date:
            logging.error(f"add_promotion: missing required fields. title={title}, description={description}, discount_value={discount_value}, partner_chat_id={partner_chat_id}, end_date={end_date}")
            print(f"ERROR: add_promotion missing required fields")
            return False

        # Предварительная проверка существования партнера в таблице partners (для FK)
        try:
            check = self.client.from_('partners').select('chat_id').eq('chat_id', partner_chat_id).limit(1).execute()
            if not check.data:
                logging.error(f"add_promotion: partner {partner_chat_id} not found in 'partners' (FK)")
                print(f"ERROR: partner {partner_chat_id} not found in partners table")
                return False
        except Exception as e:
            logging.error(f"add_promotion: partners precheck failed: {e}")
            print(f"ERROR: partners precheck failed: {e}")
            return False

        # Нормализация дат: если нет start_date, ставим сегодня; конвертируем к YYYY-MM-DD
        try:
            if not start_date:
                start_date = datetime.datetime.now().strftime("%Y-%m-%d")
            else:
                # Попробуем распарсить любую ISO и привести к YYYY-MM-DD
                start_date = parser.isoparse(start_date).date().strftime("%Y-%m-%d")

            end_date = parser.isoparse(end_date).date().strftime("%Y-%m-%d")
        except Exception as e:
            logging.error(f"add_promotion: invalid date format for start_date/end_date. Error: {e}")
            print(f"ERROR: invalid date format: {e}")
            return False

        # Формируем запись для БД строго по колонкам promotions
        record = {
            'partner_chat_id': partner_chat_id,
            'title': title,
            'description': description,
            'discount_value': discount_value,
            'start_date': start_date,
            'end_date': end_date,
            'is_active': True,  # Акция активна по умолчанию
        }
        
        # Добавляем image_url если есть
        if promo_data.get('image_url'):
            record['image_url'] = promo_data.get('image_url')

        try:
            result = self.client.from_('promotions').insert(record).execute()
            print(f"SUCCESS: Promotion inserted successfully. Result: {result}")
            logging.info(f"Promotion inserted successfully for partner {partner_chat_id}")
            return True
        except APIError as e:
            logging.error(f"Error adding promotion (API): {e}")
            print(f"ERROR: API error adding promotion: {e}")
            return False
        except Exception as e:
            logging.error(f"Error adding promotion: {e}")
            print(f"ERROR: Exception adding promotion: {e}")
            import traceback
            traceback.print_exc()
            return False

    def add_service(self, service_data: dict) -> bool:
        """Добавляет новую услугу."""
        if not self.client: return False
        
        # Гарантируем наличие статуса
        if 'status' not in service_data:
            service_data['status'] = 'Pending'
        
        # Проверяем существование партнёра в таблице partners (для FK)
        partner_chat_id = service_data.get('partner_chat_id')
        if partner_chat_id:
            try:
                check = self.client.from_('partners').select('chat_id').eq('chat_id', partner_chat_id).limit(1).execute()
                if not check.data:
                    logging.error(f"add_service: partner {partner_chat_id} not found in 'partners' table (FK)")
                    # Пробуем создать запись партнёра
                    self.ensure_partner_record(partner_chat_id)
            except Exception as e:
                logging.error(f"add_service: partners check failed: {e}")
        
        try:
            self.client.from_('services').insert(service_data).execute()
            logging.info(f"Service '{service_data.get('title')}' added successfully for partner {partner_chat_id}")
            return True
        except Exception as e:
            logging.error(f"Error adding service: {e}")
            return False

    def get_pending_services_for_admin(self) -> pd.DataFrame:
        """Получает услуги на модерации для админа."""
        if not self.client: return pd.DataFrame()
        try:
            response = self.client.from_('services').select('*').eq('approval_status', 'Pending').execute()
            return pd.DataFrame(response.data) if response.data else pd.DataFrame()
        except Exception as e:
            logging.error(f"Error getting pending services: {e}")
            return pd.DataFrame()

    def update_service_approval_status(self, service_id: int, new_status: str) -> bool:
        """Обновляет статус одобрения услуги."""
        if not self.client: return False
        try:
            self.client.from_('services').update({'approval_status': new_status}).eq('id', service_id).execute()
            return True
        except Exception as e:
            logging.error(f"Error updating service status: {e}")
            return False

    # -----------------------------------------------------------------
    # VI. МЕТОДЫ ДЛЯ РАБОТЫ С НОВОСТЯМИ
    # -----------------------------------------------------------------

    def create_news(self, news_data: dict) -> tuple[bool, int | None]:
        """
        Создает новую новость.
        
        Args:
            news_data: Словарь с данными новости
                - title (str): Заголовок новости
                - content (str): Полный текст новости
                - preview_text (str, optional): Краткое описание
                - image_url (str, optional): URL изображения
                - author_chat_id (str): ID администратора
                - is_published (bool, optional): Опубликована ли новость (по умолчанию True)
        
        Returns:
            tuple[bool, int | None]: (успех операции, ID созданной новости)
        """
        if not self.client:
            return False, None
        
        try:
            # Валидация обязательных полей
            if not news_data.get('title') or not news_data.get('content'):
                logging.error("create_news: missing required fields (title or content)")
                return False, None
            
            # Подготовка данных для вставки
            record = {
                'title': news_data['title'],
                'content': news_data['content'],
                'preview_text': news_data.get('preview_text', news_data['content'][:200]),
                'author_chat_id': str(news_data.get('author_chat_id', '')),
                'is_published': news_data.get('is_published', True),
                'created_at': datetime.datetime.now().isoformat(),
                'updated_at': datetime.datetime.now().isoformat()
            }
            
            # Добавляем image_url если есть
            if news_data.get('image_url'):
                record['image_url'] = news_data['image_url']
            
            result = self.client.from_('news').insert(record).execute()
            
            if result.data and len(result.data) > 0:
                news_id = result.data[0]['id']
                logging.info(f"News created successfully with ID: {news_id}")
                return True, news_id
            
            return False, None
            
        except Exception as e:
            logging.error(f"Error creating news: {e}")
            return False, None

    def get_all_news(self, published_only: bool = True) -> pd.DataFrame:
        """
        Получает все новости.
        
        Args:
            published_only: Если True, возвращает только опубликованные новости
        
        Returns:
            DataFrame с новостями
        """
        if not self.client:
            return pd.DataFrame()
        
        try:
            query = self.client.from_('news').select('*')
            
            if published_only:
                query = query.eq('is_published', True)
            
            response = query.order('created_at', desc=True).execute()
            return pd.DataFrame(response.data) if response.data else pd.DataFrame()
            
        except Exception as e:
            logging.error(f"Error getting news: {e}")
            return pd.DataFrame()

    def get_news_by_id(self, news_id: int) -> dict | None:
        """
        Получает новость по ID.
        
        Args:
            news_id: ID новости
        
        Returns:
            Словарь с данными новости или None
        """
        if not self.client:
            return None
        
        try:
            response = self.client.from_('news').select('*').eq('id', news_id).limit(1).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            
            return None
            
        except Exception as e:
            logging.error(f"Error getting news by id {news_id}: {e}")
            return None

    def update_news(self, news_id: int, updates: dict) -> bool:
        """
        Обновляет существующую новость.
        
        Args:
            news_id: ID новости для обновления
            updates: Словарь с полями для обновления
        
        Returns:
            True если успешно, False иначе
        """
        if not self.client:
            return False
        
        try:
            # Добавляем время обновления
            updates['updated_at'] = datetime.datetime.now().isoformat()
            
            self.client.from_('news').update(updates).eq('id', news_id).execute()
            logging.info(f"News {news_id} updated successfully")
            return True
            
        except Exception as e:
            logging.error(f"Error updating news {news_id}: {e}")
            return False

    def delete_news(self, news_id: int) -> bool:
        """
        Удаляет новость.
        
        Args:
            news_id: ID новости для удаления
        
        Returns:
            True если успешно, False иначе
        """
        if not self.client:
            return False
        
        try:
            self.client.from_('news').delete().eq('id', news_id).execute()
            logging.info(f"News {news_id} deleted successfully")
            return True
            
        except Exception as e:
            logging.error(f"Error deleting news {news_id}: {e}")
            return False

    def increment_news_views(self, news_id: int) -> bool:
        """
        Увеличивает счетчик просмотров новости.
        
        Args:
            news_id: ID новости
        
        Returns:
            True если успешно, False иначе
        """
        if not self.client:
            return False
        
        try:
            # Получаем текущее количество просмотров
            news = self.get_news_by_id(news_id)
            if not news:
                return False
            
            current_views = news.get('views_count', 0)
            new_views = current_views + 1
            
            self.client.from_('news').update({'views_count': new_views}).eq('id', news_id).execute()
            return True
            
        except Exception as e:
            logging.error(f"Error incrementing views for news {news_id}: {e}")
            return False

    # -----------------------------------------------------------------
    # GDPR COMPLIANCE METHODS
    # -----------------------------------------------------------------
    
    def export_user_data(self, chat_id: str) -> dict:
        """
        Экспортирует все данные пользователя в соответствии с GDPR (Right to Data Portability).
        
        Args:
            chat_id: Telegram chat ID пользователя
        
        Returns:
            Словарь со всеми данными пользователя или None в случае ошибки
        """
        if not self.client:
            logging.error("Supabase client not initialized")
            return None
        
        try:
            user_data = {
                'export_date': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'chat_id': chat_id,
                'client_data': None,
                'partner_data': None,
                'transactions': [],
                'partner_applications': []
            }
            
            # 1. Данные клиента
            try:
                client_response = self.client.from_('clients').select('*').eq('chat_id', chat_id).execute()
                if client_response.data:
                    user_data['client_data'] = client_response.data[0]
            except Exception as e:
                logging.warning(f"No client data found for {chat_id}: {e}")
            
            # 2. Данные партнера
            try:
                partner_response = self.client.from_('partners').select('*').eq('chat_id', chat_id).execute()
                if partner_response.data:
                    user_data['partner_data'] = partner_response.data[0]
            except Exception as e:
                logging.warning(f"No partner data found for {chat_id}: {e}")
            
            # 3. Транзакции (как клиента)
            try:
                transactions_response = self.client.from_('transactions').select('*').eq('client_chat_id', chat_id).execute()
                if transactions_response.data:
                    user_data['transactions'] = transactions_response.data
            except Exception as e:
                logging.warning(f"No transactions found for {chat_id}: {e}")
            
            # 4. Транзакции (как партнера)
            try:
                partner_trans_response = self.client.from_('transactions').select('*').eq('partner_chat_id', chat_id).execute()
                if partner_trans_response.data:
                    user_data['partner_transactions'] = partner_trans_response.data
            except Exception as e:
                logging.warning(f"No partner transactions found for {chat_id}: {e}")
            
            # 5. Заявки на партнерство
            try:
                applications_response = self.client.from_('partner_applications').select('*').eq('chat_id', chat_id).execute()
                if applications_response.data:
                    user_data['partner_applications'] = applications_response.data
            except Exception as e:
                logging.warning(f"No partner applications found for {chat_id}: {e}")
            
            # 6. Услуги партнера
            if user_data['partner_data']:
                try:
                    services_response = self.client.from_('services').select('*').eq('partner_chat_id', chat_id).execute()
                    if services_response.data:
                        user_data['partner_services'] = services_response.data
                except Exception as e:
                    logging.warning(f"No services found for partner {chat_id}: {e}")
            
            # 7. Акции партнера
            if user_data['partner_data']:
                try:
                    promotions_response = self.client.from_('promotions').select('*').eq('partner_chat_id', chat_id).execute()
                    if promotions_response.data:
                        user_data['partner_promotions'] = promotions_response.data
                except Exception as e:
                    logging.warning(f"No promotions found for partner {chat_id}: {e}")
            
            logging.info(f"Successfully exported data for user {chat_id}")
            return user_data
            
        except Exception as e:
            logging.error(f"Error exporting user data for {chat_id}: {e}")
            return None

    def delete_user_data(self, chat_id: str) -> dict:
        """
        Полностью удаляет все данные пользователя из системы в соответствии с GDPR (Right to be Forgotten).
        
        ВНИМАНИЕ: Это действие необратимо!
        
        Args:
            chat_id: Telegram chat ID пользователя
        
        Returns:
            Словарь с результатами удаления по каждой таблице
        """
        if not self.client:
            logging.error("Supabase client not initialized")
            return {'success': False, 'error': 'Database not available'}
        
        deletion_results = {
            'chat_id': chat_id,
            'deletion_date': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'success': True,
            'tables_deleted': {}
        }
        
        try:
            # 1. Удаление услуг партнера (если есть)
            try:
                self.client.from_('services').delete().eq('partner_chat_id', chat_id).execute()
                deletion_results['tables_deleted']['services'] = 'deleted'
                logging.info(f"Deleted services for {chat_id}")
            except Exception as e:
                deletion_results['tables_deleted']['services'] = f'error: {str(e)}'
                logging.warning(f"Error deleting services for {chat_id}: {e}")
            
            # 2. Удаление акций партнера (если есть)
            try:
                self.client.from_('promotions').delete().eq('partner_chat_id', chat_id).execute()
                deletion_results['tables_deleted']['promotions'] = 'deleted'
                logging.info(f"Deleted promotions for {chat_id}")
            except Exception as e:
                deletion_results['tables_deleted']['promotions'] = f'error: {str(e)}'
                logging.warning(f"Error deleting promotions for {chat_id}: {e}")
            
            # 3. Анонимизация транзакций (не удаляем, чтобы не нарушить финансовую отчетность)
            # Заменяем chat_id на "DELETED_USER" для соблюдения GDPR
            try:
                # Транзакции как клиента
                self.client.from_('transactions').update({
                    'client_chat_id': 'DELETED_USER',
                    'description': 'User data deleted per GDPR request'
                }).eq('client_chat_id', chat_id).execute()
                
                # Транзакции как партнера
                self.client.from_('transactions').update({
                    'partner_chat_id': 'DELETED_USER'
                }).eq('partner_chat_id', chat_id).execute()
                
                deletion_results['tables_deleted']['transactions'] = 'anonymized'
                logging.info(f"Anonymized transactions for {chat_id}")
            except Exception as e:
                deletion_results['tables_deleted']['transactions'] = f'error: {str(e)}'
                deletion_results['success'] = False
                logging.error(f"Error anonymizing transactions for {chat_id}: {e}")
            
            # 4. Удаление заявок на партнерство
            try:
                self.client.from_('partner_applications').delete().eq('chat_id', chat_id).execute()
                deletion_results['tables_deleted']['partner_applications'] = 'deleted'
                logging.info(f"Deleted partner applications for {chat_id}")
            except Exception as e:
                deletion_results['tables_deleted']['partner_applications'] = f'error: {str(e)}'
                logging.warning(f"Error deleting partner applications for {chat_id}: {e}")
            
            # 5. Удаление данных партнера
            try:
                self.client.from_('partners').delete().eq('chat_id', chat_id).execute()
                deletion_results['tables_deleted']['partners'] = 'deleted'
                logging.info(f"Deleted partner data for {chat_id}")
            except Exception as e:
                deletion_results['tables_deleted']['partners'] = f'error: {str(e)}'
                logging.warning(f"Error deleting partner data for {chat_id}: {e}")
            
            # 6. Удаление данных клиента (последним, т.к. может быть FK)
            try:
                self.client.from_('clients').delete().eq('chat_id', chat_id).execute()
                deletion_results['tables_deleted']['clients'] = 'deleted'
                logging.info(f"Deleted client data for {chat_id}")
            except Exception as e:
                deletion_results['tables_deleted']['clients'] = f'error: {str(e)}'
                deletion_results['success'] = False
                logging.error(f"Error deleting client data for {chat_id}: {e}")
            
            if deletion_results['success']:
                logging.info(f"Successfully deleted all data for user {chat_id}")
            else:
                logging.warning(f"Partial deletion completed for user {chat_id}")
            
            return deletion_results
            
        except Exception as e:
            logging.error(f"Critical error during user data deletion for {chat_id}: {e}")
            deletion_results['success'] = False
            deletion_results['error'] = str(e)
            return deletion_results
