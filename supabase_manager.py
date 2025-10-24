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
