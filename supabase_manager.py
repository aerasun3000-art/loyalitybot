import os
import json
import math
import datetime
from typing import Any, Optional, Union
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError
from transaction_queue import TransactionQueue
import pandas as pd
import logging 
from dateutil import parser # Добавлена библиотека для безопасного парсинга дат
from transaction_queue import TransactionQueue
import sentry_sdk

load_dotenv()

# Инициализация Sentry для мониторинга ошибок
sentry_dsn = os.getenv('SENTRY_DSN')
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.getenv('SENTRY_ENVIRONMENT', 'production'),
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        release=f"loyaltybot@{os.getenv('APP_VERSION', '1.0.0')}",
        send_default_pii=True,
    )
    print("✅ Sentry инициализирован для supabase_manager")

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

        # Процент кэшбэка теперь конфигурируется через переменную окружения CASHBACK_PERCENT
        # Пример: CASHBACK_PERCENT=0.05 (5%)
        try:
            self.CASHBACK_PERCENT = float(os.getenv("CASHBACK_PERCENT", "0.05"))
        except ValueError:
            logging.error("Некорректное значение CASHBACK_PERCENT. Использую значение по умолчанию 0.05")
            self.CASHBACK_PERCENT = 0.05
        
        self._cashback_rules_env = None
        self._cashback_rules_cache = None
        self._cashback_rules_cache_ts: Optional[datetime.datetime] = None
        rules_from_env = os.getenv("CASHBACK_RULES_JSON")
        if rules_from_env:
            try:
                parsed_rules = json.loads(rules_from_env)
                if isinstance(parsed_rules, dict):
                    self._cashback_rules_env = parsed_rules
                else:
                    logging.error("CASHBACK_RULES_JSON должен содержать JSON-объект. Игнорирую значение.")
            except json.JSONDecodeError as e:
                logging.error(f"Не удалось разобрать CASHBACK_RULES_JSON: {e}")

        self._operation_templates_env = None
        self._operation_templates_cache = None
        self._operation_templates_cache_ts: Optional[datetime.datetime] = None

        self._transaction_rules_env = None
        self._transaction_rules_cache = None
        self._transaction_rules_cache_ts: Optional[datetime.datetime] = None

        self._transaction_limits_env = None
        self._transaction_limits_cache = None
        self._transaction_limits_cache_ts: Optional[datetime.datetime] = None

        self._analytics_cache_memory: dict[str, dict[str, Any]] = {}
        self.analytics_cache_ttl = int(os.getenv("ANALYTICS_CACHE_TTL", "300"))

        transaction_rules_env = os.getenv("TRANSACTION_RULES_JSON")
        if transaction_rules_env:
            try:
                parsed_rules = json.loads(transaction_rules_env)
                if isinstance(parsed_rules, dict):
                    self._transaction_rules_env = parsed_rules
                else:
                    logging.error("TRANSACTION_RULES_JSON должен содержать JSON-объект. Игнорирую значение.")
            except json.JSONDecodeError as e:
                logging.error(f"Не удалось разобрать TRANSACTION_RULES_JSON: {e}")

        operation_templates_env = os.getenv("OPERATION_TEMPLATES_JSON")
        if operation_templates_env:
            try:
                parsed_templates = json.loads(operation_templates_env)
                if isinstance(parsed_templates, dict):
                    self._operation_templates_env = parsed_templates
                else:
                    logging.error("OPERATION_TEMPLATES_JSON должен содержать JSON-объект. Игнорирую значение.")
            except json.JSONDecodeError as e:
                logging.error(f"Не удалось разобрать OPERATION_TEMPLATES_JSON: {e}")

        transaction_limits_env = os.getenv("TRANSACTION_LIMITS_JSON")
        if transaction_limits_env:
            try:
                parsed_limits = json.loads(transaction_limits_env)
                if isinstance(parsed_limits, dict):
                    self._transaction_limits_env = parsed_limits
                else:
                    logging.error("TRANSACTION_LIMITS_JSON должен содержать JSON-объект. Игнорирую значение.")
            except json.JSONDecodeError as e:
                logging.error(f"Не удалось разобрать TRANSACTION_LIMITS_JSON: {e}")

        self.transaction_queue = TransactionQueue(self, os.getenv("TRANSACTION_QUEUE_PATH"))
        
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

    def get_client_by_phone(self, phone: str) -> Optional[dict]:
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
    def handle_manual_registration(self, phone: str, partner_id: str, welcome_bonus: int = None) -> tuple[str, Optional[str]]:
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
    def register_client_via_link(self, chat_id: int, partner_chat_id: str, phone: Optional[str], name: Optional[str], welcome_bonus: int = None) -> Union[tuple[str, Optional[str]], tuple[None, str]]:
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

    def execute_transaction(self, client_chat_id: int, partner_chat_id: int, txn_type: str, raw_amount: float, allow_queue: bool = True) -> dict:
        """Выполняет атомарное начисление или списание баллов."""
        if not self.client: return {"success": False, "error": "DB is not initialized.", "new_balance": 0}

        if allow_queue and self.transaction_queue:
            self.transaction_queue.process_pending()

        current_balance = self.get_client_balance(client_chat_id)
        
        transaction_amount_points = 0 
        type_for_record = ''
        predicted_balance = current_balance

        if txn_type == 'accrual':
            transaction_amount_points = self._calculate_accrual_points(partner_chat_id, raw_amount)
            new_balance = current_balance + transaction_amount_points
            predicted_balance = new_balance
            description = f"Начисление {transaction_amount_points} бонусов за чек {raw_amount} руб. (Партнер: {partner_chat_id})"
            type_for_record = 'accrual'
            
        elif txn_type == 'spend':
            transaction_amount_points = int(raw_amount)
            if transaction_amount_points > current_balance:
                return {"success": False, "error": "Недостаточно бонусов для списания.", "new_balance": current_balance}

            new_balance = current_balance - transaction_amount_points
            predicted_balance = new_balance
            description = f"Списание {transaction_amount_points} бонусов (Партнер: {partner_chat_id})"
            type_for_record = 'redemption'
        
        else:
            return {"success": False, "error": "Неверный тип транзакции.", "new_balance": current_balance}
            
        payload_for_queue = None
        if allow_queue and self.transaction_queue:
            payload_for_queue = {
                "client_chat_id": str(client_chat_id),
                "partner_chat_id": str(partner_chat_id),
                "txn_type": txn_type,
                "raw_amount": raw_amount
            }

        if allow_queue:
            limits_ok, limits_error = self._check_transaction_limits(client_chat_id, partner_chat_id, txn_type, transaction_amount_points, raw_amount)
            if not limits_ok:
                return {"success": False, "error": limits_error, "new_balance": current_balance}

        try:
            self.client.from_(USER_TABLE).update({BALANCE_COLUMN: new_balance}).eq('chat_id', str(client_chat_id)).execute()
            self.record_transaction(client_chat_id, partner_chat_id, transaction_amount_points, type_for_record, description, raw_amount=raw_amount)
            if allow_queue and self.transaction_queue:
                self.transaction_queue.process_pending()
            return {"success": True, "new_balance": new_balance, "points": transaction_amount_points}
            
        except APIError as e:
            logging.error(f"Ошибка БД при execute_transaction: {e}")
            if allow_queue and self.transaction_queue.enqueue(payload_for_queue):
                return {
                    "success": True,
                    "queued": True,
                    "new_balance": predicted_balance,
                    "points": transaction_amount_points,
                    "error": f"Операция поставлена в очередь: {e.message if hasattr(e, 'message') else e}"
                }
            return {"success": False, "error": f"Ошибка БД: {e}", "new_balance": current_balance}
        except Exception as e:
            logging.error(f"Неизвестная ошибка при execute_transaction: {e}")
            if allow_queue and self.transaction_queue.enqueue(payload_for_queue):
                return {
                    "success": True,
                    "queued": True,
                    "new_balance": predicted_balance,
                    "points": transaction_amount_points,
                    "error": f"Операция поставлена в очередь: {e}"
                }
            return {"success": False, "error": f"Неизвестная ошибка: {e}", "new_balance": current_balance}

    def _calculate_accrual_points(self, partner_chat_id: int, raw_amount: float) -> int:
        """Рассчитывает количество баллов с учётом гибких правил начисления."""
        if raw_amount <= 0:
            return 0

        percent = max(self.CASHBACK_PERCENT, 0.0)
        multiplier = 1.0
        min_points = 0
        rounding_mode = 'floor'

        rules = self._get_cashback_rules()
        if isinstance(rules, dict):
            percent = self._extract_float(rules.get('default_percent'), percent)
            multiplier *= self._extract_float(rules.get('global_multiplier'), 1.0)
            rounding_mode = rules.get('rounding', rounding_mode) or rounding_mode
            min_points = max(min_points, int(self._extract_float(rules.get('min_points'), 0)))

            partner_rules = rules.get('partners', {}).get(str(partner_chat_id))
            if isinstance(partner_rules, dict):
                percent = self._extract_float(partner_rules.get('percent'), percent)
                min_points = max(min_points, int(self._extract_float(partner_rules.get('min_points'), min_points)))
                partner_multiplier = self._extract_float(partner_rules.get('multiplier'), 1.0)
                if partner_multiplier > 0:
                    multiplier *= self._resolve_multiplier_with_expiry(partner_rules, partner_multiplier)

        percent = max(percent, 0.0)
        multiplier = max(multiplier, 0.0)

        raw_points = raw_amount * percent * multiplier
        raw_points = self._apply_bonus_rules(partner_chat_id, 'accrual', raw_amount, raw_points)
        points = self._apply_rounding(raw_points, rounding_mode)
        points = max(points, min_points)
        return max(points, 0)

    def _resolve_multiplier_with_expiry(self, rule: dict, multiplier: float) -> float:
        """Применяет множитель с учётом срока действия (если указан)."""
        multiplier_until = rule.get('multiplier_until')
        if not multiplier_until:
            return multiplier

        try:
            expires_at = parser.isoparse(multiplier_until)
            now_dt = datetime.datetime.now(expires_at.tzinfo) if expires_at.tzinfo else datetime.datetime.now()
            if now_dt <= expires_at:
                return multiplier
            return 1.0
        except Exception as e:
            logging.error(f"Ошибка обработки multiplier_until '{multiplier_until}': {e}")
            return multiplier

    def _apply_rounding(self, value: float, mode: str) -> int:
        """Применяет стратегию округления к значению."""
        mode = (mode or 'floor').lower()
        if mode == 'ceil':
            return int(math.ceil(value))
        if mode == 'round':
            return int(round(value))
        if mode == 'truncate':
            return int(math.trunc(value))
        return int(math.floor(value))

    def _extract_float(self, candidate, default: float) -> float:
        """Преобразует значение к float с запасным вариантом."""
        try:
            if candidate is None:
                return default
            return float(candidate)
        except (TypeError, ValueError):
            return default

    def _get_daily_transactions_summary(self, client_chat_id: str, txn_type: str) -> dict:
        summary = {'points': 0, 'amount': 0.0}
        if not self.client:
            return summary

        try:
            day_start = datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            response = (
                self.client
                .from_(TRANSACTION_TABLE)
                .select('operation_type, earned_points, spent_points, total_amount')
                .eq('client_chat_id', str(client_chat_id))
                .eq('operation_type', 'accrual' if txn_type == 'accrual' else 'redemption')
                .gte('date_time', day_start.isoformat())
                .execute()
            )

            records = response.data if isinstance(response.data, list) else []
            for txn in records:
                if txn_type == 'accrual':
                    summary['points'] += int(txn.get('earned_points') or 0)
                    summary['amount'] += float(txn.get('total_amount') or 0.0)
                else:
                    summary['points'] += int(txn.get('spent_points') or 0)
                    summary['amount'] += float(txn.get('total_amount') or 0.0)
        except Exception as e:
            logging.error(f"Ошибка получения суточных лимитов для {client_chat_id}: {e}")

        return summary

    def _check_transaction_limits(self, client_chat_id: int, partner_chat_id: int, txn_type: str, points: int, raw_amount: float) -> tuple[bool, Optional[str]]:
        limits = self._get_transaction_limits()
        if not limits:
            return True, None

        config = limits.get(txn_type) or limits.get(txn_type.upper())
        if not isinstance(config, dict):
            return True, None

        max_points = config.get('max_points_per_transaction')
        if max_points is not None:
            try:
                if points > int(max_points):
                    return False, f"Превышен лимит по {txn_type}: максимум {int(max_points)} баллов за одну операцию."
            except (TypeError, ValueError):
                pass

        max_amount = config.get('max_amount_per_transaction')
        if max_amount is not None:
            try:
                if raw_amount > float(max_amount):
                    return False, f"Сумма операции превышает лимит {float(max_amount)}."
            except (TypeError, ValueError):
                pass

        daily_summary = self._get_daily_transactions_summary(client_chat_id, txn_type)

        daily_points_limit = config.get('max_points_per_day')
        if daily_points_limit is not None:
            try:
                if daily_summary['points'] + points > int(daily_points_limit):
                    return False, f"Превышен дневной лимит: максимум {int(daily_points_limit)} баллов за день."
            except (TypeError, ValueError):
                pass

        daily_amount_limit = config.get('max_amount_per_day')
        if daily_amount_limit is not None:
            try:
                if daily_summary['amount'] + raw_amount > float(daily_amount_limit):
                    return False, f"Превышен дневной лимит по сумме операций: {float(daily_amount_limit)}."
            except (TypeError, ValueError):
                pass

        return True, None

    def _get_cashback_rules(self) -> dict:
        """Возвращает правила кэшбэка из окружения или Supabase."""
        if self._cashback_rules_env is not None:
            return self._cashback_rules_env

        if not self.client:
            return {}

        now = datetime.datetime.now()
        if self._cashback_rules_cache and self._cashback_rules_cache_ts:
            delta = now - self._cashback_rules_cache_ts
            if delta.total_seconds() < 60:
                return self._cashback_rules_cache

        rules_raw = self.get_app_setting('cashback_rules')
        if not rules_raw:
            self._cashback_rules_cache = {}
            self._cashback_rules_cache_ts = now
            return self._cashback_rules_cache

        try:
            parsed = json.loads(rules_raw)
            if isinstance(parsed, dict):
                self._cashback_rules_cache = parsed
            else:
                logging.error("Настройка cashback_rules должна быть JSON-объектом.")
                self._cashback_rules_cache = {}
        except json.JSONDecodeError as e:
            logging.error(f"Ошибка разбора cashback_rules: {e}")
            self._cashback_rules_cache = {}

        self._cashback_rules_cache_ts = now
        return self._cashback_rules_cache

    def _get_operation_templates_config(self) -> dict:
        if self._operation_templates_env is not None:
            return self._operation_templates_env

        if not self.client:
            return {}

        now = datetime.datetime.now()
        if self._operation_templates_cache and self._operation_templates_cache_ts:
            if (now - self._operation_templates_cache_ts).total_seconds() < 60:
                return self._operation_templates_cache

        raw = self.get_app_setting('operation_templates')
        if not raw:
            self._operation_templates_cache = {}
            self._operation_templates_cache_ts = now
            return self._operation_templates_cache

        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                self._operation_templates_cache = parsed
            else:
                logging.error("Настройка operation_templates должна быть JSON-объектом.")
                self._operation_templates_cache = {}
        except json.JSONDecodeError as e:
            logging.error(f"Ошибка разбора operation_templates: {e}")
            self._operation_templates_cache = {}

        self._operation_templates_cache_ts = now
        return self._operation_templates_cache

    def get_operation_templates(self, partner_chat_id: str, txn_type: str) -> list[dict]:
        config = self._get_operation_templates_config()
        if not config:
            return []

        partner_templates = config.get('partners', {}).get(str(partner_chat_id), {})
        templates = partner_templates.get(txn_type)
        if templates is None:
            templates = config.get('default', {}).get(txn_type, [])

        result = []
        for template in templates:
            if not isinstance(template, dict):
                continue
            value = template.get('value')
            try:
                value = float(value)
            except (TypeError, ValueError):
                continue

            label = template.get('label')
            if not label:
                label = f"{int(value) if value.is_integer() else value}"

            result.append({
                'label': str(label),
                'value': value,
                'type': template.get('type', 'fixed')
            })
        return result

    def _get_transaction_rules_config(self) -> dict:
        if self._transaction_rules_env is not None:
            return self._transaction_rules_env

        if not self.client:
            return {}

        now = datetime.datetime.now()
        if self._transaction_rules_cache and self._transaction_rules_cache_ts:
            if (now - self._transaction_rules_cache_ts).total_seconds() < 60:
                return self._transaction_rules_cache

        raw = self.get_app_setting('transaction_rules')
        if not raw:
            self._transaction_rules_cache = {}
            self._transaction_rules_cache_ts = now
            return self._transaction_rules_cache

        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                self._transaction_rules_cache = parsed
            else:
                logging.error("Настройка transaction_rules должна быть JSON-объектом.")
                self._transaction_rules_cache = {}
        except json.JSONDecodeError as e:
            logging.error(f"Ошибка разбора transaction_rules: {e}")
            self._transaction_rules_cache = {}

        self._transaction_rules_cache_ts = now
        return self._transaction_rules_cache

    def _rule_matches_partner(self, rule: dict, partner_chat_id: str) -> bool:
        partners = rule.get('partners')
        if not partners:
            return True
        if isinstance(partners, str):
            return partners == '*' or partners == str(partner_chat_id)
        if isinstance(partners, list):
            return str(partner_chat_id) in [str(p) for p in partners] or '*' in partners
        return True

    def _rule_matches_time(self, rule: dict) -> bool:
        now = datetime.datetime.now()
        days = rule.get('days_of_week')
        if isinstance(days, list) and days:
            try:
                if now.weekday() not in [int(d) for d in days]:
                    return False
            except (TypeError, ValueError):
                pass

        date_start = rule.get('date_start')
        if date_start:
            try:
                if now < parser.isoparse(date_start):
                    return False
            except Exception:
                pass

        date_end = rule.get('date_end')
        if date_end:
            try:
                if now > parser.isoparse(date_end):
                    return False
            except Exception:
                pass

        time_start = rule.get('time_start')
        time_end = rule.get('time_end')
        if time_start or time_end:
            try:
                current_time = now.time()
                if time_start:
                    h, m = [int(x) for x in time_start.split(':')]
                    if current_time < datetime.time(hour=h, minute=m):
                        return False
                if time_end:
                    h, m = [int(x) for x in time_end.split(':')]
                    if current_time > datetime.time(hour=h, minute=m):
                        return False
            except Exception:
                pass

        return True

    def _apply_bonus_rules(self, partner_chat_id: int, txn_type: str, raw_amount: float, base_points: float) -> float:
        config = self._get_transaction_rules_config()
        if not config:
            return base_points

        rules = config.get('rules', [])
        if not isinstance(rules, list):
            return base_points

        total_multiplier = 1.0
        extra_points = 0.0

        for rule in rules:
            if not isinstance(rule, dict):
                continue
            rule_type = rule.get('type')
            rule_txn = rule.get('txn_type')
            if rule_txn and rule_txn != txn_type:
                continue
            if not self._rule_matches_partner(rule, partner_chat_id):
                continue
            if not self._rule_matches_time(rule):
                continue

            min_amount = self._extract_float(rule.get('min_amount'), None)
            max_amount = self._extract_float(rule.get('max_amount'), None)
            if min_amount is not None and raw_amount < min_amount:
                continue
            if max_amount is not None and raw_amount > max_amount:
                continue

            if rule_type == 'multiplier':
                total_multiplier *= self._extract_float(rule.get('value'), 1.0)
            elif rule_type == 'extra_points':
                extra_points += self._extract_float(rule.get('value'), 0.0)
            elif rule_type == 'fixed_points':
                base_points = self._extract_float(rule.get('value'), base_points)

        adjusted = max(base_points * total_multiplier + extra_points, 0.0)
        return adjusted

    def _get_transaction_limits(self) -> dict:
        if self._transaction_limits_env is not None:
            return self._transaction_limits_env

        if not self.client:
            return {}

        now = datetime.datetime.now()
        if self._transaction_limits_cache and self._transaction_limits_cache_ts:
            if (now - self._transaction_limits_cache_ts).total_seconds() < 60:
                return self._transaction_limits_cache

        raw = self.get_app_setting('transaction_limits')
        if not raw:
            self._transaction_limits_cache = {}
            self._transaction_limits_cache_ts = now
            return self._transaction_limits_cache

        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                self._transaction_limits_cache = parsed
            else:
                logging.error("Настройка transaction_limits должна быть JSON-объектом.")
                self._transaction_limits_cache = {}
        except json.JSONDecodeError as e:
            logging.error(f"Ошибка разбора transaction_limits: {e}")
            self._transaction_limits_cache = {}

        self._transaction_limits_cache_ts = now
        return self._transaction_limits_cache

    def _get_cache_entry(self, cache_key: str) -> Optional[dict]:
        memory_entry = self._analytics_cache_memory.get(cache_key)
        now = datetime.datetime.now(datetime.timezone.utc)
        if memory_entry:
            updated_at = memory_entry.get('updated_at')
            if isinstance(updated_at, datetime.datetime):
                if (now - updated_at).total_seconds() <= self.analytics_cache_ttl:
                    return memory_entry.get('payload')

        if not self.client:
            return None

        try:
            response = (
                self.client
                .from_('analytics_cache')
                .select('payload, updated_at')
                .eq('cache_key', cache_key)
                .limit(1)
                .execute()
            )
            if response.data:
                entry = response.data[0]
                updated_at = entry.get('updated_at')
                try:
                    updated_at_dt = parser.isoparse(updated_at) if isinstance(updated_at, str) else None
                except Exception:
                    updated_at_dt = None
                if updated_at_dt and (now - updated_at_dt).total_seconds() <= self.analytics_cache_ttl:
                    self._analytics_cache_memory[cache_key] = {
                        'payload': entry.get('payload'),
                        'updated_at': updated_at_dt
                    }
                    return entry.get('payload')
        except Exception as e:
            logging.error(f"Ошибка чтения analytics_cache [{cache_key}]: {e}")

        return None

    def _set_cache_entry(self, cache_key: str, payload: dict):
        updated_at = datetime.datetime.now(datetime.timezone.utc)
        self._analytics_cache_memory[cache_key] = {
            'payload': payload,
            'updated_at': updated_at
        }

        if not self.client:
            return

        try:
            self.client.from_('analytics_cache').upsert({
                'cache_key': cache_key,
                'payload': payload,
                'updated_at': updated_at.isoformat()
            }).execute()
        except Exception as e:
            logging.error(f"Ошибка записи analytics_cache [{cache_key}]: {e}")

    def _log_setting_change(self, setting_key: str, old_value: Any, new_value: Any, updated_by: str):
        if not self.client:
            return
        if old_value == new_value:
            return
        try:
            payload = {
                'setting_key': setting_key,
                'old_value': old_value,
                'new_value': new_value,
                'updated_by': updated_by,
                'updated_at': datetime.datetime.now().isoformat()
            }
            self.client.from_('settings_change_log').insert(payload).execute()
        except Exception as e:
            logging.error(f"Ошибка записи settings_change_log для {setting_key}: {e}")


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

    def get_client_details_for_partner(self, client_chat_id: int) -> Optional[dict]:
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
        cache_key = f"partner_stats:{partner_chat_id}"
        cached = self._get_cache_entry(cache_key)
        if cached:
            return cached

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

        self._set_cache_entry(cache_key, stats)
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
        cache_key = f"partner_stats:{partner_chat_id}:{period_days}"
        cached = self._get_cache_entry(cache_key)
        if cached:
            return cached

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
        
        self._set_cache_entry(cache_key, stats)
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
        if not self.client: 
            logging.error("Supabase client not initialized")
            return False
        try:
            # Преобразуем partner_id в строку для консистентности
            partner_id_str = str(partner_id)
            
            # Сначала проверяем, существует ли запись
            check_response = self.client.from_('partner_applications').select('id, chat_id, status').eq('chat_id', partner_id_str).execute()
            
            if not check_response.data or len(check_response.data) == 0:
                logging.error(f"Partner application with chat_id {partner_id_str} not found in database")
                return False
            
            logging.info(f"Found partner application: {check_response.data[0]}")
            
            # Обновляем статус в partner_applications
            response = self.client.from_('partner_applications').update({'status': new_status}).eq('chat_id', partner_id_str).execute()
            
            # Проверяем, что обновление прошло успешно
            if not response.data or len(response.data) == 0:
                logging.error(f"Update returned no data for partner_id {partner_id_str}. RLS policy may be blocking.")
                # Пробуем получить обновленную запись для проверки
                verify_response = self.client.from_('partner_applications').select('id, chat_id, status').eq('chat_id', partner_id_str).execute()
                if verify_response.data:
                    current_status = verify_response.data[0].get('status')
                    logging.info(f"Current status in DB: {current_status}")
                    if current_status == new_status:
                        logging.info(f"Status was actually updated to {new_status}")
                        # Если партнер одобрен — гарантируем наличие записи в таблице partners (для FK)
                        if new_status == 'Approved':
                            self.ensure_partner_record(partner_id_str)
                        return True
                return False
            
            logging.info(f"Successfully updated partner {partner_id_str} status to {new_status}. Response: {response.data[0]}")
            
            # Если партнер одобрен — гарантируем наличие записи в таблице partners (для FK)
            if new_status == 'Approved':
                self.ensure_partner_record(partner_id_str)
            
            return True
        except Exception as e:
            logging.error(f"Error updating partner status for {partner_id}: {e}", exc_info=True)
            return False

    def update_partner_data(self, partner_id: str, name: str = None, company_name: str = None, phone: str = None) -> bool:
        """Обновляет данные партнера (имя, название компании, телефон)."""
        if not self.client: return False
        try:
            update_data = {}
            if name is not None:
                update_data['name'] = name
            if company_name is not None:
                update_data['company_name'] = company_name
            if phone is not None:
                # Очищаем номер телефона от форматирования
                clean_phone = phone.replace('+', '').replace(' ', '').replace('-', '').strip()
                update_data['phone'] = clean_phone
            
            if update_data:
                self.client.from_('partner_applications').update(update_data).eq('chat_id', str(partner_id)).execute()
                return True
            return False
        except Exception as e:
            logging.error(f"Error updating partner data: {e}")
            return False

    def record_nps_rating(self, client_chat_id: str, partner_chat_id: str, rating: int, master_name: Optional[str] = None) -> bool:
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
                'company_name': app_data.get('company_name', ''),
                'business_type': app_data.get('business_type'),
                'city': app_data.get('city', ''),
                'district': app_data.get('district', '')
            }
            
            # upsert по chat_id — если строка есть, не меняем другие поля
            self.client.from_('partners').upsert(record, on_conflict='chat_id').execute()
            return True
        except Exception as e:
            logging.error(f"ensure_partner_record failed for {partner_chat_id}: {e}")
            return False

    def set_partner_business_type(self, partner_chat_id: str, business_type: str) -> bool:
        """Устанавливает категорию услуг партнёра (business_type) в tables partner_applications и partners."""
        if not self.client:
            return False
        try:
            partner_chat_id = str(partner_chat_id)
            # Обновляем в заявке
            self.client.from_('partner_applications').update({'business_type': business_type}).eq('chat_id', partner_chat_id).execute()
            # Обновляем/создаём запись партнёра
            self.ensure_partner_record(partner_chat_id)
            self.client.from_('partners').update({'business_type': business_type}).eq('chat_id', partner_chat_id).execute()
            return True
        except Exception as e:
            logging.error(f"Error setting partner business_type for {partner_chat_id}: {e}")
            return False

    def set_partner_location(self, partner_chat_id: str, city: str, district: str) -> bool:
        """Обновляет город и район партнёра в partner_applications и partners."""
        if not self.client:
            return False
        try:
            partner_chat_id = str(partner_chat_id)
            update = {'city': city, 'district': district}
            self.client.from_('partner_applications').update(update).eq('chat_id', partner_chat_id).execute()
            self.ensure_partner_record(partner_chat_id)
            self.client.from_('partners').update(update).eq('chat_id', partner_chat_id).execute()
            return True
        except Exception as e:
            logging.error(f"Error setting partner location for {partner_chat_id}: {e}")
            return False

    def get_partner_services(self, partner_chat_id: str, category: Optional[str] = None) -> list[dict]:
        """Возвращает услуги партнёра, опционально фильтруя по category."""
        if not self.client:
            return []
        try:
            query = self.client.from_('services').select('*').eq('partner_chat_id', str(partner_chat_id))
            if category:
                query = query.eq('category', category)
            resp = query.order('created_at', desc=True).execute()
            return resp.data or []
        except Exception as e:
            logging.error(f"Error fetching partner services for {partner_chat_id}: {e}")
            return []

    def delete_service(self, service_id: str, partner_chat_id: str) -> bool:
        """Удаляет услугу по ID, проверяя принадлежность партнёру."""
        if not self.client:
            return False
        try:
            # Проверка принадлежности
            check = self.client.from_('services').select('id').eq('id', service_id).eq('partner_chat_id', str(partner_chat_id)).limit(1).execute()
            if not check.data:
                return False
            self.client.from_('services').delete().eq('id', service_id).execute()
            return True
        except Exception as e:
            logging.error(f"Error deleting service {service_id} for partner {partner_chat_id}: {e}")
            return False

    def update_service_category(self, service_id: str, partner_chat_id: str, category: str) -> bool:
        """Обновляет категорию услуги."""
        if not self.client:
            return False
        try:
            # Проверка принадлежности
            check = self.client.from_('services').select('id').eq('id', service_id).eq('partner_chat_id', str(partner_chat_id)).limit(1).execute()
            if not check.data:
                return False
            self.client.from_('services').update({'category': category}).eq('id', service_id).execute()
            return True
        except Exception as e:
            logging.error(f"Error updating service category for {service_id}: {e}")
            return False

    def get_service_categories_list(self) -> list[str]:
        """Возвращает список кодов категорий услуг (соответствует frontend)."""
        return [
            'nail_care', 'brow_design', 'hair_salon', 'hair_removal',
            'facial_aesthetics', 'lash_services', 'massage_therapy', 'makeup_pmu',
            'body_wellness', 'nutrition_coaching', 'mindfulness_coaching', 'image_consulting'
        ]

    def get_distinct_cities(self) -> list[str]:
        """Возвращает список уникальных городов из таблицы partners."""
        if not self.client:
            return []
        try:
            resp = self.client.from_('partners').select('city').neq('city', '').execute()
            cities = sorted({row.get('city') for row in (resp.data or []) if row.get('city')})
            return cities
        except Exception as e:
            logging.error(f"Error fetching distinct cities: {e}")
            return []

    def get_distinct_districts_for_city(self, city: str) -> list[str]:
        """Возвращает список уникальных районов по городу из таблицы partners."""
        if not self.client:
            return []
        try:
            resp = self.client.from_('partners').select('district').eq('city', city).execute()
            districts = sorted({row.get('district') for row in (resp.data or []) if row.get('district')})
            return districts
        except Exception as e:
            logging.error(f"Error fetching distinct districts for {city}: {e}")
            return []

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
        if 'approval_status' not in service_data:
            service_data['approval_status'] = 'Pending'
        
        # Устанавливаем is_active по умолчанию
        if 'is_active' not in service_data:
            service_data['is_active'] = True
        
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
        
        # Логируем данные перед вставкой
        logging.info(f"Attempting to add service with data: {service_data}")
        
        try:
            response = self.client.from_('services').insert(service_data).execute()
            logging.info(f"Service '{service_data.get('title')}' added successfully for partner {partner_chat_id}")
            return True
        except Exception as e:
            import traceback
            logging.error(f"Error adding service: {e}")
            logging.error(f"Service data: {service_data}")
            logging.error(f"Traceback: {traceback.format_exc()}")
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

    def update_service_approval_status(self, service_id: str, new_status: str) -> bool:
        """Обновляет статус одобрения услуги. service_id может быть UUID (строка) или числом."""
        if not self.client: return False
        try:
            response = self.client.from_('services').update({'approval_status': new_status}).eq('id', service_id).execute()
            if response.data and len(response.data) > 0:
                logging.info(f"Service {service_id} approval status updated to {new_status}")
                return True
            else:
                logging.warning(f"Service {service_id} not found or no rows updated")
                return False
        except Exception as e:
            logging.error(f"Error updating service status {service_id}: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return False

    def update_service(self, service_id: int, partner_chat_id: str, title: str = None, description: str = None, price_points: int = None) -> bool:
        """Обновляет данные услуги (название, описание, стоимость)."""
        if not self.client: return False
        try:
            update_data = {}
            if title is not None:
                update_data['title'] = title
            if description is not None:
                update_data['description'] = description
            if price_points is not None:
                update_data['price_points'] = price_points
            
            if update_data:
                # Проверяем, что услуга принадлежит партнеру
                response = self.client.from_('services').select('id').eq('id', service_id).eq('partner_chat_id', str(partner_chat_id)).execute()
                if not response.data:
                    logging.error(f"Service {service_id} not found or doesn't belong to partner {partner_chat_id}")
                    return False
                
                self.client.from_('services').update(update_data).eq('id', service_id).execute()
                logging.info(f"Service {service_id} updated successfully")
                return True
            return False
        except Exception as e:
            logging.error(f"Error updating service: {e}")
            return False

    def get_service_by_id(self, service_id: int, partner_chat_id: str) -> Optional[dict]:
        """Получает услугу по ID с проверкой принадлежности партнеру."""
        if not self.client: return None
        try:
            response = self.client.from_('services').select('*').eq('id', service_id).eq('partner_chat_id', str(partner_chat_id)).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logging.error(f"Error getting service by id: {e}")
            return None

    # -----------------------------------------------------------------
    # VI. МЕТОДЫ ДЛЯ РАБОТЫ С НОВОСТЯМИ
    # -----------------------------------------------------------------

    def create_news(self, news_data: dict) -> tuple[bool, Optional[int]]:
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
            tuple[bool, Optional[int]]: (успех операции, ID созданной новости)
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

    def get_news_by_id(self, news_id: int) -> Optional[dict]:
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

    # -----------------------------------------------------------------
    # PARTNER ANALYTICS METHODS
    # -----------------------------------------------------------------
    
    def get_advanced_partner_stats(self, partner_chat_id: str, period_days: int = 30) -> dict:
        """
        Получает расширенную статистику партнера за указанный период.
        
        Args:
            partner_chat_id: Chat ID партнера
            period_days: Количество дней для анализа
        
        Returns:
            Словарь с детальной статистикой
        """
        if not self.client:
            logging.error("Supabase client not initialized")
            return None
        
        try:
            # Определяем период
            now = datetime.datetime.now(datetime.timezone.utc)
            period_start = now - datetime.timedelta(days=period_days)
            
            # 1. Получаем всех клиентов партнера
            all_clients_response = self.client.from_('clients').select('chat_id, reg_date').eq('referrer_chat_id', partner_chat_id).execute()
            all_clients = all_clients_response.data if all_clients_response.data else []
            
            total_clients = len(all_clients)
            new_clients = sum(1 for c in all_clients if c.get('reg_date') and parser.parse(c['reg_date']) >= period_start)
            
            # 2. Получаем транзакции за период
            transactions_response = self.client.from_('transactions').select('*').eq('partner_chat_id', partner_chat_id).gte('date_time', period_start.isoformat()).execute()
            transactions = transactions_response.data if transactions_response.data else []
            
            # 3. Анализируем транзакции
            total_transactions = len(transactions)
            accrual_transactions = [t for t in transactions if t.get('operation_type') == 'accrual']
            redemption_transactions = [t for t in transactions if t.get('operation_type') == 'spend']
            
            total_revenue = sum(float(t.get('total_amount', 0)) for t in accrual_transactions)
            avg_check = total_revenue / len(accrual_transactions) if accrual_transactions else 0
            
            total_points_accrued = sum(int(t.get('points_change', 0)) for t in accrual_transactions)
            total_points_redeemed = sum(abs(int(t.get('points_change', 0))) for t in redemption_transactions)
            
            # 4. Уникальные активные клиенты
            active_client_ids = set(t.get('client_chat_id') for t in transactions if t.get('client_chat_id'))
            active_clients = len(active_client_ids)
            
            # 5. Повторные покупки
            client_txn_count = {}
            for t in accrual_transactions:
                client_id = t.get('client_chat_id')
                if client_id:
                    client_txn_count[client_id] = client_txn_count.get(client_id, 0) + 1
            
            returning_clients = sum(1 for count in client_txn_count.values() if count > 1)
            retention_rate = (returning_clients / active_clients * 100) if active_clients > 0 else 0
            
            # 6. LTV расчет
            avg_ltv = total_revenue / total_clients if total_clients > 0 else 0
            
            # 7. NPS (если есть данные)
            nps_response = self.client.from_('nps_ratings').select('rating').eq('partner_chat_id', partner_chat_id).gte('created_at', period_start.isoformat()).execute()
            nps_ratings = nps_response.data if nps_response.data else []
            
            promoters = sum(1 for r in nps_ratings if r.get('rating', 0) >= 9)
            detractors = sum(1 for r in nps_ratings if r.get('rating', 0) <= 6)
            total_nps = len(nps_ratings)
            
            nps_score = ((promoters - detractors) / total_nps * 100) if total_nps > 0 else 0
            avg_nps = sum(r.get('rating', 0) for r in nps_ratings) / total_nps if total_nps > 0 else 0
            
            # 8. Топ клиенты по выручке
            client_revenue = {}
            for t in accrual_transactions:
                client_id = t.get('client_chat_id')
                if client_id:
                    client_revenue[client_id] = client_revenue.get(client_id, 0) + float(t.get('total_amount', 0))
            
            top_clients = sorted(client_revenue.items(), key=lambda x: x[1], reverse=True)[:5]
            
            # Формируем результат
            stats = {
                'period_days': period_days,
                'total_clients': total_clients,
                'new_clients': new_clients,
                'active_clients': active_clients,
                'returning_clients': returning_clients,
                'retention_rate': round(retention_rate, 2),
                'total_revenue': round(total_revenue, 2),
                'avg_check': round(avg_check, 2),
                'avg_ltv': round(avg_ltv, 2),
                'total_transactions': total_transactions,
                'accrual_transactions': len(accrual_transactions),
                'redemption_transactions': len(redemption_transactions),
                'total_points_accrued': total_points_accrued,
                'total_points_redeemed': total_points_redeemed,
                'nps_score': round(nps_score, 1),
                'avg_nps': round(avg_nps, 2),
                'total_nps_responses': total_nps,
                'top_clients': [{'client_id': cid, 'revenue': round(rev, 2)} for cid, rev in top_clients]
            }
            
            logging.info(f"Advanced stats generated for partner {partner_chat_id} ({period_days} days)")
            return stats
            
        except Exception as e:
            logging.error(f"Error getting advanced partner stats for {partner_chat_id}: {e}")
            return None
    
    def export_partner_data_to_csv(self, partner_chat_id: str, period_days: int = 90) -> tuple:
        """
        Экспортирует данные партнера в CSV файл.
        
        Args:
            partner_chat_id: Chat ID партнера
            period_days: Количество дней для экспорта
        
        Returns:
            Tuple[bool, str]: (success, filepath_or_error_message)
        """
        if not self.client:
            logging.error("Supabase client not initialized")
            return False, "Database not available"
        
        try:
            import csv
            import tempfile
            
            # Определяем период
            now = datetime.datetime.now(datetime.timezone.utc)
            period_start = now - datetime.timedelta(days=period_days)
            
            # Получаем транзакции
            transactions_response = self.client.from_('transactions').select('*').eq('partner_chat_id', partner_chat_id).gte('date_time', period_start.isoformat()).order('date_time', desc=True).execute()
            transactions = transactions_response.data if transactions_response.data else []
            
            if not transactions:
                return False, "Нет данных за указанный период"
            
            # Создаем временный CSV файл
            temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv', encoding='utf-8-sig', newline='')
            
            # Заголовки
            fieldnames = [
                'Дата и время',
                'Тип операции',
                'Клиент ID',
                'Сумма чека (₽)',
                'Изменение баллов',
                'Баланс после',
                'Описание'
            ]
            
            writer = csv.DictWriter(temp_file, fieldnames=fieldnames)
            writer.writeheader()
            
            # Записываем данные
            for txn in transactions:
                writer.writerow({
                    'Дата и время': txn.get('date_time', ''),
                    'Тип операции': 'Начисление' if txn.get('operation_type') == 'accrual' else 'Списание',
                    'Клиент ID': txn.get('client_chat_id', ''),
                    'Сумма чека (₽)': txn.get('total_amount', 0),
                    'Изменение баллов': txn.get('points_change', 0),
                    'Баланс после': txn.get('balance_after', 0),
                    'Описание': txn.get('description', '')
                })
            
            temp_file.close()
            
            logging.info(f"CSV export created for partner {partner_chat_id}: {len(transactions)} transactions")
            return True, temp_file.name
            
        except Exception as e:
            logging.error(f"Error exporting partner data to CSV for {partner_chat_id}: {e}")
            return False, str(e)
    
    def get_partner_cohort_analysis(self, partner_chat_id: str) -> dict:
        """
        Проводит когортный анализ клиентов партнера.
        Группирует клиентов по месяцам регистрации и анализирует их поведение.
        
        Args:
            partner_chat_id: Chat ID партнера
        
        Returns:
            Словарь с когортными данными
        """
        if not self.client:
            logging.error("Supabase client not initialized")
            return {'cohorts': []}
        
        try:
            # Получаем всех клиентов партнера
            clients_response = self.client.from_('clients').select('chat_id, reg_date').eq('referrer_chat_id', partner_chat_id).execute()
            clients = clients_response.data if clients_response.data else []
            
            if not clients:
                return {'cohorts': []}
            
            # Группируем клиентов по месяцам регистрации
            cohort_groups = {}
            
            for client in clients:
                if not client.get('reg_date'):
                    continue
                
                reg_date = parser.parse(client['reg_date'])
                cohort_month = f"{reg_date.year}-{str(reg_date.month).zfill(2)}"
                
                if cohort_month not in cohort_groups:
                    cohort_groups[cohort_month] = []
                
                cohort_groups[cohort_month].append(client['chat_id'])
            
            # Анализируем каждую когорту
            cohorts = []
            
            for cohort_month, client_ids in sorted(cohort_groups.items()):
                # Получаем транзакции для клиентов этой когорты
                transactions_response = self.client.from_('transactions').select('*').eq('partner_chat_id', partner_chat_id).in_('client_chat_id', client_ids).execute()
                transactions = transactions_response.data if transactions_response.data else []
                
                accrual_transactions = [t for t in transactions if t.get('operation_type') == 'accrual']
                
                total_revenue = sum(float(t.get('total_amount', 0)) for t in accrual_transactions)
                total_transactions = len(accrual_transactions)
                
                cohorts.append({
                    'month': cohort_month,
                    'clients_count': len(client_ids),
                    'total_revenue': round(total_revenue, 2),
                    'total_transactions': total_transactions,
                    'avg_revenue_per_client': round(total_revenue / len(client_ids), 2) if client_ids else 0,
                    'avg_transactions_per_client': round(total_transactions / len(client_ids), 2) if client_ids else 0
                })
            
            logging.info(f"Cohort analysis completed for partner {partner_chat_id}: {len(cohorts)} cohorts")
            return {'cohorts': cohorts}
            
        except Exception as e:
            logging.error(f"Error in cohort analysis for {partner_chat_id}: {e}")
            return {'cohorts': []}

    # ============================================
    # НАСТРОЙКИ ПРИЛОЖЕНИЯ
    # ============================================

    def get_app_setting(self, setting_key: str, default_value: str = None) -> Optional[str]:
        """Получить значение настройки приложения."""
        if not self.client:
            return default_value
        try:
            response = self.client.from_('app_settings').select('setting_value').eq('setting_key', setting_key).limit(1).execute()
            if response.data and len(response.data) > 0:
                return response.data[0]['setting_value']
            return default_value
        except Exception as e:
            logging.error(f"Error getting app setting {setting_key}: {e}")
            return default_value

    def set_app_setting(self, setting_key: str, setting_value: str, updated_by: str = 'admin') -> bool:
        """Установить значение настройки приложения."""
        if not self.client:
            return False
        success = False
        try:
            old_value = self.get_app_setting(setting_key)

            # Проверяем, существует ли настройка (используем setting_key вместо id)
            existing = self.client.from_('app_settings').select('setting_key').eq('setting_key', setting_key).limit(1).execute()
            
            if existing.data and len(existing.data) > 0:
                # Обновляем существующую настройку
                response = self.client.from_('app_settings').update({
                    'setting_value': setting_value,
                    'updated_at': 'now()',
                    'updated_by': updated_by
                }).eq('setting_key', setting_key).execute()
            else:
                # Создаем новую настройку
                response = self.client.from_('app_settings').insert({
                    'setting_key': setting_key,
                    'setting_value': setting_value,
                    'updated_by': updated_by
                }).execute()
            
            logging.info(f"App setting {setting_key} updated to {setting_value}")
            success = True
            return True
        except Exception as e:
            logging.error(f"Error setting app setting {setting_key}: {e}")
            return False
        finally:
            if success:
                try:
                    self._log_setting_change(setting_key, old_value, setting_value, updated_by)
                except Exception as e:
                    logging.error(f"Error logging setting change for {setting_key}: {e}")

    def get_background_image(self) -> str:
        """Получить путь к фоновому изображению."""
        return self.get_app_setting('background_image', '/bg/sakura.jpg')
