import os
import json
import math
import datetime
from typing import Any, Optional, Union, Dict, List
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError
from transaction_queue import TransactionQueue
import pandas as pd
import logging 
from dateutil import parser # Добавлена библиотека для безопасного парсинга дат
from transaction_queue import TransactionQueue
import sentry_sdk

# Импорт нового калькулятора комиссий
try:
    from referral_calculator import (
        ReferralCalculator, PurchaseInput, PartnerData, B2BDeal, 
        User as CalcUser, CommissionDistribution
    )
    REFERRAL_CALCULATOR_AVAILABLE = True
except ImportError as e:
    logging.warning(f"ReferralCalculator not available: {e}. Will use fallback logic.")
    REFERRAL_CALCULATOR_AVAILABLE = False

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
COMMISSION_BALANCE_COLUMN = 'commission_balance'
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
        
        # ✅ Welcome Bonus теперь в USD эквиваленте (1 балл = $1 USD)
        # По умолчанию: $5 USD (5 баллов)
        bonus_from_env = os.getenv("WELCOME_BONUS_AMOUNT", "5") 
        try:
            self._WELCOME_BONUS = float(bonus_from_env)  # ✅ Теперь float для поддержки десятичных
        except ValueError:
            self._WELCOME_BONUS = 5.0  # ✅ $5 USD по умолчанию
            logging.error(f"Не удалось преобразовать WELCOME_BONUS_AMOUNT '{bonus_from_env}' в число. Установлено значение 5.0 (≈$5 USD).")

        # Конфигурация реферальной системы (гибридная модель)
        self.REFERRAL_CONFIG = {
            'levels': 3,
            'registration_bonus': {
                'level_1': 100,  # баллов за прямого реферала
                'level_2': 25,   # баллов за внучатого
                'level_3': 10    # баллов за правнучатого
            },
            'transaction_percent': {
                'level_1': 0.08,  # 8% от начисленных баллов
                'level_2': 0.04,  # 4% от начисленных баллов
                'level_3': 0.02   # 2% от начисленных баллов
            },
            'achievements': {
                '5_referrals': 200,
                '10_referrals': 500,
                '25_referrals': 1500,
                '50_referrals': 3000
            }
        }

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
            
        # ✅ Welcome bonus теперь всегда в USD эквиваленте
        if welcome_bonus is None: 
            welcome_bonus = self._WELCOME_BONUS  # По умолчанию $5 USD (5 баллов)
        
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
                    # ✅ Welcome bonus в USD эквиваленте, currency = USD
                    welcome_currency = 'USD'  # Welcome bonus всегда в USD
                    self.record_transaction(client_chat_id_for_txn, partner_id, float(welcome_bonus), 'enrollment_bonus', description, raw_amount=0.00, currency=welcome_currency)
                    
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
                    'currency': 'USD',  # ✅ Welcome bonus всегда в USD
                    'earned_points': float(welcome_bonus), 'spent_points': 0, 'operation_type': 'enrollment_bonus', 
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
        # ✅ Welcome bonus теперь всегда в USD эквиваленте
        if welcome_bonus is None: 
            welcome_bonus = self._WELCOME_BONUS  # По умолчанию $5 USD (5 баллов) 
        
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
                'currency': 'USD',  # ✅ Welcome bonus всегда в USD
                'earned_points': float(welcome_bonus), 'spent_points': 0, 'operation_type': 'enrollment_bonus', 
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
    
    def get_client_balance(self, chat_id: int) -> float:
        """
        Возвращает текущий баланс клиента в USD эквиваленте.
        
        ✅ Баланс теперь в USD эквиваленте (float)
        """
        if not self.client: return 0.0
        try:
            response = self.client.from_(USER_TABLE).select(BALANCE_COLUMN).eq('chat_id', str(chat_id)).limit(1).execute()
            if response.data:
                balance = response.data[0].get(BALANCE_COLUMN, 0)
                # Преобразуем в float (на случай если в БД integer)
                return float(balance) if balance else 0.0
            return 0.0
        except Exception:
            return 0.0

    def record_transaction(self, client_chat_id: int, partner_chat_id: int, points: float, transaction_type: str, description: str, raw_amount: float = 0.00, currency: str = None) -> bool:
        """
        Записывает транзакцию в таблицу 'transactions'.
        
        ✅ points теперь в USD эквиваленте (float)
        ✅ currency может быть передан явно или определяется автоматически
        """
        if not self.client: return False
        
        # ✅ points теперь float (USD эквивалент), но для совместимости с БД можем округлить
        earned = points if transaction_type in ['accrual', 'enrollment_bonus'] else 0.0
        spent = points if transaction_type == 'redemption' else 0.0
        amount_for_db = int(raw_amount) if raw_amount == 0.00 else raw_amount 
        
        # ✅ Получаем валюту (переданную или определяем автоматически)
        if currency is None:
            currency = 'USD'  # По умолчанию USD
            try:
                from currency_utils import get_currency_by_city
                # Получаем город партнера из БД (если partner_chat_id указан)
                if partner_chat_id:
                    partner_response = self.client.table('partners').select('city').eq('chat_id', str(partner_chat_id)).limit(1).execute()
                    if partner_response.data and len(partner_response.data) > 0:
                        partner_city = partner_response.data[0].get('city')
                        if partner_city:
                            currency = get_currency_by_city(partner_city)
            except Exception as e:
                logging.warning(f"Не удалось определить валюту для партнера {partner_chat_id}: {e}. Используется USD по умолчанию.")

        try:
            data = {
                "client_chat_id": str(client_chat_id), 
                "partner_chat_id": str(partner_chat_id) if partner_chat_id else None, 
                "date_time": datetime.datetime.now().isoformat(), 
                "total_amount": amount_for_db,
                "currency": currency,  # ✅ Валюта транзакции (для аудита)
                "earned_points": earned,  # ✅ В USD эквиваленте (float)
                "spent_points": spent,    # ✅ В USD эквиваленте (float)
                "operation_type": transaction_type, 
                "description": description,
            }
            self.client.from_(TRANSACTION_TABLE).insert(data).execute()
            # Churn Prevention: обновляем last_visit при реальном визите (accrual/redemption)
            if transaction_type in ('accrual', 'redemption'):
                try:
                    self.client.from_(USER_TABLE).update({'last_visit': data['date_time']}).eq('chat_id', str(client_chat_id)).execute()
                except Exception as e_visit:
                    logging.warning(f"Error updating last_visit for client {client_chat_id}: {e_visit}")
            return True
        except Exception as e:
            logging.error(f"Error recording transaction: {e}")
            return False

    def compute_client_visit_stats(self, partner_chat_id: Optional[str] = None, min_visits: int = 2) -> int:
        """
        Churn Prevention, шаг 2: считает средний интервал в днях между визитами (accrual/redemption)
        по парам (client, partner) и записывает в client_visit_stats.
        :param partner_chat_id: если задан — только этот партнёр; иначе все партнёры
        :param min_visits: минимум визитов для расчёта интервала (нужно >= 2)
        :return: число обновлённых пар (client, partner)
        """
        if not self.client:
            return 0
        try:
            query = (
                self.client.from_(TRANSACTION_TABLE)
                .select("client_chat_id, partner_chat_id, date_time")
                .in_("operation_type", ["accrual", "redemption"])
            )
            if partner_chat_id:
                query = query.eq("partner_chat_id", str(partner_chat_id))
            response = query.order("date_time", desc=False).execute()
            rows = response.data or []
            # Группируем по (client_chat_id, partner_chat_id), пропускаем без partner
            groups: Dict[tuple, List[str]] = {}
            for r in rows:
                pid = r.get("partner_chat_id")
                if not pid:
                    continue
                key = (str(r["client_chat_id"]), str(pid))
                if key not in groups:
                    groups[key] = []
                dt = r.get("date_time")
                if dt:
                    groups[key].append(dt)
            # Сортируем даты в каждой группе, считаем интервалы
            to_upsert = []
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            for (cid, pid), dates in groups.items():
                if len(dates) < min_visits:
                    continue
                try:
                    parsed = sorted([parser.parse(d) for d in dates])
                except Exception:
                    continue
                deltas = []
                for i in range(len(parsed) - 1):
                    delta = (parsed[i + 1] - parsed[i]).total_seconds() / 86400.0
                    if delta >= 0:
                        deltas.append(delta)
                if not deltas:
                    continue
                avg_days = round(sum(deltas) / len(deltas), 2)
                last_dt = parsed[-1]
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=datetime.timezone.utc)
                last_visit_at = last_dt.isoformat()
                to_upsert.append({
                    "client_chat_id": cid,
                    "partner_chat_id": pid,
                    "visit_count": len(parsed),
                    "avg_interval_days": avg_days,
                    "last_visit_at": last_visit_at,
                    "last_computed_at": now_iso,
                })
            if not to_upsert:
                return 0
            self.client.from_("client_visit_stats").upsert(to_upsert, on_conflict="client_chat_id,partner_chat_id").execute()
            return len(to_upsert)
        except Exception as e:
            logging.error(f"Error computing client_visit_stats: {e}")
            return 0

    def get_churn_candidates(
        self,
        partner_chat_id: Optional[str] = None,
        min_days_threshold: int = 7,
        coefficient_k: float = 2.0,
        reactivation_cooldown_days: int = 14,
        use_partner_settings: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Churn Prevention, шаг 3+5: возвращает список кандидатов на реактивацию.
        Критерий: (now - last_visit_at) > max(min_days, avg_interval_days * coefficient).
        Исключаются: пары с недавней реактивацией, партнёры с отключённой реактивацией.
        Если use_partner_settings=True — использует настройки каждого партнёра вместо глобальных параметров.
        """
        if not self.client:
            return []
        try:
            query = self.client.from_("client_visit_stats").select("client_chat_id, partner_chat_id, last_visit_at, avg_interval_days")
            if partner_chat_id:
                query = query.eq("partner_chat_id", str(partner_chat_id))
            response = query.execute()
            rows = response.data or []
            now = datetime.datetime.now(datetime.timezone.utc)
            # Загружаем настройки партнёров
            partner_settings_map: Dict[str, Dict[str, Any]] = {}
            if use_partner_settings:
                partner_ids = list(set(str(r["partner_chat_id"]) for r in rows if r.get("partner_chat_id")))
                if partner_ids:
                    settings_resp = self.client.from_("partners").select(
                        "chat_id, reactivation_enabled, reactivation_min_days, reactivation_coefficient, reactivation_cooldown_days"
                    ).in_("chat_id", partner_ids).execute()
                    for p in (settings_resp.data or []):
                        partner_settings_map[str(p["chat_id"])] = {
                            "enabled": p.get("reactivation_enabled") if p.get("reactivation_enabled") is not None else True,
                            "min_days": p.get("reactivation_min_days") if p.get("reactivation_min_days") is not None else min_days_threshold,
                            "coefficient": float(p.get("reactivation_coefficient")) if p.get("reactivation_coefficient") is not None else coefficient_k,
                            "cooldown_days": p.get("reactivation_cooldown_days") if p.get("reactivation_cooldown_days") is not None else reactivation_cooldown_days,
                        }
            # Собираем cooldown по каждому партнёру (может быть разный cooldown)
            # Для простоты берём максимальный cooldown и фильтруем по нему, потом уточняем
            max_cooldown = reactivation_cooldown_days
            if partner_settings_map:
                max_cooldown = max(s["cooldown_days"] for s in partner_settings_map.values())
            cooldown_start = now - datetime.timedelta(days=max_cooldown)
            cooldown_start_iso = cooldown_start.isoformat()
            recent = self.client.from_("reactivation_events").select("client_chat_id, partner_chat_id, sent_at").eq("status", "sent").gte("sent_at", cooldown_start_iso).execute()
            # Для каждой пары сохраняем дату последней отправки
            last_sent: Dict[tuple, datetime.datetime] = {}
            for r in (recent.data or []):
                key = (str(r["client_chat_id"]), str(r["partner_chat_id"]))
                try:
                    sent_dt = parser.parse(r["sent_at"])
                    if sent_dt.tzinfo is None:
                        sent_dt = sent_dt.replace(tzinfo=datetime.timezone.utc)
                    if key not in last_sent or sent_dt > last_sent[key]:
                        last_sent[key] = sent_dt
                except Exception:
                    pass
            candidates = []
            for r in rows:
                cid = str(r["client_chat_id"])
                pid = str(r["partner_chat_id"])
                # Настройки партнёра
                ps = partner_settings_map.get(pid, {
                    "enabled": True,
                    "min_days": min_days_threshold,
                    "coefficient": coefficient_k,
                    "cooldown_days": reactivation_cooldown_days,
                })
                if not ps["enabled"]:
                    continue
                # Проверка cooldown для этой пары
                key = (cid, pid)
                if key in last_sent:
                    cooldown_end = last_sent[key] + datetime.timedelta(days=ps["cooldown_days"])
                    if now < cooldown_end:
                        continue
                last_at = r.get("last_visit_at")
                if not last_at:
                    continue
                try:
                    last_dt = parser.parse(last_at)
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=datetime.timezone.utc)
                except Exception:
                    continue
                avg_days = float(r.get("avg_interval_days") or 0)
                if avg_days <= 0:
                    continue
                days_since = (now - last_dt).days
                threshold = max(ps["min_days"], int(math.ceil(avg_days * ps["coefficient"])))
                if days_since < threshold:
                    continue
                candidates.append({
                    "client_chat_id": cid,
                    "partner_chat_id": pid,
                    "trigger_reason": "churn",
                    "days_since_last": days_since,
                    "avg_interval_days": avg_days,
                })
            return candidates
        except Exception as e:
            logging.error(f"Error get_churn_candidates: {e}")
            return []

    def get_reactivation_offer_data(self, client_chat_id: str, partner_chat_id: str) -> Dict[str, Any]:
        """
        Churn Prevention, шаг 4: собирает данные для персонализированного оффера.
        Возвращает: client_name, partner_name, partner_contact_link, partner_booking_url, offer_text.
        """
        result = {
            "client_name": "дорогой клиент",
            "partner_name": "партнёр",
            "partner_contact_link": "",
            "partner_booking_url": "",
            "offer_text": "специальное предложение",
        }
        if not self.client:
            return result
        try:
            # Клиент
            client_resp = self.client.from_(USER_TABLE).select("name").eq("chat_id", str(client_chat_id)).limit(1).execute()
            if client_resp.data:
                result["client_name"] = client_resp.data[0].get("name") or result["client_name"]
            # Партнёр
            partner_resp = self.client.from_("partners").select("name, company_name, username, contact_link, booking_url, reactivation_message_template").eq("chat_id", str(partner_chat_id)).limit(1).execute()
            if partner_resp.data:
                p = partner_resp.data[0]
                result["partner_name"] = p.get("company_name") or p.get("name") or result["partner_name"]
                if p.get("reactivation_message_template"):
                    result["message_template"] = p["reactivation_message_template"]
                username = p.get("username")
                contact_link = p.get("contact_link")
                booking_url = p.get("booking_url")
                if booking_url:
                    result["partner_booking_url"] = booking_url
                    result["partner_contact_link"] = booking_url
                elif contact_link:
                    result["partner_contact_link"] = contact_link
                elif username:
                    result["partner_contact_link"] = f"https://t.me/{username.lstrip('@')}"
            # Активные акции
            today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
            promo_resp = self.client.from_("promotions").select("title, description").eq("partner_chat_id", str(partner_chat_id)).eq("is_active", True).gte("end_date", today).limit(1).execute()
            if promo_resp.data:
                promo = promo_resp.data[0]
                result["offer_text"] = promo.get("title") or promo.get("description") or result["offer_text"]
            else:
                # Если нет акций — берём первую услугу
                svc_resp = self.client.from_("services").select("title").eq("partner_chat_id", str(partner_chat_id)).eq("is_active", True).limit(1).execute()
                if svc_resp.data:
                    result["offer_text"] = svc_resp.data[0].get("title") or result["offer_text"]
        except Exception as e:
            logging.error(f"Error get_reactivation_offer_data: {e}")
        return result

    def log_reactivation_event(
        self,
        client_chat_id: str,
        partner_chat_id: str,
        status: str,
        trigger_reason: str,
        message_text: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> bool:
        """Записывает событие реактивации в reactivation_events."""
        if not self.client:
            return False
        try:
            data = {
                "client_chat_id": str(client_chat_id),
                "partner_chat_id": str(partner_chat_id),
                "sent_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "status": status,
                "trigger_reason": trigger_reason,
                "message_text_snapshot": (message_text[:2000] if message_text else None),
                "error_message": error_message,
            }
            self.client.from_("reactivation_events").insert(data).execute()
            return True
        except Exception as e:
            logging.error(f"Error log_reactivation_event: {e}")
            return False

    def get_partner_reactivation_settings(self, partner_chat_id: str) -> Dict[str, Any]:
        """
        Churn Prevention, шаг 5: возвращает настройки реактивации партнёра.
        Если партнёр не найден или поля не заданы — возвращает дефолты.
        """
        defaults = {
            "enabled": True,
            "min_days": 7,
            "coefficient": 2.0,
            "cooldown_days": 14,
        }
        if not self.client:
            return defaults
        try:
            resp = self.client.from_("partners").select(
                "reactivation_enabled, reactivation_min_days, reactivation_coefficient, reactivation_cooldown_days"
            ).eq("chat_id", str(partner_chat_id)).limit(1).execute()
            if resp.data:
                p = resp.data[0]
                return {
                    "enabled": p.get("reactivation_enabled") if p.get("reactivation_enabled") is not None else defaults["enabled"],
                    "min_days": p.get("reactivation_min_days") if p.get("reactivation_min_days") is not None else defaults["min_days"],
                    "coefficient": float(p.get("reactivation_coefficient")) if p.get("reactivation_coefficient") is not None else defaults["coefficient"],
                    "cooldown_days": p.get("reactivation_cooldown_days") if p.get("reactivation_cooldown_days") is not None else defaults["cooldown_days"],
                }
        except Exception as e:
            logging.error(f"Error get_partner_reactivation_settings: {e}")
        return defaults

    def update_partner_reactivation_settings(
        self,
        partner_chat_id: str,
        enabled: Optional[bool] = None,
        min_days: Optional[int] = None,
        coefficient: Optional[float] = None,
        cooldown_days: Optional[int] = None,
    ) -> bool:
        """Обновляет настройки реактивации партнёра."""
        if not self.client:
            return False
        try:
            update_data = {}
            if enabled is not None:
                update_data["reactivation_enabled"] = enabled
            if min_days is not None:
                update_data["reactivation_min_days"] = min_days
            if coefficient is not None:
                update_data["reactivation_coefficient"] = coefficient
            if cooldown_days is not None:
                update_data["reactivation_cooldown_days"] = cooldown_days
            if not update_data:
                return True
            self.client.from_("partners").update(update_data).eq("chat_id", str(partner_chat_id)).execute()
            return True
        except Exception as e:
            logging.error(f"Error update_partner_reactivation_settings: {e}")
            return False

    def get_reactivation_stats(self, partner_chat_id: str, days: int = 30) -> Dict[str, int]:
        """
        Возвращает статистику реактиваций партнёра за последние N дней.
        """
        result = {"sent": 0, "failed": 0, "total": 0}
        if not self.client:
            return result
        try:
            cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)).isoformat()
            resp = self.client.from_("reactivation_events").select("status").eq("partner_chat_id", str(partner_chat_id)).gte("sent_at", cutoff).execute()
            for r in (resp.data or []):
                result["total"] += 1
                if r.get("status") == "sent":
                    result["sent"] += 1
                else:
                    result["failed"] += 1
        except Exception as e:
            logging.error(f"Error get_reactivation_stats: {e}")
        return result

    def execute_transaction(self, client_chat_id: int, partner_chat_id: int, txn_type: str, raw_amount: float, allow_queue: bool = True) -> dict:
        """Выполняет атомарное начисление или списание баллов."""
        if not self.client: return {"success": False, "error": "DB is not initialized.", "new_balance": 0}

        if allow_queue and self.transaction_queue:
            self.transaction_queue.process_pending()

        current_balance = self.get_client_balance(client_chat_id)  # Баланс в USD эквиваленте
        
        # ✅ Получаем валюту партнера
        currency = 'USD'  # По умолчанию
        try:
            from currency_utils import get_currency_by_city
            partner_response = self.client.table('partners').select('city').eq('chat_id', str(partner_chat_id)).limit(1).execute()
            if partner_response.data and len(partner_response.data) > 0:
                partner_city = partner_response.data[0].get('city')
                if partner_city:
                    currency = get_currency_by_city(partner_city)
        except Exception as e:
            logging.warning(f"Не удалось определить валюту для партнера {partner_chat_id}: {e}. Используется USD по умолчанию.")
        
        transaction_amount_points = 0.0  # В USD эквиваленте
        type_for_record = ''
        predicted_balance = current_balance
        discount_amount_local = 0.0  # Сумма скидки в валюте партнера (для отображения)

        if txn_type == 'accrual':
            # V2 Logic: Используем расчет с учетом сделок
            if hasattr(self, '_calculate_accrual_points_with_deals'):
                transaction_amount_points, deal_suffix = self._calculate_accrual_points_with_deals(client_chat_id, partner_chat_id, raw_amount, currency)
                description_suffix = deal_suffix
            else:
                transaction_amount_points = self._calculate_accrual_points(partner_chat_id, raw_amount, currency)
                description_suffix = ""
                
            new_balance = current_balance + transaction_amount_points
            predicted_balance = new_balance
            discount_amount_local = raw_amount  # Для отображения оригинальной суммы
            
            # ✅ Описание с указанием валюты и USD эквивалента
            try:
                from currency_utils import get_currency_symbol
                currency_symbol = get_currency_symbol(currency)
                description = f"Начисление {transaction_amount_points:.2f} баллов (≈${transaction_amount_points:.2f} USD) за чек {currency_symbol}{raw_amount:.2f}{description_suffix} (Партнер: {partner_chat_id})"
            except:
                description = f"Начисление {transaction_amount_points:.2f} баллов за чек {raw_amount}{description_suffix} (Партнер: {partner_chat_id})"
            type_for_record = 'accrual'
            
        elif txn_type == 'spend':
            # ✅ Списание: raw_amount - это баллы в USD эквиваленте
            transaction_amount_points = float(raw_amount)
            if transaction_amount_points > current_balance:
                return {"success": False, "error": "Недостаточно бонусов для списания.", "new_balance": current_balance}

            # ✅ Конвертируем баллы (USD) → валюта партнера для скидки
            try:
                from currency_utils import convert_currency, get_currency_symbol
                discount_amount_local = convert_currency(
                    transaction_amount_points,
                    from_currency='USD',
                    to_currency=currency,
                    supabase_client=self.client
                )
                currency_symbol = get_currency_symbol(currency)
                description = f"Списание {transaction_amount_points:.2f} баллов (скидка {currency_symbol}{discount_amount_local:.2f}) (Партнер: {partner_chat_id})"
            except Exception as e:
                logging.warning(f"Ошибка конвертации при списании: {e}. Использую transaction_amount_points.")
                discount_amount_local = transaction_amount_points
                description = f"Списание {transaction_amount_points:.2f} баллов (Партнер: {partner_chat_id})"

            new_balance = current_balance - transaction_amount_points
            predicted_balance = new_balance
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
            # ✅ Для списания raw_amount = discount_amount_local (сумма в валюте партнера)
            # ✅ Для начисления raw_amount = оригинальная сумма в валюте партнера
            # ✅ Для списания raw_amount = discount_amount_local (сумма в валюте партнера)
            # ✅ Для начисления raw_amount = оригинальная сумма в валюте партнера
            if txn_type == 'spend' and 'discount_amount_local' in locals() and discount_amount_local > 0:
                record_raw_amount = discount_amount_local
            else:
                record_raw_amount = raw_amount
            self.record_transaction(client_chat_id, partner_chat_id, transaction_amount_points, type_for_record, description, raw_amount=record_raw_amount, currency=currency)
            
            # Обрабатываем реферальные бонусы при начислении баллов
            if txn_type == 'accrual' and transaction_amount_points > 0:
                try:
                    # Получаем ID транзакции для связи
                    transaction_id = None
                    recent_txn = self.client.from_(TRANSACTION_TABLE).select('id').eq('client_chat_id', str(client_chat_id)).order('date_time', desc=True).limit(1).execute()
                    if recent_txn.data:
                        transaction_id = recent_txn.data[0].get('id')
                    
                    # Обрабатываем реферальные бонусы (новая логика с raw_amount и seller_partner_id)
                    self.process_referral_transaction_bonuses(
                        str(client_chat_id), 
                        transaction_amount_points, 
                        transaction_id,
                        raw_amount=raw_amount,
                        seller_partner_id=str(partner_chat_id)
                    )
                except Exception as e:
                    logging.error(f"Error processing referral transaction bonuses: {e}")
                    # Не прерываем основную транзакцию из-за ошибки реферальных бонусов
            
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

    def _calculate_accrual_points(self, partner_chat_id: int, raw_amount: float, currency: str = 'USD') -> float:
        """
        Рассчитывает количество баллов в USD эквиваленте с учётом гибких правил начисления.
        
        ✅ ВСЕ БАЛЛЫ ХРАНЯТСЯ КАК USD ЭКВИВАЛЕНТ (1 балл = $1 USD)
        
        Args:
            partner_chat_id: ID партнера
            raw_amount: Сумма в оригинальной валюте партнера
            currency: Валюта транзакции (VND, RUB, USD, etc.)
            
        Returns:
            float: Количество баллов в USD эквиваленте (например, 1.02 означает $1.02)
        """
        if raw_amount <= 0:
            return 0.0

        # ✅ ШАГ 1: Конвертируем сумму в USD
        amount_usd = raw_amount
        if currency != 'USD':
            try:
                from currency_utils import convert_currency
                amount_usd = convert_currency(
                    raw_amount,
                    from_currency=currency,
                    to_currency='USD',
                    supabase_client=self.client
                )
            except Exception as e:
                logging.warning(f"Ошибка конвертации {currency}→USD для суммы {raw_amount}: {e}. Использую raw_amount.")
                # Если конвертация не удалась, используем raw_amount (предполагаем USD)

        # ✅ ШАГ 2: Рассчитываем процент кэшбэка (все правила как раньше)
        percent = max(self.CASHBACK_PERCENT, 0.0)
        multiplier = 1.0
        min_points = 0.0
        rounding_mode = 'floor'

        rules = self._get_cashback_rules()
        if isinstance(rules, dict):
            percent = self._extract_float(rules.get('default_percent'), percent)
            multiplier *= self._extract_float(rules.get('global_multiplier'), 1.0)
            rounding_mode = rules.get('rounding', rounding_mode) or rounding_mode
            min_points = max(min_points, self._extract_float(rules.get('min_points'), 0))

            partner_rules = rules.get('partners', {}).get(str(partner_chat_id))
            if isinstance(partner_rules, dict):
                percent = self._extract_float(partner_rules.get('percent'), percent)
                min_points = max(min_points, self._extract_float(partner_rules.get('min_points', min_points)))
                partner_multiplier = self._extract_float(partner_rules.get('multiplier'), 1.0)
                if partner_multiplier > 0:
                    multiplier *= self._resolve_multiplier_with_expiry(partner_rules, partner_multiplier)

        percent = max(percent, 0.0)
        multiplier = max(multiplier, 0.0)

        # ✅ ШАГ 3: Баллы = USD сумма × процент × множитель
        raw_points_usd = amount_usd * percent * multiplier
        raw_points_usd = self._apply_bonus_rules(partner_chat_id, 'accrual', amount_usd, raw_points_usd)
        
        # ✅ ШАГ 4: Применяем округление (может быть 'floor', 'ceil', 'round')
        points_usd = self._apply_rounding_float(raw_points_usd, rounding_mode)
        points_usd = max(points_usd, min_points)
        return max(points_usd, 0.0)

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
        """Применяет стратегию округления к значению (возвращает int)."""
        mode = (mode or 'floor').lower()
        if mode == 'ceil':
            return int(math.ceil(value))
        if mode == 'round':
            return int(round(value))
        if mode == 'truncate':
            return int(math.trunc(value))
        return int(math.floor(value))
    
    def _apply_rounding_float(self, value: float, mode: str) -> float:
        """Применяет стратегию округления к значению (возвращает float с точностью до центов)."""
        mode = (mode or 'floor').lower()
        if mode == 'ceil':
            return math.ceil(value * 100) / 100  # Округление до центов вверх
        if mode == 'round':
            return round(value, 2)  # Округление до центов
        if mode == 'truncate':
            return math.trunc(value * 100) / 100  # Отсечение до центов
        return math.floor(value * 100) / 100  # Округление до центов вниз

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
            return {'ltv_usd': 0.0, 'total_transactions': 0, 'months_active': 0, 'freq_per_month': 0.0, 'reg_date': None}

        client_chat_id = str(client_chat_id)
        stats = {'ltv_usd': 0.0, 'total_transactions': 0, 'months_active': 0, 'freq_per_month': 0.0, 'reg_date': None}

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

            stats['ltv_usd'] = round(total_accrual_amount, 2)
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
                "ltv_usd": analytics['ltv_usd'], 
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
            'total_spent_usd': 0.0, 'avg_nps_rating': 0.0, 'promoters': 0, 'detractors': 0
        }

        try:
            referrals_response = self.client.from_(USER_TABLE).select('chat_id').eq(PARTNER_ID_COLUMN, partner_chat_id).execute()
            stats['total_referrals'] = len(referrals_response.data)

            txn_response = self.client.from_(TRANSACTION_TABLE).select('operation_type, total_amount, earned_points, spent_points').eq('partner_chat_id', partner_chat_id).execute()
            transactions = txn_response.data
            
            stats['total_transactions'] = len(transactions)
            
            for txn in transactions:
                if txn.get('operation_type') == 'accrual': 
                    stats['total_spent_usd'] += txn.get('total_amount', 0.0) 
                    
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
        # Не используем кеш для NPS метрик, чтобы данные всегда были актуальными
        # cache_key = f"partner_stats:{partner_chat_id}:{period_days}"
        # cached = self._get_cache_entry(cache_key)
        # if cached:
        #     return cached

        now = datetime.datetime.now(datetime.timezone.utc)
        # Если period_days <= 0, считаем, что нужен "весь период" — берём очень раннюю дату
        if period_days and period_days > 0:
            period_start = now - datetime.timedelta(days=period_days)
        else:
            period_start = datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)
        
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
            'total_promoters': 0,  # Количество промоутеров среди клиентов партнера
            
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
            
            # NPS метрики за период (как в дашборде)
            nps_response = self.client.from_('nps_ratings').select('rating').eq('partner_chat_id', partner_chat_id).gte('created_at', period_start.isoformat()).execute()
            nps_ratings = nps_response.data if nps_response.data else []
            
            if nps_ratings:
                # Используем точно такую же логику, как в дашборде
                # В дашборде: const promoters = npsRatings?.filter(r => r.rating >= 9).length || 0;
                ratings = [r.get('rating') for r in nps_ratings if r.get('rating') is not None]
                
                if ratings:
                    stats['avg_nps'] = round(sum(ratings) / len(ratings), 2)
                    # Промоутеры: оценки >= 9 (как в дашборде)
                    stats['promoters'] = len([r for r in ratings if r >= 9])
                    # Нейтральные: оценки 7-8
                    stats['passives'] = len([r for r in ratings if r in [7, 8]])
                    # Детракторы: оценки <= 6
                    stats['detractors'] = len([r for r in ratings if r <= 6])
                    
                    # Чистый NPS индекс (как в дашборде: Math.round(((promoters - detractors) / totalNPS) * 100))
                    total_ratings = len(ratings)
                    if total_ratings > 0:
                        nps_calculation = ((stats['promoters'] - stats['detractors']) / total_ratings) * 100
                        stats['nps_score'] = int(round(nps_calculation))
                    else:
                        stats['nps_score'] = 0
                else:
                    # Если нет валидных оценок
                    stats['avg_nps'] = 0.0
                    stats['nps_score'] = 0
                    stats['promoters'] = 0
                    stats['passives'] = 0
                    stats['detractors'] = 0
            else:
                # Если нет оценок, устанавливаем нулевые значения
                stats['avg_nps'] = 0.0
                stats['nps_score'] = 0
                stats['promoters'] = 0
                stats['passives'] = 0
                stats['detractors'] = 0
            
            # Получаем промоутеров партнера (клиенты партнера, которые стали промоутерами)
            try:
                # Получаем всех клиентов партнера
                partner_clients = [c['chat_id'] for c in all_clients]
                if partner_clients:
                    # Получаем промоутеров среди клиентов партнера
                    promoters_response = self.client.from_('promoters').select('client_chat_id').in_('client_chat_id', partner_clients).eq('is_active', True).execute()
                    stats['total_promoters'] = len(promoters_response.data) if promoters_response.data else 0
                else:
                    stats['total_promoters'] = 0
            except Exception as e:
                logging.error(f"Error fetching promoters for partner {partner_chat_id}: {e}")
                stats['total_promoters'] = 0
            
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
        
        # Не кешируем, чтобы NPS метрики всегда были актуальными
        # self._set_cache_entry(cache_key, stats)
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

    def update_partner_data(self, partner_id: str, name: str = None, company_name: str = None, phone: str = None, booking_url: str = None) -> bool:
        """Обновляет данные партнера (имя, название компании, телефон, ссылка на бронирование)."""
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
            if booking_url is not None:
                update_data['booking_url'] = booking_url if booking_url else None
            
            if update_data:
                # Обновляем в partner_applications
                self.client.from_('partner_applications').update(update_data).eq('chat_id', str(partner_id)).execute()
                # Также обновляем в partners, если партнер одобрен
                try:
                    self.client.from_('partners').update(update_data).eq('chat_id', str(partner_id)).execute()
                except Exception as e:
                    # Если партнер еще не одобрен, это нормально
                    logging.debug(f"Partner {partner_id} not in partners table yet: {e}")
                return True
            return False
        except Exception as e:
            logging.error(f"Error updating partner data: {e}")
            return False

    # -----------------------------------------------------------------
    # V. МЕТОДЫ ДЛЯ ПАРТНЕРОВ
    # -----------------------------------------------------------------

    def partner_exists(self, chat_id: int) -> bool:
        """Проверяет, существует ли партнер по Chat ID (любая запись в partner_applications)."""
        if not self.client: return False
        try:
            response = self.client.from_('partner_applications').select('chat_id').eq('chat_id', str(chat_id)).limit(1).execute()
            return bool(response.data)
        except Exception as e:
            logging.error(f"Error checking partner existence: {e}")
            return False

    def is_approved_partner(self, chat_id) -> bool:
        """Проверяет, является ли пользователь одобренным партнёром (partners или status=Approved)."""
        if not self.client: return False
        try:
            r = self.client.from_('partners').select('chat_id').eq('chat_id', str(chat_id)).limit(1).execute()
            if r.data:
                return True
            app = self.client.from_('partner_applications').select('status').eq('chat_id', str(chat_id)).limit(1).execute()
            if app.data:
                s = (app.data[0].get('status') or '').strip().lower()
                return s == 'approved'
            return False
        except Exception as e:
            logging.error(f"Error checking approved partner: {e}")
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

    def get_partner_client_chat_ids_for_broadcast(self, partner_chat_id: str, limit: int = 500) -> List[str]:
        """
        Возвращает chat_id клиентов партнёра, пригодных для рассылки (активированные, не VIA_PARTNER_*).
        """
        if not self.client:
            return []
        try:
            response = self.client.from_(USER_TABLE).select('chat_id').eq(
                PARTNER_ID_COLUMN, str(partner_chat_id)
            ).limit(limit * 2).execute()
            chat_ids = []
            for row in (response.data or []):
                cid = row.get('chat_id')
                if not cid:
                    continue
                cid_str = str(cid)
                if cid_str.startswith('VIA_PARTNER_'):
                    continue
                try:
                    int(cid)
                except (ValueError, TypeError):
                    continue
                chat_ids.append(cid_str)
                if len(chat_ids) >= limit:
                    break
            return chat_ids
        except Exception as e:
            logging.error(f"Error get_partner_client_chat_ids_for_broadcast: {e}")
            return []

    def can_partner_run_broadcast(self, partner_chat_id: str, max_per_day: int = 1) -> bool:
        """Проверяет, может ли партнёр запустить рассылку (лимит 1 раз в сутки)."""
        if not self.client:
            return False
        try:
            today_start = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            response = self.client.from_('partner_broadcast_campaigns').select('id').eq(
                'partner_chat_id', str(partner_chat_id)
            ).gte('started_at', today_start.isoformat()).in_('status', ['running', 'completed']).execute()
            count = len(response.data or [])
            return count < max_per_day
        except Exception as e:
            logging.error(f"Error can_partner_run_broadcast: {e}")
            return False

    def create_broadcast_campaign(self, partner_chat_id: str, template_id: str, recipient_count: int) -> Optional[int]:
        """Создаёт запись кампании рассылки, возвращает id."""
        if not self.client:
            return None
        try:
            r = self.client.from_('partner_broadcast_campaigns').insert({
                'partner_chat_id': str(partner_chat_id),
                'template_id': template_id,
                'recipient_count': recipient_count,
                'sent_count': 0,
                'status': 'running'
            }).execute()
            if r.data and len(r.data) > 0:
                return r.data[0].get('id')
            return None
        except Exception as e:
            logging.error(f"Error create_broadcast_campaign: {e}")
            return None

    def update_broadcast_campaign_finished(self, campaign_id: int, sent_count: int, status: str = 'completed', error_message: Optional[str] = None) -> bool:
        """Обновляет кампанию по завершении рассылки."""
        if not self.client:
            return False
        try:
            payload = {'sent_count': sent_count, 'status': status, 'finished_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
            if error_message:
                payload['error_message'] = error_message
            self.client.from_('partner_broadcast_campaigns').update(payload).eq('id', campaign_id).execute()
            return True
        except Exception as e:
            logging.error(f"Error update_broadcast_campaign_finished: {e}")
            return False

    def approve_partner(self, chat_id: int) -> bool:
        """Одобряет заявку партнера."""
        if not self.client: return False
        try:
            # Получаем данные заявки, включая referred_by_chat_id
            app_response = self.client.from_('partner_applications').select('*').eq('chat_id', str(chat_id)).limit(1).execute()
            if not app_response.data:
                logging.error(f"approve_partner: application not found for {chat_id}")
                return False
            
            app_data = app_response.data[0]
            referred_by_chat_id = app_data.get('referred_by_chat_id')
            
            # Обновляем статус заявки
            self.client.from_('partner_applications').update({'status': 'Approved'}).eq('chat_id', str(chat_id)).execute()
            
            # Создаем/обновляем запись в partners для соблюдения внешних ключей
            self.ensure_partner_record(str(chat_id))
            
            # Если партнер был приглашен другим партнером, создаем записи в partner_network
            if referred_by_chat_id:
                try:
                    # Проверяем, что пригласивший партнер существует
                    referrer_check = self.client.from_('partners').select('chat_id').eq('chat_id', str(referred_by_chat_id)).limit(1).execute()
                    if referrer_check.data:
                        # Создаем запись уровня 1 (прямое приглашение)
                        network_data = {
                            'referrer_chat_id': str(referred_by_chat_id),
                            'referred_chat_id': str(chat_id),
                            'level': 1,
                            'is_active': True
                        }
                        # Проверяем существование записи перед вставкой
                        existing = self.client.from_('partner_network').select('id').eq('referrer_chat_id', str(referred_by_chat_id)).eq('referred_chat_id', str(chat_id)).limit(1).execute()
                        if not existing.data:
                            self.client.from_('partner_network').insert(network_data).execute()
                        
                        # Создаем записи для уровней 2 и 3 (если есть)
                        # Уровень 2: пригласивший пригласившего
                        referrer_2_check = self.client.from_('partners').select('referred_by_chat_id').eq('chat_id', str(referred_by_chat_id)).limit(1).execute()
                        if referrer_2_check.data and referrer_2_check.data[0].get('referred_by_chat_id'):
                            referrer_2_id = referrer_2_check.data[0]['referred_by_chat_id']
                            network_data_2 = {
                                'referrer_chat_id': str(referrer_2_id),
                                'referred_chat_id': str(chat_id),
                                'level': 2,
                                'is_active': True
                            }
                            existing_2 = self.client.from_('partner_network').select('id').eq('referrer_chat_id', str(referrer_2_id)).eq('referred_chat_id', str(chat_id)).limit(1).execute()
                            if not existing_2.data:
                                self.client.from_('partner_network').insert(network_data_2).execute()
                            
                            # Уровень 3: пригласивший пригласившего пригласившего
                            referrer_3_check = self.client.from_('partners').select('referred_by_chat_id').eq('chat_id', str(referrer_2_id)).limit(1).execute()
                            if referrer_3_check.data and referrer_3_check.data[0].get('referred_by_chat_id'):
                                referrer_3_id = referrer_3_check.data[0]['referred_by_chat_id']
                                network_data_3 = {
                                    'referrer_chat_id': str(referrer_3_id),
                                    'referred_chat_id': str(chat_id),
                                    'level': 3,
                                    'is_active': True
                                }
                                existing_3 = self.client.from_('partner_network').select('id').eq('referrer_chat_id', str(referrer_3_id)).eq('referred_chat_id', str(chat_id)).limit(1).execute()
                                if not existing_3.data:
                                    self.client.from_('partner_network').insert(network_data_3).execute()
                        
                        logging.info(f"Созданы записи в partner_network для партнера {chat_id}, приглашенного партнером {referred_by_chat_id}")
                    else:
                        logging.warning(f"Пригласивший партнер {referred_by_chat_id} не найден в системе")
                except Exception as e:
                    logging.error(f"Ошибка создания записей в partner_network для партнера {chat_id}: {e}")
                    # Не прерываем процесс одобрения, если ошибка в создании сети
            
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
                'district': app_data.get('district', ''),
                'username': app_data.get('username'),  # Копируем username мастера
                'booking_url': app_data.get('booking_url'),  # Копируем ссылку на бронирование
                'referred_by_chat_id': app_data.get('referred_by_chat_id')  # Копируем chat_id пригласившего партнера
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

    def delete_partner(self, partner_chat_id: str) -> bool:
        """Удаляет партнера и все связанные данные (услуги, акции, заявки)."""
        if not self.client:
            return False
        try:
            partner_chat_id = str(partner_chat_id)
            
            # Удаляем услуги партнера
            try:
                self.client.from_('services').delete().eq('partner_chat_id', partner_chat_id).execute()
                logging.info(f"Deleted services for partner {partner_chat_id}")
            except Exception as e:
                logging.warning(f"Error deleting services for partner {partner_chat_id}: {e}")
            
            # Удаляем акции партнера
            try:
                self.client.from_('promotions').delete().eq('partner_chat_id', partner_chat_id).execute()
                logging.info(f"Deleted promotions for partner {partner_chat_id}")
            except Exception as e:
                logging.warning(f"Error deleting promotions for partner {partner_chat_id}: {e}")
            
            # Удаляем запись из partners
            try:
                self.client.from_('partners').delete().eq('chat_id', partner_chat_id).execute()
                logging.info(f"Deleted partner record for {partner_chat_id}")
            except Exception as e:
                logging.warning(f"Error deleting partner record for {partner_chat_id}: {e}")
            
            # Удаляем заявку партнера
            try:
                self.client.from_('partner_applications').delete().eq('chat_id', partner_chat_id).execute()
                logging.info(f"Deleted partner application for {partner_chat_id}")
            except Exception as e:
                logging.warning(f"Error deleting partner application for {partner_chat_id}: {e}")
            
            logging.info(f"Successfully deleted partner {partner_chat_id} and all related data")
            return True
        except Exception as e:
            logging.error(f"Error deleting partner {partner_chat_id}: {e}")
            return False

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
            'body_wellness', 'nutrition_coaching', 'mindfulness_coaching', 'image_consulting',
            'astrology', 'numerology', 'psychology_coaching', 'meditation_spirituality'
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

    def get_occupied_positions(self, city: str = 'New York') -> dict:
        """Возвращает словарь занятых позиций по районам и сферам услуг.
        
        Returns:
            dict: {
                'district_business_type': {
                    'district': str,
                    'business_type': str,
                    'status': str,  # 'Approved', 'Pending', etc.
                    'chat_id': str,
                    'name': str
                }
            }
        """
        if not self.client:
            return {}
        
        try:
            # Получаем всех партнеров для указанного города
            # Фильтруем только тех, у кого есть district и business_type
            query = self.client.from_('partners').select(
                'district, business_type, status, chat_id, name'
            ).eq('city', city)
            
            # Исключаем пустые значения
            resp = query.execute()
            
            occupied = {}
            
            for partner in resp.data or []:
                district = partner.get('district')
                business_type = partner.get('business_type')
                
                # Проверяем, что оба поля заполнены и не равны 'All'
                if (district and 
                    business_type and 
                    district != 'All' and 
                    district.strip() != '' and 
                    business_type.strip() != ''):
                    
                    key = f"{district}_{business_type}"
                    occupied[key] = {
                        'district': district,
                        'business_type': business_type,
                        'status': partner.get('status', 'Pending'),
                        'chat_id': partner.get('chat_id'),
                        'name': partner.get('name', '')
                    }
            
            return occupied
            
        except Exception as e:
            logging.error(f"Error fetching occupied positions for {city}: {e}")
            return {}

    def add_promotion(self, promo_data: dict) -> bool:
        """Добавляет новую акцию с валидацией и нормализацией полей.
        Требуемые поля таблицы promotions: partner_chat_id (text), title (text), description (text),
        discount_value (text), start_date (date, YYYY-MM-DD), end_date (date, YYYY-MM-DD).
        Не передаем явные id/created_at (есть default), статус трактуем как is_active: True.
        
        Новые поля:
        - promotion_type: 'discount', 'points_redemption', 'cashback'
        - service_ids: список UUID услуг для связи (опционально)
        - service_price: стоимость услуги (для points_redemption)
        - max_points_payment: максимальная оплата баллами (для points_redemption)
        - points_to_dollar_rate: курс обмена (для points_redemption)
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
        promotion_type = promo_data.get('promotion_type', 'discount')
        service_ids = promo_data.get('service_ids', [])  # Список UUID услуг
        service_price = promo_data.get('service_price')
        max_points_payment = promo_data.get('max_points_payment')
        points_to_dollar_rate = promo_data.get('points_to_dollar_rate', 1.0)

        # Простейшая валидация обязательных полей
        if not title or not description or not discount_value or not partner_chat_id or not end_date:
            logging.error(f"add_promotion: missing required fields. title={title}, description={description}, discount_value={discount_value}, partner_chat_id={partner_chat_id}, end_date={end_date}")
            print(f"ERROR: add_promotion missing required fields")
            return False

        # Для акций типа points_redemption нужны услуги
        if promotion_type == 'points_redemption' and not service_ids:
            logging.error(f"add_promotion: points_redemption promotion requires service_ids")
            print(f"ERROR: points_redemption promotion requires service_ids")
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

        # Проверка существования услуг (если указаны)
        if service_ids:
            try:
                services_check = self.client.from_('services').select('id, partner_chat_id').in_('id', service_ids).execute()
                if not services_check.data:
                    logging.error(f"add_promotion: no services found for provided IDs")
                    print(f"ERROR: no services found")
                    return False
                # Проверяем, что все услуги принадлежат партнеру
                for service in services_check.data:
                    if service.get('partner_chat_id') != partner_chat_id:
                        logging.error(f"add_promotion: service {service.get('id')} does not belong to partner {partner_chat_id}")
                        print(f"ERROR: service does not belong to partner")
                        return False
            except Exception as e:
                logging.error(f"add_promotion: services precheck failed: {e}")
                print(f"ERROR: services precheck failed: {e}")
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
            'promotion_type': promotion_type,
        }
        
        # Добавляем image_url если есть
        if promo_data.get('image_url'):
            record['image_url'] = promo_data.get('image_url')
        
        # Добавляем поля для оплаты баллами (если указаны)
        if service_price is not None:
            record['service_price'] = float(service_price)
        if max_points_payment is not None:
            record['max_points_payment'] = float(max_points_payment)
        if points_to_dollar_rate is not None:
            record['points_to_dollar_rate'] = float(points_to_dollar_rate)

        try:
            # Вставляем акцию
            result = self.client.from_('promotions').insert(record).execute()
            
            if not result.data or len(result.data) == 0:
                logging.error(f"add_promotion: no data returned after insert")
                print(f"ERROR: no data returned")
                return False
            
            promotion_id = result.data[0].get('id')
            
            # Создаем связи с услугами (если указаны)
            if service_ids and promotion_id:
                promotion_services_records = [
                    {'promotion_id': promotion_id, 'service_id': service_id}
                    for service_id in service_ids
                ]
                try:
                    self.client.from_('promotion_services').insert(promotion_services_records).execute()
                    logging.info(f"Created {len(promotion_services_records)} service links for promotion {promotion_id}")
                except Exception as e:
                    logging.error(f"Error creating promotion_services links: {e}")
                    # Не прерываем выполнение - акция создана, связи можно добавить позже
                    print(f"WARNING: failed to create service links: {e}")
            
            print(f"SUCCESS: Promotion inserted successfully. ID: {promotion_id}")
            logging.info(f"Promotion inserted successfully for partner {partner_chat_id}, ID: {promotion_id}")
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

    def get_promotions_for_service(self, service_id: str) -> list[dict]:
        """Возвращает список активных акций для услуги."""
        if not self.client:
            return []
        try:
            # Используем функцию из БД или делаем JOIN
            result = self.client.rpc('get_promotions_for_service', {'service_uuid': service_id}).execute()
            return result.data or []
        except Exception as e:
            logging.error(f"Error getting promotions for service {service_id}: {e}")
            # Fallback: делаем JOIN вручную
            try:
                result = self.client.from_('promotion_services').select(
                    'promotion_id, promotions(*)'
                ).eq('service_id', service_id).execute()
                
                promotions = []
                for item in result.data or []:
                    promo = item.get('promotions')
                    if promo and promo.get('is_active') and \
                       promo.get('start_date') <= datetime.date.today().isoformat() and \
                       promo.get('end_date') >= datetime.date.today().isoformat():
                        promotions.append(promo)
                return promotions
            except Exception as e2:
                logging.error(f"Error in fallback get_promotions_for_service: {e2}")
                return []

    def get_services_for_promotion(self, promotion_id: str) -> list[dict]:
        """Возвращает список услуг, привязанных к акции."""
        if not self.client:
            return []
        try:
            # Используем функцию из БД или делаем JOIN
            result = self.client.rpc('get_services_for_promotion', {'promo_id': promotion_id}).execute()
            return result.data or []
        except Exception as e:
            logging.error(f"Error getting services for promotion {promotion_id}: {e}")
            # Fallback: делаем JOIN вручную
            try:
                result = self.client.from_('promotion_services').select(
                    'service_id, services(*)'
                ).eq('promotion_id', promotion_id).execute()
                
                services = []
                for item in result.data or []:
                    service = item.get('services')
                    if service:
                        services.append(service)
                return services
            except Exception as e2:
                logging.error(f"Error in fallback get_services_for_promotion: {e2}")
                return []

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

    def update_service(self, service_id: str, partner_chat_id: str, title: str = None, description: str = None, price_points: int = None) -> bool:
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
                # Преобразуем service_id в строку для работы с UUID
                service_id_str = str(service_id)
                # Проверяем, что услуга принадлежит партнеру
                response = self.client.from_('services').select('id').eq('id', service_id_str).eq('partner_chat_id', str(partner_chat_id)).execute()
                if not response.data:
                    logging.error(f"Service {service_id_str} not found or doesn't belong to partner {partner_chat_id}")
                    return False
                
                self.client.from_('services').update(update_data).eq('id', service_id_str).execute()
                logging.info(f"Service {service_id_str} updated successfully")
                return True
            return False
        except Exception as e:
            logging.error(f"Error updating service: {e}")
            return False

    def get_service_by_id(self, service_id: str, partner_chat_id: str) -> Optional[dict]:
        """Получает услугу по ID с проверкой принадлежности партнеру."""
        if not self.client: return None
        try:
            # Преобразуем service_id в строку для работы с UUID
            service_id_str = str(service_id)
            response = self.client.from_('services').select('*').eq('id', service_id_str).eq('partner_chat_id', str(partner_chat_id)).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logging.error(f"Error getting service by id: {e}")
            return None

    def get_service_by_uuid(self, service_id: str) -> Optional[dict]:
        """Получает услугу по UUID (без проверки партнера, для обмена баллов)."""
        if not self.client: return None
        try:
            response = self.client.from_('services').select('*').eq('id', service_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logging.error(f"Error getting service by UUID: {e}")
            return None

    def get_promotion_by_id(self, promotion_id: str) -> Optional[dict]:
        """Получает акцию по ID."""
        if not self.client: return None
        try:
            response = self.client.from_('promotions').select('*').eq('id', promotion_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logging.error(f"Error getting promotion by id: {e}")
            return None

    def execute_promotion_transaction(self, client_chat_id: str, partner_chat_id: str, promotion_id: str, 
                                     points_to_spend: int, cash_payment: float) -> dict:
        """
        Выполняет транзакцию по акции: списывает баллы и начисляет новые за покупку.
        
        Args:
            client_chat_id: Chat ID клиента
            partner_chat_id: Chat ID партнера
            promotion_id: ID акции
            points_to_spend: Количество баллов для списания
            cash_payment: Сумма доплаты наличными (для начисления кэшбэка)
                          Кэшбэк начисляется ТОЛЬКО от этой суммы, НЕ от суммы оплаты баллами
            
        Returns:
            dict: {
                'success': bool,
                'points_spent': int,
                'points_earned': int,
                'new_balance': int,
                'error': str (если success=False)
            }
        """
        if not self.client:
            return {"success": False, "error": "DB is not initialized.", "points_spent": 0, "points_earned": 0, "new_balance": 0}
        
        try:
            # Получаем текущий баланс
            current_balance = self.get_client_balance(int(client_chat_id))
            
            # Проверяем баланс перед списанием
            if current_balance < points_to_spend:
                return {
                    "success": False,
                    "error": f"Недостаточно баллов. Требуется: {points_to_spend}, доступно: {current_balance}",
                    "points_spent": 0,
                    "points_earned": 0,
                    "new_balance": current_balance
                }
            
            # 1. Списываем баллы
            spend_result = self.execute_transaction(
                int(client_chat_id),
                int(partner_chat_id),
                'spend',
                float(points_to_spend),
                allow_queue=True
            )
            
            if not spend_result.get("success"):
                return {
                    "success": False,
                    "error": spend_result.get("error", "Ошибка при списании баллов"),
                    "points_spent": 0,
                    "points_earned": 0,
                    "new_balance": current_balance
                }
            
            # 2. Начисляем новые баллы за покупку (только от доплаты наличными)
            # Если cash_payment = 0 (полная оплата баллами), кэшбэк не начисляется
            if cash_payment > 0:
                accrual_result = self.execute_transaction(
                    int(client_chat_id),
                    int(partner_chat_id),
                    'accrual',
                    float(cash_payment),  # Правильно - только от доплаты наличными
                    allow_queue=True
                )
                
                if not accrual_result.get("success"):
                    # Если начисление не удалось, логируем ошибку, но списание уже выполнено
                    logging.error(f"Failed to accrue points after spending: {accrual_result.get('error')}")
                    return {
                        "success": True,  # Списание выполнено успешно
                        "points_spent": points_to_spend,
                        "points_earned": 0,
                        "new_balance": spend_result.get("new_balance", current_balance - points_to_spend),
                        "warning": f"Баллы списаны, но начисление не выполнено: {accrual_result.get('error')}"
                    }
            else:
                # Полная оплата баллами - кэшбэк не начисляется
                accrual_result = {
                    "success": True,
                    "points": 0,
                    "new_balance": spend_result.get("new_balance", current_balance - points_to_spend)
                }
            
            # Возвращаем успешный результат
            return {
                "success": True,
                "points_spent": points_to_spend,
                "points_earned": accrual_result.get("points", 0),
                "new_balance": accrual_result.get("new_balance", current_balance - points_to_spend + accrual_result.get("points", 0))
            }
            
        except Exception as e:
            logging.error(f"Error executing promotion transaction: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Ошибка при выполнении транзакции: {str(e)}",
                "points_spent": 0,
                "points_earned": 0,
                "new_balance": 0
            }

    def redeem_points_for_promotion(self, client_chat_id: str, promotion_id: str, points_to_spend: int) -> dict:
        """
        Подготавливает обмен баллов для акции (частичная оплата).
        Баллы НЕ списываются сразу - создается QR-код для мастера.
        
        Args:
            client_chat_id: Chat ID клиента
            promotion_id: ID акции
            points_to_spend: Количество баллов для оплаты
            
        Returns:
            dict: {
                'success': bool,
                'current_balance': int,
                'points_to_spend': int,
                'promotion': dict,
                'qr_data': str,  # Данные для QR-кода
                'error': str (если success=False)
            }
        """
        if not self.client:
            return {"success": False, "error": "DB is not initialized.", "current_balance": 0, "points_to_spend": 0}
        
        try:
            # Получаем акцию
            promotion = self.get_promotion_by_id(promotion_id)
            if not promotion:
                return {"success": False, "error": "Акция не найдена.", "current_balance": 0, "points_to_spend": 0}
            
            # Проверяем, что акция активна
            if not promotion.get('is_active', True):
                return {"success": False, "error": "Акция неактивна.", "current_balance": 0, "points_to_spend": 0}
            
            # Проверяем даты акции
            from datetime import datetime, date
            today = date.today()
            start_date = promotion.get('start_date')
            end_date = promotion.get('end_date')
            
            if start_date:
                start = datetime.strptime(start_date, '%Y-%m-%d').date() if isinstance(start_date, str) else start_date
                if today < start:
                    return {"success": False, "error": "Акция еще не началась.", "current_balance": 0, "points_to_spend": 0}
            
            if end_date:
                end = datetime.strptime(end_date, '%Y-%m-%d').date() if isinstance(end_date, str) else end_date
                if today > end:
                    return {"success": False, "error": "Акция уже закончилась.", "current_balance": 0, "points_to_spend": 0}
            
            # Проверяем возможность оплаты баллами
            max_points_payment = promotion.get('max_points_payment')
            if not max_points_payment or max_points_payment <= 0:
                return {"success": False, "error": "Эта акция не поддерживает оплату баллами.", "current_balance": 0, "points_to_spend": 0}
            
            # Получаем курс обмена (по умолчанию 1 балл = 1 доллар)
            points_rate = float(promotion.get('points_to_dollar_rate', 1.0))
            
            # Конвертируем баллы в доллары
            points_value_usd = points_to_spend * points_rate
            
            # Проверяем, не превышает ли сумма максимальную оплату баллами
            if points_value_usd > max_points_payment:
                return {
                    "success": False,
                    "error": f"Максимальная оплата баллами: ${max_points_payment:.2f}. Вы пытаетесь оплатить ${points_value_usd:.2f}.",
                    "current_balance": 0,
                    "points_to_spend": 0
                }
            
            # Получаем partner_chat_id
            partner_chat_id = promotion.get('partner_chat_id')
            if not partner_chat_id:
                return {"success": False, "error": "Акция не привязана к партнеру.", "current_balance": 0, "points_to_spend": 0}
            
            # Проверяем баланс клиента
            current_balance = self.get_client_balance(int(client_chat_id))
            if current_balance < points_to_spend:
                return {
                    "success": False,
                    "error": f"Недостаточно баллов. Требуется: {points_to_spend}, доступно: {current_balance}",
                    "current_balance": current_balance,
                    "points_to_spend": 0
                }
            
            # Получаем стоимость услуги
            service_price = promotion.get('service_price', 0)
            
            # Формируем данные для QR-кода
            # Формат: PROMOTION:promotion_id:client_chat_id:points_to_spend:points_value_usd
            qr_data = f"PROMOTION:{promotion_id}:{client_chat_id}:{points_to_spend}:{points_value_usd:.2f}"
            
            # Возвращаем успешный результат (баллы НЕ списываются - мастер списывает при сканировании)
            return {
                "success": True,
                "current_balance": current_balance,
                "points_to_spend": points_to_spend,
                "points_value_usd": points_value_usd,
                "service_price": service_price,
                "cash_payment": service_price - points_value_usd,  # Сколько нужно доплатить наличными
                "promotion": {
                    "id": promotion.get("id"),
                    "title": promotion.get("title"),
                    "description": promotion.get("description"),
                    "partner_chat_id": partner_chat_id
                },
                "qr_data": qr_data
            }
            
        except Exception as e:
            logging.error(f"Error preparing promotion redemption: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Ошибка при подготовке обмена баллов: {str(e)}",
                "current_balance": 0,
                "points_to_spend": 0
            }

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
        
        # #region agent log
        try:
            import json as _json
            _payload = {
                "sessionId": "debug-session",
                "runId": "pre-fix",
                "hypothesisId": "H1-H5",
                "location": "supabase_manager.py:create_news:entry",
                "message": "Entered create_news",
                "data": {
                    "has_title": bool(news_data.get("title")),
                    "has_content": bool(news_data.get("content")),
                    "keys": sorted(list(news_data.keys())),
                },
                "timestamp": __import__("time").time(),
            }
            logging.info(f"[DEBUG] {_json.dumps(_payload, ensure_ascii=False)}")
            try:
                with open("/Users/ghbi/Downloads/loyalitybot/.cursor/debug.log", "a", encoding="utf-8") as _f:
                    _f.write(_json.dumps(_payload, ensure_ascii=False) + "\n")
            except Exception:
                pass
        except Exception:
            pass
        # #endregion agent log
        
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
            
            # Добавляем предзаполненные переводы, если они были сгенерированы на уровне админ-бота
            if news_data.get('title_en'):
                record['title_en'] = news_data['title_en']
            if news_data.get('preview_text_en'):
                record['preview_text_en'] = news_data['preview_text_en']
            if news_data.get('content_en'):
                record['content_en'] = news_data['content_en']
            
            # #region agent log
            try:
                import json as _json
                _payload = {
                    "sessionId": "debug-session",
                    "runId": "pre-fix",
                    "hypothesisId": "H2-H4",
                    "location": "supabase_manager.py:create_news:before_insert",
                    "message": "Before insert into news",
                    "data": {
                        "has_title_en": "title_en" in record,
                        "has_preview_text_en": "preview_text_en" in record,
                        "has_content_en": "content_en" in record,
                        "record_keys": sorted(list(record.keys())),
                    },
                    "timestamp": __import__("time").time(),
                }
                _log_msg = f"[DEBUG] {_json.dumps(_payload, ensure_ascii=False)}"
                logging.info(_log_msg)
                print(_log_msg, flush=True)  # Гарантированный вывод в stdout
                try:
                    with open("/Users/ghbi/Downloads/loyalitybot/.cursor/debug.log", "a", encoding="utf-8") as _f:
                        _f.write(_json.dumps(_payload, ensure_ascii=False) + "\n")
                except Exception:
                    pass
            except Exception:
                pass
            # #endregion agent log
            
            try:
                # Пытаемся вставить запись с переводами
                result = self.client.from_('news').insert(record).execute()
            except Exception as e:
                # Если колонок _en ещё нет в БД, пробуем вставить запись без переводов
                _warn_msg = f"Failed to insert news with translations, retrying without *_en columns. Error: {e}"
                logging.warning(_warn_msg)
                print(f"[WARNING] {_warn_msg}", flush=True)
                
                # #region agent log
                try:
                    import json as _json
                    _payload = {
                        "sessionId": "debug-session",
                        "runId": "pre-fix",
                        "hypothesisId": "H2-H3",
                        "location": "supabase_manager.py:create_news:retry_without_translations",
                        "message": "Retry insert without *_en columns after error",
                        "data": {
                            "error_str": str(e)[:500],
                        },
                        "timestamp": __import__("time").time(),
                    }
                    _log_msg = f"[DEBUG] {_json.dumps(_payload, ensure_ascii=False)}"
                    logging.error(_log_msg)
                    print(_log_msg, flush=True)
                    try:
                        with open("/Users/ghbi/Downloads/loyalitybot/.cursor/debug.log", "a", encoding="utf-8") as _f:
                            _f.write(_json.dumps(_payload, ensure_ascii=False) + "\n")
                    except Exception:
                        pass
                except Exception:
                    pass
                # #endregion agent log

                record.pop('title_en', None)
                record.pop('preview_text_en', None)
                record.pop('content_en', None)
                result = self.client.from_('news').insert(record).execute()
            
            if result.data and len(result.data) > 0:
                news_id = result.data[0]['id']
                logging.info(f"News created successfully with ID: {news_id}")
                
                # #region agent log
                try:
                    import json as _json
                    _payload = {
                        "sessionId": "debug-session",
                        "runId": "pre-fix",
                        "hypothesisId": "H1-H4",
                        "location": "supabase_manager.py:create_news:success",
                        "message": "News created successfully",
                        "data": {
                            "news_id": news_id,
                        },
                        "timestamp": __import__("time").time(),
                    }
                    logging.info(f"[DEBUG] {_json.dumps(_payload, ensure_ascii=False)}")
                    try:
                        with open("/Users/ghbi/Downloads/loyalitybot/.cursor/debug.log", "a", encoding="utf-8") as _f:
                            _f.write(_json.dumps(_payload, ensure_ascii=False) + "\n")
                    except Exception:
                        pass
                except Exception:
                    pass
                # #endregion agent log

                return True, news_id
            
            return False, None
            
        except Exception as e:
            logging.error(f"Error creating news: {e}")
            
            # #region agent log
            try:
                import json as _json
                _payload = {
                    "sessionId": "debug-session",
                    "runId": "pre-fix",
                    "hypothesisId": "H1-H5",
                    "location": "supabase_manager.py:create_news:exception",
                    "message": "Exception in create_news",
                    "data": {
                        "error_str": str(e)[:500],
                    },
                    "timestamp": __import__("time").time(),
                }
                _log_msg = f"[DEBUG] {_json.dumps(_payload, ensure_ascii=False)}"
                logging.error(_log_msg)
                print(_log_msg, flush=True)  # Гарантированный вывод в stdout
                try:
                    with open("/Users/ghbi/Downloads/loyalitybot/.cursor/debug.log", "a", encoding="utf-8") as _f:
                        _f.write(_json.dumps(_payload, ensure_ascii=False) + "\n")
                except Exception:
                    pass
            except Exception:
                pass
            # #endregion agent log

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
    # Примечание: get_advanced_partner_stats определена выше (строка 1086)
    
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
                'Сумма чека ($)',
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
                    'Сумма чека ($)': txn.get('total_amount', 0),
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
            logging.error(f"Error updating app setting: {e}")
            return False

    # -----------------------------------------------------------------
    # REFERRAL SYSTEM METHODS (MLM для клиентов)
    # -----------------------------------------------------------------

    def generate_referral_code(self, chat_id: str) -> str:
        """Генерирует уникальный реферальный код для пользователя."""
        import hashlib
        import random
        
        if not self.client:
            return None
        
        # Генерируем код на основе chat_id и времени
        base_string = f"{chat_id}_{datetime.datetime.now().isoformat()}"
        code = hashlib.md5(base_string.encode()).hexdigest()[:6].upper()
        
        # Проверяем уникальность
        max_attempts = 10
        attempt = 0
        while attempt < max_attempts:
            try:
                existing = self.client.from_(USER_TABLE).select('chat_id').eq('referral_code', code).limit(1).execute()
                if not existing.data:
                    return code
                # Если код существует, генерируем новый
                code = hashlib.md5(f"{base_string}_{random.random()}".encode()).hexdigest()[:6].upper()
                attempt += 1
            except Exception as e:
                logging.error(f"Error checking referral code uniqueness: {e}")
                return code
        
        # Если не удалось сгенерировать уникальный код, используем chat_id
        return f"REF{chat_id[-6:].upper()}"

    def get_or_create_referral_code(self, chat_id: str) -> Optional[str]:
        """Получает существующий реферальный код или создаёт новый."""
        if not self.client:
            return None
        
        try:
            # Проверяем, есть ли уже код
            user_data = self.client.from_(USER_TABLE).select('referral_code').eq('chat_id', chat_id).limit(1).execute()
            if user_data.data and user_data.data[0].get('referral_code'):
                return user_data.data[0]['referral_code']
            
            # Создаём новый код
            code = self.generate_referral_code(chat_id)
            self.client.from_(USER_TABLE).update({'referral_code': code}).eq('chat_id', chat_id).execute()
            return code
        except Exception as e:
            logging.error(f"Error getting/creating referral code: {e}")
            return None

    def get_chat_id_by_referral_code(self, referral_code: str) -> Optional[str]:
        """Возвращает chat_id пользователя по реферальному коду (для единой ссылки ref_: клиент или партнёр)."""
        if not self.client or not referral_code:
            return None
        try:
            r = self.client.from_(USER_TABLE).select('chat_id').eq('referral_code', referral_code.upper().strip()).limit(1).execute()
            if r.data and len(r.data) > 0:
                return str(r.data[0].get('chat_id'))
            return None
        except Exception as e:
            logging.error(f"Error get_chat_id_by_referral_code: {e}")
            return None

    def _create_referral_tree_links(self, new_user_chat_id: str, direct_referrer_chat_id: str):
        """Создаёт связи в referral_tree для всех уровней (до 3 уровней вверх)."""
        if not self.client:
            return
        
        try:
            # Уровень 1: прямой реферер
            tree_data_1 = {
                'referrer_chat_id': direct_referrer_chat_id,
                'referred_chat_id': new_user_chat_id,
                'level': 1,
                'is_active': True
            }
            # Проверяем, не существует ли уже связь
            existing = self.client.from_('referral_tree').select('id').eq('referrer_chat_id', direct_referrer_chat_id).eq('referred_chat_id', new_user_chat_id).limit(1).execute()
            if not existing.data:
                self.client.from_('referral_tree').insert(tree_data_1).execute()
            
            # Уровень 2: реферер реферера
            referrer_2_data = self.client.from_(USER_TABLE).select('referred_by_chat_id').eq('chat_id', direct_referrer_chat_id).limit(1).execute()
            if referrer_2_data.data and referrer_2_data.data[0].get('referred_by_chat_id'):
                referrer_2_id = referrer_2_data.data[0]['referred_by_chat_id']
                tree_data_2 = {
                    'referrer_chat_id': referrer_2_id,
                    'referred_chat_id': new_user_chat_id,
                    'level': 2,
                    'is_active': True
                }
                existing_2 = self.client.from_('referral_tree').select('id').eq('referrer_chat_id', referrer_2_id).eq('referred_chat_id', new_user_chat_id).limit(1).execute()
                if not existing_2.data:
                    self.client.from_('referral_tree').insert(tree_data_2).execute()
                
                # Уровень 3: реферер реферера реферера
                referrer_3_data = self.client.from_(USER_TABLE).select('referred_by_chat_id').eq('chat_id', referrer_2_id).limit(1).execute()
                if referrer_3_data.data and referrer_3_data.data[0].get('referred_by_chat_id'):
                    referrer_3_id = referrer_3_data.data[0]['referred_by_chat_id']
                    tree_data_3 = {
                        'referrer_chat_id': referrer_3_id,
                        'referred_chat_id': new_user_chat_id,
                        'level': 3,
                        'is_active': True
                    }
                    existing_3 = self.client.from_('referral_tree').select('id').eq('referrer_chat_id', referrer_3_id).eq('referred_chat_id', new_user_chat_id).limit(1).execute()
                    if not existing_3.data:
                        self.client.from_('referral_tree').insert(tree_data_3).execute()
        except Exception as e:
            logging.error(f"Error creating referral tree links: {e}")

    def _build_referral_tree(self, referred_chat_id: str, level: int = 1, max_level: int = 3) -> list:
        """Строит дерево рефералов для начисления бонусов (от приглашённого к пригласившему)."""
        if not self.client or level > max_level:
            return []
        
        tree = []
        try:
            # Получаем реферера для данного пользователя (кто его пригласил)
            referrals = self.client.from_('referral_tree').select('referrer_chat_id, level').eq('referred_chat_id', referred_chat_id).eq('level', level).execute()
            
            for ref in referrals.data:
                referrer_id = ref['referrer_chat_id']
                tree.append({
                    'chat_id': referrer_id,
                    'level': level
                })
                # Рекурсивно получаем следующий уровень (кто пригласил реферера)
                tree.extend(self._build_referral_tree(referrer_id, level + 1, max_level))
            
            return tree
        except Exception as e:
            logging.error(f"Error building referral tree: {e}")
            return []

    def process_referral_registration_bonuses(self, new_user_chat_id: str, referrer_chat_id: str) -> bool:
        """Обрабатывает бонусы за регистрацию нового пользователя по реферальной ссылке клиента."""
        if not self.client:
            return False
        
        try:
            # Проверяем, что это регистрация по реферальной ссылке клиента (не партнёра)
            user_data = self.client.from_(USER_TABLE).select('referred_by_chat_id').eq('chat_id', new_user_chat_id).limit(1).execute()
            if not user_data.data or user_data.data[0].get('referred_by_chat_id') != referrer_chat_id:
                return False
            
            # Строим дерево рефералов (до 3 уровней)
            referral_tree = self._build_referral_tree(new_user_chat_id, level=1, max_level=3)
            
            # Начисляем бонусы за регистрацию
            config = self.REFERRAL_CONFIG
            bonuses_awarded = []
            
            for ref in referral_tree:
                level = ref['level']
                referrer_id = ref['chat_id']
                
                # Получаем бонус за регистрацию для этого уровня
                bonus_key = f'level_{level}'
                bonus_points = config['registration_bonus'].get(bonus_key, 0)
                
                if bonus_points > 0:
                    # Начисляем бонусы в кошелёк комиссий
                    current_commission = 0
                    try:
                        commission_data = self.client.from_(USER_TABLE).select(COMMISSION_BALANCE_COLUMN).eq('chat_id', referrer_id).limit(1).execute()
                        if commission_data.data:
                            current_commission = commission_data.data[0].get(COMMISSION_BALANCE_COLUMN, 0) or 0
                    except Exception as e:
                        logging.error(f"Error fetching commission balance for referrer {referrer_id}: {e}")
                    new_commission = current_commission + bonus_points
                    
                    # Обновляем кошелёк комиссий
                    self.client.from_(USER_TABLE).update({COMMISSION_BALANCE_COLUMN: new_commission}).eq('chat_id', referrer_id).execute()
                    
                    # Записываем в referral_rewards
                    reward_data = {
                        'referrer_chat_id': referrer_id,
                        'referred_chat_id': new_user_chat_id,
                        'reward_type': 'registration',
                        'level': level,
                        'points': bonus_points,
                        'description': f'Бонус за регистрацию реферала уровня {level}'
                    }
                    reward_result = self.client.from_('referral_rewards').insert(reward_data).execute()
                    reward_id = reward_result.data[0]['id'] if reward_result.data else None
                    
                    # Обновляем referral_tree
                    self.client.from_('referral_tree').update({
                        'total_earned_points': bonus_points,
                        'total_transactions': 0,
                        'is_active': True
                    }).eq('referrer_chat_id', referrer_id).eq('referred_chat_id', new_user_chat_id).execute()
                    
                    # Добавляем метрику в активный период лидерборда
                    active_period = self.get_active_leaderboard_period()
                    if active_period and reward_id:
                        self.add_leaderboard_metric(
                            active_period['id'],
                            referrer_id,
                            'referral_registration',
                            float(bonus_points),
                            f'Бонус за регистрацию реферала уровня {level}',
                            reward_id,
                            'referral_rewards'
                        )
                    
                    bonuses_awarded.append({
                        'referrer': referrer_id,
                        'level': level,
                        'points': bonus_points
                    })
            
            # Проверяем достижения
            for ref in referral_tree:
                self.check_and_award_achievements(ref['chat_id'])
            
            logging.info(f"Referral registration bonuses processed for {new_user_chat_id}: {bonuses_awarded}")
            return True
            
        except Exception as e:
            logging.error(f"Error processing referral registration bonuses: {e}")
            return False

    def _get_partner_data_for_calculator(self, partner_chat_id: str) -> Optional[PartnerData]:
        """Получает данные партнера для калькулятора комиссий."""
        if not self.client or not REFERRAL_CALCULATOR_AVAILABLE:
            return None
        try:
            response = self.client.from_('partners').select('chat_id, base_reward_percent').eq('chat_id', str(partner_chat_id)).limit(1).execute()
            if response.data and len(response.data) > 0:
                partner = response.data[0]
                return PartnerData(
                    id=str(partner['chat_id']),
                    base_reward_percent=float(partner.get('base_reward_percent', 0.05))
                )
            return None
        except Exception as e:
            logging.error(f"Error getting partner data for calculator: {e}")
            return None

    def get_influencer_partner_chat_ids(self) -> set:
        """Возвращает множество chat_id партнёров с category_group = 'influencer' (блогеры)."""
        if not self.client:
            return set()
        try:
            response = self.client.from_('partners').select('chat_id').eq('category_group', 'influencer').execute()
            return {str(r['chat_id']) for r in (response.data or []) if r.get('chat_id')}
        except Exception as e:
            logging.error(f"Error get_influencer_partner_chat_ids: {e}")
            return set()

    def _get_active_b2b_deals_for_calculator(self) -> List[B2BDeal]:
        """Получает список активных B2B сделок для калькулятора."""
        if not self.client or not REFERRAL_CALCULATOR_AVAILABLE:
            return []
        try:
            response = self.client.from_('partner_deals').select('*').eq('status', 'active').execute()
            deals = []
            for deal_data in (response.data or []):
                # Проверка срока действия
                if deal_data.get('expires_at'):
                    try:
                        expires_str = deal_data['expires_at']
                        expires = datetime.datetime.fromisoformat(expires_str.replace('Z', '+00:00'))
                        if expires < datetime.datetime.now(datetime.timezone.utc):
                            continue
                    except Exception:
                        pass
                
                # Маппинг полей: referral_commission_percent -> seller_pays_percent
                # client_cashback_percent -> buyer_gets_percent
                deals.append(B2BDeal(
                    seller_partner_id=str(deal_data.get('target_partner_chat_id', '')),
                    source_partner_id=str(deal_data.get('source_partner_chat_id', '')),
                    seller_pays_percent=float(deal_data.get('referral_commission_percent', 0.10)),
                    buyer_gets_percent=float(deal_data.get('client_cashback_percent', 0.15)),
                    status=str(deal_data.get('status', 'active'))
                ))
            return deals
        except Exception as e:
            logging.error(f"Error getting active B2B deals for calculator: {e}")
            return []

    def _build_users_dict_for_calculator(self, start_user_id: str, max_depth: int = 4) -> Dict[str, CalcUser]:
        """Строит словарь пользователей для калькулятора (с цепочкой рефералов до 3 уровней)."""
        if not self.client or not REFERRAL_CALCULATOR_AVAILABLE:
            return {}
        try:
            users_dict = {}
            visited = set()
            queue = [(start_user_id, 0)]  # (user_id, depth)
            
            while queue and len(users_dict) < 20:  # Защита от бесконечного цикла
                current_id, depth = queue.pop(0)
                if current_id in visited or depth > max_depth:
                    continue
                visited.add(current_id)
                
                # Получаем данные пользователя (referral_source = партнёр, пригласивший клиента)
                user_data = self.client.from_(USER_TABLE).select(
                    f'chat_id, referred_by_chat_id, {PARTNER_ID_COLUMN}, commission_balance'
                ).eq('chat_id', str(current_id)).limit(1).execute()
                
                if user_data.data:
                    user_row = user_data.data[0]
                    user_id = str(user_row['chat_id'])
                    referrer_id = user_row.get('referred_by_chat_id')
                    if not referrer_id and user_row.get(PARTNER_ID_COLUMN):
                        referrer_id = user_row.get(PARTNER_ID_COLUMN)
                    
                    users_dict[user_id] = CalcUser(
                        id=user_id,
                        referrer_id=str(referrer_id) if referrer_id else None,
                        commission_balance=float(user_row.get(COMMISSION_BALANCE_COLUMN, 0) or 0)
                    )
                    
                    # Добавляем реферера в очередь
                    if referrer_id and depth < max_depth:
                        queue.append((str(referrer_id), depth + 1))
            
            return users_dict
        except Exception as e:
            logging.error(f"Error building users dict for calculator: {e}")
            return {}

    def _apply_commission_distribution(self, distribution: CommissionDistribution, user_chat_id: str, transaction_id: Optional[int] = None) -> bool:
        """Применяет результаты расчета комиссий: начисляет в commission_balance и balance."""
        if not self.client:
            return False
        
        try:
            for commission in distribution.commissions:
                if commission.user_id == "SYSTEM":
                    # Системная комиссия просто логируется
                    logging.info(f"System commission: {commission.amount:.2f} ({commission.description})")
                    continue
                
                # Начисляем комиссию в commission_balance
                current_commission = 0
                try:
                    commission_data = self.client.from_(USER_TABLE).select(COMMISSION_BALANCE_COLUMN).eq('chat_id', commission.user_id).limit(1).execute()
                    if commission_data.data:
                        current_commission = float(commission_data.data[0].get(COMMISSION_BALANCE_COLUMN, 0) or 0)
                except Exception as e:
                    logging.error(f"Error fetching commission balance for {commission.user_id}: {e}")
                
                new_commission = current_commission + commission.amount
                
                # Обновляем commission_balance
                self.client.from_(USER_TABLE).update({
                    COMMISSION_BALANCE_COLUMN: new_commission
                }).eq('chat_id', commission.user_id).execute()
                
                # Записываем в referral_rewards
                # ✅ Для комиссий (L1/L2/L3) используем reward_type 'commission_l1/l2/l3' и сохраняем amount_usd
                # commission.amount уже в USD (конвертирован в process_referral_transaction_bonuses)
                reward_type = f'commission_{commission.type.lower()}' if commission.type in ['L1', 'L2', 'L3'] else 'transaction'
                
                reward_data = {
                    'referrer_chat_id': commission.user_id,
                    'referred_chat_id': user_chat_id,
                    'reward_type': reward_type,
                    'level': 1 if commission.type == 'L1' else (2 if commission.type == 'L2' else (3 if commission.type == 'L3' else 0)),
                    'points': 0 if reward_type.startswith('commission_') else int(commission.amount),  # Для комиссий points = 0
                    'amount_usd': float(commission.amount) if reward_type.startswith('commission_') else None,  # ✅ Сохраняем USD для комиссий
                    'currency': 'USD',  # ✅ Комиссии всегда в USD
                    'status': 'pending',  # ✅ Статус для отслеживания выплат
                    'transaction_id': transaction_id,
                    'description': commission.description
                }
                self.client.from_('referral_rewards').insert(reward_data).execute()
                
                logging.info(f"Commission awarded: {commission.user_id} +{commission.amount:.2f} ({commission.type})")
            
            # Если есть спец-кэшбэк покупателю (B2B), начисляем в balance
            if distribution.buyer_special_reward and distribution.buyer_special_reward > 0:
                current_balance = self.get_client_balance(int(user_chat_id))
                new_balance = current_balance + distribution.buyer_special_reward
                self.client.from_(USER_TABLE).update({
                    BALANCE_COLUMN: new_balance
                }).eq('chat_id', user_chat_id).execute()
                
                # Записываем транзакцию
                self.record_transaction(
                    int(user_chat_id),
                    None,
                    int(distribution.buyer_special_reward),
                    'accrual',
                    f"Спец-кэшбэк по B2B сделке: {distribution.buyer_special_reward:.2f} баллов",
                    raw_amount=distribution.buyer_special_reward
                )
                
                logging.info(f"B2B special reward awarded to buyer {user_chat_id}: {distribution.buyer_special_reward:.2f}")
            
            return True
        except Exception as e:
            logging.error(f"Error applying commission distribution: {e}")
            return False

    def process_referral_transaction_bonuses(self, user_chat_id: str, earned_points: int, transaction_id: int = None, 
                                             raw_amount: Optional[float] = None, seller_partner_id: Optional[str] = None) -> bool:
        """
        Обрабатывает бонусы с транзакций для рефералов.
        
        Новая логика (приоритет):
        - Если доступен ReferralCalculator и есть raw_amount + seller_partner_id: использует новую логику (Standard MLM или B2B)
        - Иначе: fallback на старую логику (8%/4%/2% от earned_points)
        
        :param user_chat_id: ID покупателя
        :param earned_points: Заработанные баллы (кэшбэк)
        :param transaction_id: ID транзакции
        :param raw_amount: Сумма чека в рублях (для новой логики)
        :param seller_partner_id: ID партнера-продавца (для новой логики)
        """
        if not self.client or earned_points <= 0:
            return False
        
        # Попытка использовать новую логику
        if REFERRAL_CALCULATOR_AVAILABLE and raw_amount and raw_amount > 0 and seller_partner_id:
            try:
                # ✅ Получаем валюту транзакции (если есть transaction_id)
                currency = 'USD'  # По умолчанию USD
                txn_date = datetime.datetime.now()
                
                if transaction_id:
                    try:
                        txn_data = self.client.table('transactions').select(
                            'currency, date_time'
                        ).eq('id', transaction_id).single().execute()
                        
                        if txn_data.data:
                            currency = txn_data.data.get('currency', 'USD')
                            txn_date_str = txn_data.data.get('date_time', '')
                            if txn_date_str:
                                try:
                                    if 'T' in txn_date_str:
                                        txn_date = datetime.datetime.fromisoformat(txn_date_str.replace('Z', '+00:00'))
                                    else:
                                        txn_date = datetime.datetime.strptime(txn_date_str, '%Y-%m-%d')
                                except Exception:
                                    pass
                    except Exception as e:
                        logging.warning(f"Не удалось получить валюту транзакции {transaction_id}: {e}. Используется USD")
                
                # ✅ Конвертируем сумму в USD для расчета комиссий
                from currency_utils import convert_currency
                raw_amount_usd = convert_currency(
                    raw_amount,
                    from_currency=currency,
                    to_currency='USD',
                    date=txn_date,
                    supabase_client=self.client
                )
                
                logging.debug(f"Реферальные комиссии: {raw_amount} {currency} → {raw_amount_usd} USD")
                
                # Получаем данные для калькулятора
                users_dict = self._build_users_dict_for_calculator(user_chat_id)
                if not users_dict:
                    logging.warning(f"Could not build users dict for {user_chat_id}, falling back to old logic")
                    return self._process_referral_bonuses_old_logic(user_chat_id, earned_points, transaction_id)
                
                deals = self._get_active_b2b_deals_for_calculator()
                seller_data = self._get_partner_data_for_calculator(seller_partner_id)
                influencer_ids = self.get_influencer_partner_chat_ids()
                
                # Создаем калькулятор (с поддержкой режима блогер/инфлюенсер)
                calculator = ReferralCalculator(users_dict, deals, partner_influencer_ids=influencer_ids)
                
                # Рассчитываем комиссии (используем USD сумму)
                purchase = PurchaseInput(
                    user_id=user_chat_id,
                    amount=raw_amount_usd,  # ✅ В USD
                    seller_partner_id=seller_partner_id
                )
                
                result = calculator.calculate_commissions(purchase, seller_data)
                
                logging.info(f"New commission logic applied ({result.logic_type}): {len(result.commissions)} commissions, system_total={result.system_total:.2f}")
                
                # Применяем результаты
                return self._apply_commission_distribution(result, user_chat_id, transaction_id)
                
            except Exception as e:
                logging.error(f"Error in new referral commission logic, falling back to old: {e}")
                # Fallback на старую логику
                return self._process_referral_bonuses_old_logic(user_chat_id, earned_points, transaction_id)
        
        # Fallback: старая логика
        return self._process_referral_bonuses_old_logic(user_chat_id, earned_points, transaction_id)

    def _process_referral_bonuses_old_logic(self, user_chat_id: str, earned_points: int, transaction_id: int = None) -> bool:
        """Старая логика обработки реферальных бонусов (8%/4%/2% от earned_points). Fallback."""
        if not self.client or earned_points <= 0:
            return False
        
        try:
            # Строим дерево рефералов (до 3 уровней)
            referral_tree = self._build_referral_tree(user_chat_id, level=1, max_level=3)
            
            if not referral_tree:
                return True  # Нет рефералов, ничего делать не нужно
            
            config = self.REFERRAL_CONFIG
            bonuses_awarded = []
            
            for ref in referral_tree:
                level = ref['level']
                referrer_id = ref['chat_id']
                
                # Получаем процент для этого уровня
                percent_key = f'level_{level}'
                percent = config['transaction_percent'].get(percent_key, 0.0)
                
                if percent > 0:
                    # Рассчитываем бонус
                    bonus_points = int(earned_points * percent)
                    
                    if bonus_points > 0:
                        # Начисляем бонусы в кошелёк комиссий
                        current_commission = 0
                        try:
                            commission_data = self.client.from_(USER_TABLE).select(COMMISSION_BALANCE_COLUMN).eq('chat_id', referrer_id).limit(1).execute()
                            if commission_data.data:
                                current_commission = commission_data.data[0].get(COMMISSION_BALANCE_COLUMN, 0) or 0
                        except Exception as e:
                            logging.error(f"Error fetching commission balance for referrer {referrer_id}: {e}")
                        new_commission = current_commission + bonus_points
                        
                        # Обновляем кошелёк комиссий
                        self.client.from_(USER_TABLE).update({COMMISSION_BALANCE_COLUMN: new_commission}).eq('chat_id', referrer_id).execute()
                        
                        # Записываем в referral_rewards
                        reward_data = {
                            'referrer_chat_id': referrer_id,
                            'referred_chat_id': user_chat_id,
                            'reward_type': 'transaction',
                            'level': level,
                            'points': bonus_points,
                            'transaction_id': transaction_id,
                            'description': f'Бонус {int(percent * 100)}% с транзакции реферала уровня {level}'
                        }
                        reward_result = self.client.from_('referral_rewards').insert(reward_data).execute()
                        reward_id = reward_result.data[0]['id'] if reward_result.data else None
                        
                        # Обновляем referral_tree
                        self.client.from_('referral_tree').update({
                            'total_earned_points': bonus_points,
                            'total_transactions': 1,
                            'last_transaction_at': datetime.datetime.now().isoformat(),
                            'is_active': True
                        }).eq('referrer_chat_id', referrer_id).eq('referred_chat_id', user_chat_id).execute()
                        
                        # Добавляем метрику в активный период лидерборда
                        active_period = self.get_active_leaderboard_period()
                        if active_period and reward_id:
                            self.add_leaderboard_metric(
                                active_period['id'],
                                referrer_id,
                                'referral_transaction',
                                float(bonus_points),
                                f'Бонус с транзакции реферала уровня {level}',
                                reward_id,
                                'referral_rewards'
                            )
                        
                        bonuses_awarded.append({
                            'referrer': referrer_id,
                            'level': level,
                            'points': bonus_points
                        })
            
            if bonuses_awarded:
                logging.info(f"Referral transaction bonuses processed for {user_chat_id}: {bonuses_awarded}")
            
            return True
            
        except Exception as e:
            logging.error(f"Error processing referral transaction bonuses: {e}")
            return False

    def register_client_via_client_referral(self, chat_id: str, referrer_code: str, phone: Optional[str] = None, name: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
        """Регистрирует клиента по реферальной ссылке другого клиента."""
        if not self.client:
            return None, "DB is not initialized"
        
        try:
            # Находим реферера по коду
            referrer_data = self.client.from_(USER_TABLE).select('chat_id').eq('referral_code', referrer_code.upper()).limit(1).execute()
            if not referrer_data.data:
                return None, "Неверный реферальный код"
            
            referrer_chat_id = referrer_data.data[0]['chat_id']
            
            # Проверяем, не регистрируется ли пользователь сам себя
            if str(chat_id) == str(referrer_chat_id):
                return None, "Нельзя использовать свой собственный реферальный код"
            
            # Проверяем, не зарегистрирован ли уже пользователь
            if self.client_exists(int(chat_id)):
                return None, "Пользователь уже зарегистрирован"
            
            # Регистрируем пользователя
            client_data = {
                'chat_id': str(chat_id),
                PHONE_COLUMN: phone,
                'name': name,
                'status': 'active',
                BALANCE_COLUMN: self._WELCOME_BONUS,
                'registered_via': 'client_referral',
                'referred_by_chat_id': referrer_chat_id,
                'reg_date': datetime.datetime.now().isoformat()
            }
            
            self.client.from_(USER_TABLE).insert(client_data).execute()
            
            # Генерируем реферальный код для нового пользователя
            self.get_or_create_referral_code(str(chat_id))
            
            # Создаём связи в referral_tree для всех уровней
            self._create_referral_tree_links(str(chat_id), referrer_chat_id)
            
            # Начисляем приветственный бонус
            transaction_data = {
                'client_chat_id': str(chat_id),
                'partner_chat_id': None,
                'total_amount': 0,
                'currency': 'USD',  # ✅ Welcome bonus всегда в USD
                'earned_points': float(self._WELCOME_BONUS),  # ✅ В USD эквиваленте (float)
                'spent_points': 0,
                'operation_type': 'enrollment_bonus',
                'description': 'Приветственный бонус при регистрации',
                'date_time': datetime.datetime.now().isoformat()
            }
            self.client.from_(TRANSACTION_TABLE).insert(transaction_data).execute()
            
            # Обрабатываем реферальные бонусы
            self.process_referral_registration_bonuses(str(chat_id), referrer_chat_id)
            
            return f"✅ Регистрация успешна! Вы получили {self._WELCOME_BONUS} приветственных баллов.", None
            
        except APIError as e:
            logging.error(f"Error registering client via referral: {e}")
            return None, f"Ошибка БД: {e}"
        except Exception as e:
            logging.error(f"Error registering client via referral: {e}")
            return None, f"Ошибка: {e}"

    def get_referral_stats(self, chat_id: str) -> dict:
        """Получает статистику рефералов для пользователя."""
        if not self.client:
            return {}
        
        try:
            # Получаем данные пользователя
            user_data = self.client.from_(USER_TABLE).select(
                'referral_code, total_referrals, active_referrals, total_referral_earnings, referral_level'
            ).eq('chat_id', chat_id).limit(1).execute()
            
            if not user_data.data:
                return {}
            
            user = user_data.data[0]
            
            # Получаем список рефералов
            referrals = self.client.from_('referral_tree').select(
                'referred_chat_id, level, registered_at, is_active, total_earned_points, total_transactions'
            ).eq('referrer_chat_id', chat_id).order('registered_at', desc=True).execute()
            
            # Получаем последние награды
            recent_rewards = self.client.from_('referral_rewards').select(
                'referred_chat_id, reward_type, points, created_at, description'
            ).eq('referrer_chat_id', chat_id).order('created_at', desc=True).limit(10).execute()
            
            return {
                'referral_code': user.get('referral_code'),
                'total_referrals': user.get('total_referrals', 0),
                'active_referrals': user.get('active_referrals', 0),
                'total_earnings': user.get('total_referral_earnings', 0),
                'referral_level': user.get('referral_level', 'bronze'),
                'referrals_list': referrals.data if referrals.data else [],
                'recent_rewards': recent_rewards.data if recent_rewards.data else []
            }
        except Exception as e:
            logging.error(f"Error getting referral stats: {e}")
            return {}

    def check_and_award_achievements(self, chat_id: str) -> list:
        """Проверяет и награждает достижениями за количество рефералов."""
        if not self.client:
            return []
        
        try:
            # Получаем количество рефералов
            user_data = self.client.from_(USER_TABLE).select('total_referrals').eq('chat_id', chat_id).limit(1).execute()
            if not user_data.data:
                return []
            
            total_referrals = user_data.data[0].get('total_referrals', 0)
            
            # Проверяем, какие достижения уже получены
            existing_achievements = self.client.from_('referral_rewards').select('description').eq(
                'referrer_chat_id', chat_id
            ).eq('reward_type', 'achievement').execute()
            
            existing_descriptions = [a.get('description', '') for a in (existing_achievements.data or [])]
            
            # Проверяем достижения
            config = self.REFERRAL_CONFIG
            achievements = config.get('achievements', {})
            awarded = []
            
            for achievement_key, bonus_points in achievements.items():
                # Извлекаем число из ключа (например, '5_referrals' -> 5)
                threshold = int(achievement_key.split('_')[0])
                
                if total_referrals >= threshold:
                    achievement_desc = f'Достижение: {threshold} рефералов'
                    
                    # Проверяем, не получено ли уже это достижение
                    if achievement_desc not in existing_descriptions:
                        # Начисляем бонус в кошелёк комиссий
                        current_commission = 0
                        try:
                            commission_data = self.client.from_(USER_TABLE).select(COMMISSION_BALANCE_COLUMN).eq('chat_id', chat_id).limit(1).execute()
                            if commission_data.data:
                                current_commission = commission_data.data[0].get(COMMISSION_BALANCE_COLUMN, 0) or 0
                        except Exception as e:
                            logging.error(f"Error fetching commission balance for achievements {chat_id}: {e}")
                        new_commission = current_commission + bonus_points
                        
                        self.client.from_(USER_TABLE).update({COMMISSION_BALANCE_COLUMN: new_commission}).eq('chat_id', chat_id).execute()
                        
                        # Записываем достижение
                        reward_data = {
                            'referrer_chat_id': chat_id,
                            'referred_chat_id': chat_id,  # Сам себе
                            'reward_type': 'achievement',
                            'level': 0,
                            'points': bonus_points,
                            'description': achievement_desc
                        }
                        self.client.from_('referral_rewards').insert(reward_data).execute()
                        
                        awarded.append({
                            'achievement': achievement_key,
                            'points': bonus_points,
                            'description': achievement_desc
                        })
            
            if awarded:
                logging.info(f"Achievements awarded to {chat_id}: {awarded}")
            
            return awarded
            
        except Exception as e:
            logging.error(f"Error checking achievements: {e}")
            return []

    def get_background_image(self) -> str:
        """Получить путь к фоновому изображению."""
        return self.get_app_setting('background_image', '/bg/sakura.jpg')

    # =====================================================
    # СИСТЕМА ПРОМОУТЕРОВ И UGC
    # =====================================================

    def create_promoter_from_nps_10(self, client_chat_id: str) -> bool:
        """Автоматически создаёт промоутера при NPS оценке 10."""
        if not self.client:
            return False
        
        try:
            # Проверяем, не является ли уже промоутером
            existing = self.client.from_('promoters').select('id').eq('client_chat_id', client_chat_id).limit(1).execute()
            if existing.data:
                return True  # Уже промоутер
            
            # Генерируем промо-код
            promo_code_result = self.client.rpc('generate_promo_code', {'chat_id_param': client_chat_id}).execute()
            promo_code = promo_code_result.data if promo_code_result.data else None
            
            if not promo_code:
                # Fallback: генерируем вручную
                import hashlib
                import time
                code_hash = hashlib.md5((client_chat_id + str(time.time())).encode()).hexdigest()[:6].upper()
                promo_code = f"PROMO-{code_hash}"
            
            # Создаём промоутера
            promoter_data = {
                'client_chat_id': client_chat_id,
                'promoter_level': 'novice',
                'promo_code': promo_code,
                'is_active': True,
                'joined_at': datetime.datetime.now().isoformat()
            }
            
            result = self.client.from_('promoters').insert(promoter_data).execute()
            
            # Обновляем пользователя
            self.client.from_(USER_TABLE).update({
                'is_promoter': True,
                'promoter_since': datetime.datetime.now().isoformat()
            }).eq('chat_id', client_chat_id).execute()
            
            logging.info(f"Промоутер создан для клиента {client_chat_id} с промо-кодом {promo_code}")
            return True
            
        except Exception as e:
            logging.error(f"Ошибка создания промоутера: {e}", exc_info=True)
            return False

    def get_promoter_info(self, client_chat_id: str) -> Optional[dict]:
        """Получить информацию о промоутере."""
        if not self.client:
            return None
        
        try:
            result = self.client.from_('promoters').select('*').eq('client_chat_id', client_chat_id).limit(1).execute()
            if result.data:
                return result.data[0]
            return None
        except Exception as e:
            logging.error(f"Ошибка получения информации о промоутере: {e}")
            return None

    def add_ugc_content(self, promoter_chat_id: str, content_url: str, platform: str, promo_code: Optional[str] = None) -> tuple[bool, Optional[int]]:
        """Добавить UGC контент."""
        if not self.client:
            return False, None
        
        try:
            ugc_data = {
                'promoter_chat_id': promoter_chat_id,
                'content_url': content_url,
                'platform': platform,
                'promo_code': promo_code,
                'status': 'pending',
                'submitted_at': datetime.datetime.now().isoformat()
            }
            
            result = self.client.from_('ugc_content').insert(ugc_data).execute()
            
            if result.data and len(result.data) > 0:
                ugc_id = result.data[0]['id']
                
                # Обновляем общее количество публикаций (триггер обновит автоматически)
                logging.info(f"UGC контент добавлен для промоутера {promoter_chat_id}, ID: {ugc_id}")
                return True, ugc_id
            
            return False, None
            
        except Exception as e:
            logging.error(f"Ошибка добавления UGC контента: {e}", exc_info=True)
            return False, None

    def approve_ugc_content(self, ugc_id: int, moderator_notes: Optional[str] = None, quality_score: Optional[int] = None, reward_points: int = 100) -> bool:
        """Одобрить UGC контент и начислить баллы."""
        if not self.client:
            return False
        
        try:
            # Получаем информацию о контенте
            ugc_info = self.client.from_('ugc_content').select('promoter_chat_id').eq('id', ugc_id).limit(1).execute()
            if not ugc_info.data:
                return False
            
            promoter_chat_id = ugc_info.data[0]['promoter_chat_id']
            
            # Обновляем статус контента
            update_data = {
                'status': 'approved',
                'approved_at': datetime.datetime.now().isoformat(),
                'reward_points': reward_points
            }
            
            if moderator_notes:
                update_data['moderator_notes'] = moderator_notes
            if quality_score is not None:
                update_data['quality_score'] = quality_score
            
            self.client.from_('ugc_content').update(update_data).eq('id', ugc_id).execute()
            
            # Обновляем статистику промоутера
            promoter_info = self.get_promoter_info(promoter_chat_id)
            if promoter_info:
                approved_count = promoter_info.get('approved_publications', 0) + 1
                
                # Определяем уровень промоутера
                new_level = 'novice'
                if approved_count >= 20:
                    new_level = 'master'
                elif approved_count >= 10:
                    new_level = 'pro'
                elif approved_count >= 5:
                    new_level = 'active'
                
                self.client.from_('promoters').update({
                    'approved_publications': approved_count,
                    'total_earned_points': (promoter_info.get('total_earned_points', 0) or 0) + reward_points,
                    'promoter_level': new_level,
                    'last_publication_at': datetime.datetime.now().isoformat()
                }).eq('client_chat_id', promoter_chat_id).execute()
                
                # Начисляем баллы на счёт пользователя
                current_balance = self.get_client_balance(int(promoter_chat_id))
                self.client.from_(USER_TABLE).update({
                    BALANCE_COLUMN: current_balance + reward_points
                }).eq('chat_id', promoter_chat_id).execute()
                
                # Записываем транзакцию
                self.record_transaction(
                    int(promoter_chat_id),
                    0,  # SYSTEM
                    reward_points,
                    'ugc_bonus',
                    f'Бонус за одобренный UGC контент #{ugc_id}'
                )
                
                # Добавляем метрику в активный период лидерборда
                active_period = self.get_active_leaderboard_period()
                if active_period:
                    self.add_leaderboard_metric(
                        active_period['id'],
                        promoter_chat_id,
                        'ugc_publication',
                        float(reward_points),
                        f'Бонус за одобренный UGC контент #{ugc_id}',
                        ugc_id,
                        'ugc_content'
                    )
                
                logging.info(f"UGC контент {ugc_id} одобрен, промоутеру {promoter_chat_id} начислено {reward_points} баллов")
            
            return True
            
        except Exception as e:
            logging.error(f"Ошибка одобрения UGC контента: {e}", exc_info=True)
            return False

    def get_promo_materials(self, platform: Optional[str] = None) -> list[dict]:
        """Получить промо-материалы."""
        if not self.client:
            return []
        
        try:
            query = self.client.from_('promo_materials').select('*').eq('is_active', True)
            
            if platform:
                query = query.or_(f'platform.eq.{platform},platform.eq.all')
            
            result = query.order('created_at', desc=True).execute()
            return result.data if result.data else []
            
        except Exception as e:
            logging.error(f"Ошибка получения промо-материалов: {e}")
            return []

    def get_ugc_content_for_promoter(self, promoter_chat_id: str, status: Optional[str] = None) -> list[dict]:
        """Получить UGC контент промоутера."""
        if not self.client:
            return []
        
        try:
            query = self.client.from_('ugc_content').select('*').eq('promoter_chat_id', promoter_chat_id)
            
            if status:
                query = query.eq('status', status)
            
            result = query.order('submitted_at', desc=True).execute()
            return result.data if result.data else []
            
        except Exception as e:
            logging.error(f"Ошибка получения UGC контента: {e}")
            return []

    def get_all_pending_ugc_content(self) -> list[dict]:
        """Получить весь UGC контент на модерации (для админ-бота)."""
        if not self.client:
            return []
        
        try:
            result = self.client.from_('ugc_content').select('*').eq('status', 'pending').order('submitted_at', desc=True).execute()
            return result.data if result.data else []
        except Exception as e:
            logging.error(f"Ошибка получения всех UGC контентов: {e}")
            return []

    # =====================================================
    # СИСТЕМА ЛИДЕРБОРДА И ПРИЗОВ
    # =====================================================

    def create_leaderboard_period(self, period_type: str = 'monthly', target_date: Optional[datetime.date] = None) -> Optional[int]:
        """Создать период лидерборда."""
        if not self.client:
            return None
        
        try:
            if target_date is None:
                target_date = datetime.date.today()
            
            # Вызываем функцию БД для создания периода
            result = self.client.rpc('create_monthly_leaderboard_period', {'target_month': target_date.isoformat()}).execute()
            
            if result.data:
                period_id = result.data
                logging.info(f"Создан период лидерборда {period_id} для {target_date}")
                return period_id
            
            return None
            
        except Exception as e:
            logging.error(f"Ошибка создания периода лидерборда: {e}", exc_info=True)
            return None

    def get_active_leaderboard_period(self) -> Optional[dict]:
        """Получить активный период лидерборда."""
        if not self.client:
            return None
        
        try:
            result = self.client.from_('leaderboard_periods').select('*').eq('status', 'active').limit(1).execute()
            if result.data:
                return result.data[0]
            return None
        except Exception as e:
            logging.error(f"Ошибка получения активного периода: {e}")
            return None

    def add_leaderboard_metric(self, period_id: int, client_chat_id: str, metric_type: str, metric_value: float, description: Optional[str] = None, related_id: Optional[int] = None, related_table: Optional[str] = None) -> bool:
        """Добавить метрику для расчёта рейтинга лидерборда."""
        if not self.client:
            return False
        
        try:
            metric_data = {
                'period_id': period_id,
                'client_chat_id': client_chat_id,
                'metric_type': metric_type,
                'metric_value': metric_value,
                'description': description,
                'created_at': datetime.datetime.now().isoformat()
            }
            
            if related_id:
                metric_data['related_id'] = related_id
            if related_table:
                metric_data['related_table'] = related_table
            
            self.client.from_('leaderboard_metrics').insert(metric_data).execute()
            
            # Обновляем рейтинг
            self._update_leaderboard_ranking(period_id, client_chat_id)
            
            return True
            
        except Exception as e:
            logging.error(f"Ошибка добавления метрики лидерборда: {e}", exc_info=True)
            return False

    def _update_leaderboard_ranking(self, period_id: int, client_chat_id: str):
        """Обновить рейтинг участника лидерборда."""
        if not self.client:
            return
        
        try:
            # Получаем все метрики для участника за период
            metrics_result = self.client.from_('leaderboard_metrics').select('metric_type, metric_value').eq('period_id', period_id).eq('client_chat_id', client_chat_id).execute()
            
            if not metrics_result.data:
                return
            
            # Группируем метрики по типам
            referral_points = 0.0
            ugc_points = 0.0
            bonus_points = 0.0
            
            for metric in metrics_result.data:
                metric_type = metric['metric_type']
                metric_value = float(metric['metric_value'])
                
                if 'referral' in metric_type:
                    referral_points += metric_value
                elif 'ugc' in metric_type:
                    ugc_points += metric_value
                else:
                    bonus_points += metric_value
            
            # Общий рейтинг: referral * 1.0 + ugc * 1.2 + bonus * 1.5
            total_score = referral_points * 1.0 + ugc_points * 1.2 + bonus_points * 1.5
            
            # Проверяем, существует ли запись
            existing = self.client.from_('leaderboard_rankings').select('id').eq('period_id', period_id).eq('client_chat_id', client_chat_id).limit(1).execute()
            
            ranking_data = {
                'period_id': period_id,
                'client_chat_id': client_chat_id,
                'total_score': total_score,
                'referral_points': referral_points,
                'ugc_points': ugc_points,
                'bonus_points': bonus_points,
                'updated_at': datetime.datetime.now().isoformat()
            }
            
            if existing.data:
                # Обновляем существующую запись
                self.client.from_('leaderboard_rankings').update(ranking_data).eq('id', existing.data[0]['id']).execute()
            else:
                # Создаём новую запись
                ranking_data['created_at'] = datetime.datetime.now().isoformat()
                self.client.from_('leaderboard_rankings').insert(ranking_data).execute()
            
            # Пересчитываем ранги
            self.client.rpc('recalculate_leaderboard_ranks', {'period_id_param': period_id}).execute()
            
        except Exception as e:
            logging.error(f"Ошибка обновления рейтинга лидерборда: {e}", exc_info=True)

    def get_leaderboard_top(self, period_id: int, limit: int = 100) -> list[dict]:
        """Получить топ участников лидерборда."""
        if not self.client:
            return []
        
        try:
            result = self.client.from_('leaderboard_rankings').select('*, users:client_chat_id(name)').eq('period_id', period_id).order('total_score', desc=True).order('created_at', desc=False).limit(limit).execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logging.error(f"Ошибка получения топа лидерборда: {e}")
            return []

    def get_leaderboard_rank_for_user(self, period_id: int, client_chat_id: str) -> Optional[dict]:
        """Получить позицию пользователя в лидерборде."""
        if not self.client:
            return None
        
        try:
            result = self.client.from_('leaderboard_rankings').select('*').eq('period_id', period_id).eq('client_chat_id', client_chat_id).limit(1).execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logging.error(f"Ошибка получения позиции пользователя: {e}")
            return None

    def distribute_prizes(self, period_id: int) -> bool:
        """Распределить призы по завершении периода."""
        if not self.client:
            return False
        
        try:
            # Получаем период
            period_result = self.client.from_('leaderboard_periods').select('*, prizes_config').eq('id', period_id).limit(1).execute()
            if not period_result.data:
                return False
            
            period = period_result.data[0]
            prizes_config = period.get('prizes_config', {})
            
            # Получаем топ участников
            top_users = self.get_leaderboard_top(period_id, limit=10)
            
            for rank, user_ranking in enumerate(top_users, start=1):
                rank_key = str(rank)
                prize_config = None
                
                # Ищем конфигурацию приза для этого ранга
                if rank_key in prizes_config:
                    prize_config = prizes_config[rank_key]
                elif rank <= 3:
                    # По умолчанию для топ-3
                    if rank == 1:
                        prize_config = {'type': 'physical', 'name': 'MacBook Pro', 'alternative_points': 100000, 'description': 'MacBook Pro 16'}
                    elif rank == 2:
                        prize_config = {'type': 'physical', 'name': 'iPhone', 'alternative_points': 80000, 'description': 'iPhone 15 Pro'}
                    elif rank == 3:
                        prize_config = {'type': 'physical', 'name': 'AirPods Pro', 'alternative_points': 30000, 'description': 'AirPods Pro 2'}
                
                if not prize_config:
                    continue
                
                client_chat_id = user_ranking['client_chat_id']
                prize_type = prize_config.get('type', 'points')
                prize_name = prize_config.get('name', 'Приз')
                prize_value = prize_config.get('alternative_points', 0) if prize_type == 'points' else prize_config.get('value', 0)
                
                # Создаём запись о распределении приза
                distribution_data = {
                    'period_id': period_id,
                    'client_chat_id': client_chat_id,
                    'rank': rank,
                    'prize_type': prize_type,
                    'prize_name': prize_name,
                    'prize_description': prize_config.get('description', ''),
                    'prize_value': prize_value,
                    'status': 'pending',
                    'created_at': datetime.datetime.now().isoformat()
                }
                
                if prize_type == 'points':
                    distribution_data['points_awarded'] = prize_value
                
                self.client.from_('prize_distributions').insert(distribution_data).execute()
                
                # Обновляем запись в рейтинге
                self.client.from_('leaderboard_rankings').update({
                    'prize_earned': prize_name,
                    'prize_type': prize_type,
                    'prize_distributed': False
                }).eq('period_id', period_id).eq('client_chat_id', client_chat_id).execute()
            
            # Обновляем статус периода
            self.client.from_('leaderboard_periods').update({
                'status': 'rewards_distributed',
                'rewards_distributed_at': datetime.datetime.now().isoformat()
            }).eq('id', period_id).execute()
            
            # Отправляем уведомления участникам о возможности конвертации
            self._notify_participants_about_conversion(period_id)
            
            logging.info(f"Призы распределены для периода {period_id}")
            return True
            
        except Exception as e:
            logging.error(f"Ошибка распределения призов: {e}", exc_info=True)
            return False

    def convert_leaderboard_points_to_loyalty(self, period_id: int, client_chat_id: str) -> tuple[bool, dict]:
        """Конвертирует баллы лидерборда в обычные баллы системы лояльности.
        
        Returns:
            tuple[bool, dict]: (success, result_data)
            result_data содержит: success, error, loyalty_points, conversion_rate, leaderboard_points
        """
        if not self.client:
            return False, {'error': 'Supabase client not initialized'}
        
        try:
            # Вызываем функцию БД для конвертации
            result = self.client.rpc(
                'convert_leaderboard_points_to_loyalty_points',
                {
                    'period_id_param': period_id,
                    'client_chat_id_param': client_chat_id
                }
            ).execute()
            
            if not result.data:
                return False, {'error': 'Ошибка выполнения функции конвертации'}
            
            result_data = result.data if isinstance(result.data, dict) else result.data[0] if result.data else {}
            
            if not result_data.get('success'):
                return False, result_data
            
            # Если конвертация успешна, начисляем баллы на счёт пользователя
            loyalty_points = float(result_data.get('loyalty_points', 0))
            
            if loyalty_points > 0:
                # Получаем текущий баланс
                current_balance = self.get_client_balance(int(client_chat_id))
                
                # Обновляем баланс
                self.client.from_(USER_TABLE).update({
                    BALANCE_COLUMN: current_balance + loyalty_points
                }).eq('chat_id', client_chat_id).execute()
                
                # Записываем транзакцию
                period_info = self.client.from_('leaderboard_periods').select('period_name').eq('id', period_id).limit(1).execute()
                period_name = period_info.data[0].get('period_name', 'Период') if period_info.data else 'Период'
                
                self.record_transaction(
                    int(client_chat_id),
                    0,  # SYSTEM
                    loyalty_points,
                    'leaderboard_conversion',
                    f'Конвертация баллов лидерборда периода "{period_name}"'
                )
                
                logging.info(f"Конвертировано {loyalty_points} баллов для клиента {client_chat_id} из периода {period_id}")
            
            return True, result_data
            
        except Exception as e:
            logging.error(f"Ошибка конвертации баллов лидерборда: {e}", exc_info=True)
            return False, {'error': str(e)}
    
    def _notify_participants_about_conversion(self, period_id: int) -> None:
        """Отправляет уведомления участникам о возможности конвертации баллов."""
        if not self.client:
            return
        
        try:
            # Получаем информацию о периоде
            period_result = self.client.from_('leaderboard_periods').select(
                'period_name, points_conversion_rate, points_conversion_enabled'
            ).eq('id', period_id).limit(1).execute()
            
            if not period_result.data:
                return
            
            period = period_result.data[0]
            period_name = period.get('period_name', 'Период')
            conversion_rate = float(period.get('points_conversion_rate', 10.0))
            conversion_enabled = period.get('points_conversion_enabled', True)
            
            if not conversion_enabled:
                return
            
            # Получаем всех участников, которые не получили призы
            rankings_result = self.client.from_('leaderboard_rankings').select(
                'client_chat_id, total_score, prize_type, prize_distributed'
            ).eq('period_id', period_id).execute()
            
            if not rankings_result.data:
                return
            
            # Импортируем client_bot для отправки уведомлений
            try:
                from client_handler import client_bot
            except ImportError:
                logging.warning("client_bot не доступен для отправки уведомлений")
                return
            
            for ranking in rankings_result.data:
                client_chat_id = ranking.get('client_chat_id')
                total_score = float(ranking.get('total_score', 0))
                
                # Пропускаем участников без баллов
                if total_score <= 0:
                    continue
                
                # Проверяем, получил ли участник приз
                has_prize = (ranking.get('prize_type') and 
                            ranking.get('prize_type') != 'none' and 
                            ranking.get('prize_distributed', False))
                
                # Уведомляем только тех, кто не получил приз
                if not has_prize:
                    loyalty_points = total_score * (conversion_rate / 100.0)
                    
                    try:
                        client_bot.send_message(
                            client_chat_id,
                            f"🎉 **Период лидерборда завершён!**\n\n"
                            f"📊 **Период:** {period_name}\n"
                            f"🎯 **Ваши баллы:** {total_score:.2f}\n\n"
                            f"💱 **Конвертация баллов**\n\n"
                            f"Вы можете конвертировать свои баллы лидерборда в обычные баллы системы лояльности!\n\n"
                            f"💰 **Вы получите:** {loyalty_points:.2f} баллов\n"
                            f"📈 **Курс:** {conversion_rate}%\n\n"
                            f"💡 **Как конвертировать:**\n"
                            f"• Используйте команду /convert_points\n"
                            f"• Или откройте меню спецвозможностей",
                            parse_mode='Markdown'
                        )
                        logging.info(f"Уведомление о конвертации отправлено клиенту {client_chat_id}")
                    except Exception as e:
                        logging.error(f"Ошибка отправки уведомления клиенту {client_chat_id}: {e}")
            
        except Exception as e:
            logging.error(f"Ошибка отправки уведомлений о конвертации: {e}", exc_info=True)
    
    def get_completed_periods_for_user(self, client_chat_id: str) -> list[dict]:
        """Получить завершённые периоды лидерборда, где пользователь участвовал и может конвертировать баллы."""
        if not self.client:
            return []
        
        try:
            # Получаем завершённые периоды, где пользователь участвовал
            result = self.client.from_('leaderboard_rankings').select(
                'period_id, total_score, points_converted, points_converted_amount, prize_type, prize_distributed, leaderboard_periods!inner(*)'
            ).eq('client_chat_id', client_chat_id).eq('leaderboard_periods.status', 'rewards_distributed').execute()
            
            periods = []
            for ranking in result.data:
                period_info = ranking.get('leaderboard_periods', {})
                
                # Проверяем, может ли пользователь конвертировать баллы
                has_prize = (ranking.get('prize_type') and 
                            ranking.get('prize_type') != 'none' and 
                            ranking.get('prize_distributed', False))
                already_converted = ranking.get('points_converted', False)
                conversion_enabled = period_info.get('points_conversion_enabled', True)
                
                can_convert = (not has_prize and 
                              not already_converted and 
                              conversion_enabled and 
                              float(ranking.get('total_score', 0)) > 0)
                
                periods.append({
                    'period_id': ranking.get('period_id'),
                    'period_name': period_info.get('period_name', 'Период'),
                    'total_score': float(ranking.get('total_score', 0)),
                    'points_converted': already_converted,
                    'points_converted_amount': float(ranking.get('points_converted_amount', 0)),
                    'conversion_rate': float(period_info.get('points_conversion_rate', 10.0)),
                    'can_convert': can_convert,
                    'has_prize': has_prize
                })
            
            return periods
            
        except Exception as e:
            logging.error(f"Ошибка получения завершённых периодов: {e}")
            return []

    # =====================================================
    # ИНТЕГРАЦИЯ: Автоматическая обработка NPS 10
    # =====================================================

    def record_nps_rating(self, client_chat_id: str, partner_chat_id: str, rating: int, master_name: Optional[str] = None) -> bool:
        """Записывает оценку NPS клиента. При оценке 10 автоматически создаёт промоутера.
        Если оценка уже существует, обновляет её (действует последняя оценка)."""
        if not self.client:
            logging.error(f"[NPS] Supabase client not initialized, cannot record rating for client {client_chat_id}")
            return False
        
        try:
            logging.info(f"[NPS] Начало записи оценки: client={client_chat_id}, partner={partner_chat_id}, rating={rating}")
            
            # Если partner_chat_id не указан или равен 'SYSTEM', пытаемся найти из последней транзакции
            if not partner_chat_id or partner_chat_id == 'SYSTEM':
                logging.info(f"[NPS] partner_chat_id не указан или 'SYSTEM', ищем из последней транзакции для клиента {client_chat_id}")
                last_txn = self.client.from_(TRANSACTION_TABLE).select('partner_chat_id').eq('client_chat_id', client_chat_id).order('date_time', desc=True).limit(1).execute()
                if last_txn.data and last_txn.data[0].get('partner_chat_id'):
                    partner_chat_id = last_txn.data[0]['partner_chat_id']
                    logging.info(f"[NPS] Найден partner_chat_id из транзакции: {partner_chat_id}")
                else:
                    logging.warning(f"[NPS] Не удалось найти partner_chat_id для клиента {client_chat_id}, используем 'SYSTEM'")
                    partner_chat_id = 'SYSTEM'
            
            # Проверяем, есть ли уже оценка от этого клиента этому партнеру
            existing_rating = self.client.from_('nps_ratings').select('id, rating, created_at').eq('client_chat_id', client_chat_id).eq('partner_chat_id', partner_chat_id).order('created_at', desc=True).limit(1).execute()
            
            current_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
            if existing_rating.data:
                # Обновляем существующую оценку
                old_rating = existing_rating.data[0].get('rating')
                rating_id = existing_rating.data[0].get('id')
                logging.info(f"[NPS] Найдена существующая оценка (ID={rating_id}, старый рейтинг={old_rating}), обновляем на {rating}")
                
                update_data = {
                    "rating": rating,
                    "master_name": master_name,
                    "created_at": current_time,  # Обновляем время на текущее
                }
                self.client.from_('nps_ratings').update(update_data).eq('id', rating_id).execute()
                logging.info(f"[NPS] Оценка обновлена: ID={rating_id}, новый рейтинг={rating}")
            else:
                # Создаём новую оценку
                logging.info(f"[NPS] Существующей оценки нет, создаём новую")
                data = {
                    "client_chat_id": client_chat_id,
                    "partner_chat_id": partner_chat_id,
                    "rating": rating,
                    "master_name": master_name,
                    "created_at": current_time,
                }
                result = self.client.from_('nps_ratings').insert(data).execute()
                if result.data:
                    logging.info(f"[NPS] Новая оценка создана: ID={result.data[0].get('id')}, рейтинг={rating}")
                else:
                    logging.error(f"[NPS] Ошибка: не получен ID после создания оценки")
            
            # Если оценка 10, создаём промоутера
            if rating == 10:
                logging.info(f"[NPS] Оценка 10 получена, создаём промоутера для клиента {client_chat_id}")
                promoter_created = self.create_promoter_from_nps_10(client_chat_id)
                if promoter_created:
                    logging.info(f"[NPS] Промоутер успешно создан для клиента {client_chat_id}")
                else:
                    logging.warning(f"[NPS] Не удалось создать промоутера для клиента {client_chat_id} (возможно, уже существует)")
                
                # Добавляем метрику в активный период лидерборда, если есть
                active_period = self.get_active_leaderboard_period()
                if active_period:
                    logging.info(f"[NPS] Добавляем бонус за NPS 10 в лидерборд период {active_period['id']}")
                    self.add_leaderboard_metric(
                        active_period['id'],
                        client_chat_id,
                        'nps_10_bonus',
                        50.0,  # Бонус за NPS 10
                        'Бонус за оценку NPS 10'
                    )
                else:
                    logging.info(f"[NPS] Активный период лидерборда не найден, бонус не добавлен")
            
            logging.info(f"[NPS] ✅ Оценка успешно записана: client={client_chat_id}, partner={partner_chat_id}, rating={rating}")
            return True
            
        except APIError as e:
            logging.error(f"[NPS] ❌ API Error recording NPS rating: client={client_chat_id}, partner={partner_chat_id}, rating={rating}, error={e}")
            return False
        except Exception as e:
            logging.error(f"[NPS] ❌ Unknown error recording NPS rating: client={client_chat_id}, partner={partner_chat_id}, rating={rating}, error={e}", exc_info=True)
            return False

    # -----------------------------------------------------------------
    # VII. МЕТОДЫ ДЛЯ РАБОТЫ С СООБЩЕНИЯМИ
    # -----------------------------------------------------------------

    def save_message(
        self, 
        client_chat_id: str, 
        partner_chat_id: str, 
        sender_type: str, 
        message_text: str = None,
        message_type: str = 'text',
        attachment_url: str = None,
        attachment_type: str = None,
        service_id: str = None,  # UUID в виде строки
        service_title: str = None
    ) -> Optional[int]:
        """Сохраняет сообщение в истории переписки между клиентом и партнёром.
        
        Args:
            client_chat_id: Chat ID клиента
            partner_chat_id: Chat ID партнёра
            sender_type: Тип отправителя ('client' или 'partner')
            message_text: Текст сообщения
            message_type: Тип сообщения ('text', 'qr_code', 'image', 'file')
            attachment_url: URL вложения (для QR-кодов, изображений, файлов)
            attachment_type: Тип вложения ('qr_code', 'image', 'file')
            service_id: ID услуги (если сообщение связано с услугой)
            service_title: Название услуги на момент отправки
        
        Returns:
            ID сохранённого сообщения или None в случае ошибки
        """
        if not self.client:
            return None
        
        try:
            data = {
                "client_chat_id": str(client_chat_id),
                "partner_chat_id": str(partner_chat_id),
                "sender_type": sender_type,
                "message_text": message_text,
                "message_type": message_type,
                "attachment_url": attachment_url,
                "attachment_type": attachment_type,
                "service_id": service_id,
                "service_title": service_title,
                "is_read": False
            }
            
            # Удаляем None значения
            data = {k: v for k, v in data.items() if v is not None}
            
            result = self.client.from_('messages').insert(data).execute()
            if result.data and len(result.data) > 0:
                message_id = result.data[0].get('id')
                logging.info(f"Message saved: ID={message_id}, client={client_chat_id}, partner={partner_chat_id}, sender={sender_type}")
                return message_id
            return None
        except Exception as e:
            logging.error(f"Error saving message: {e}", exc_info=True)
            return None

    def get_conversation(
        self, 
        client_chat_id: str, 
        partner_chat_id: str, 
        limit: int = 50,
        offset: int = 0
    ) -> list[dict]:
        """Получает историю переписки между клиентом и партнёром.
        
        Args:
            client_chat_id: Chat ID клиента
            partner_chat_id: Chat ID партнёра
            limit: Максимальное количество сообщений
            offset: Смещение для пагинации
        
        Returns:
            Список сообщений, отсортированных по дате (старые первыми)
        """
        if not self.client:
            return []
        
        try:
            result = self.client.from_('messages')\
                .select('*')\
                .eq('client_chat_id', str(client_chat_id))\
                .eq('partner_chat_id', str(partner_chat_id))\
                .order('created_at', desc=False)\
                .range(offset, offset + limit - 1)\
                .execute()
            
            return result.data or []
        except Exception as e:
            logging.error(f"Error getting conversation: {e}", exc_info=True)
            return []

    def mark_message_as_read(self, message_id: int) -> bool:
        """Отмечает сообщение как прочитанное.
        
        Args:
            message_id: ID сообщения
        
        Returns:
            True если успешно, False в случае ошибки
        """
        if not self.client:
            return False
        
        try:
            self.client.from_('messages')\
                .update({'is_read': True})\
                .eq('id', message_id)\
                .execute()
            return True
        except Exception as e:
            logging.error(f"Error marking message as read: {e}", exc_info=True)
            return False

    def mark_conversation_as_read(
        self, 
        client_chat_id: str, 
        partner_chat_id: str, 
        reader_type: str
    ) -> bool:
        """Отмечает все сообщения в переписке как прочитанные.
        
        Args:
            client_chat_id: Chat ID клиента
            partner_chat_id: Chat ID партнёра
            reader_type: Тип читателя ('client' или 'partner')
                        Отмечаются как прочитанные только сообщения от противоположной стороны
        
        Returns:
            True если успешно, False в случае ошибки
        """
        if not self.client:
            return False
        
        try:
            # Определяем, какие сообщения нужно отметить как прочитанные
            sender_type = 'partner' if reader_type == 'client' else 'client'
            
            self.client.from_('messages')\
                .update({'is_read': True})\
                .eq('client_chat_id', str(client_chat_id))\
                .eq('partner_chat_id', str(partner_chat_id))\
                .eq('sender_type', sender_type)\
                .eq('is_read', False)\
                .execute()
            
            return True
        except Exception as e:
            logging.error(f"Error marking conversation as read: {e}", exc_info=True)
            return False

    def get_unread_messages_count(
        self, 
        client_chat_id: str = None, 
        partner_chat_id: str = None
    ) -> int:
        """Получает количество непрочитанных сообщений.
        
        Args:
            client_chat_id: Chat ID клиента (если нужно для клиента)
            partner_chat_id: Chat ID партнёра (если нужно для партнёра)
        
        Returns:
            Количество непрочитанных сообщений
        """
        if not self.client:
            return 0
        
        try:
            query = self.client.from_('messages')\
                .select('id', count='exact')\
                .eq('is_read', False)
            
            if client_chat_id:
                query = query.eq('client_chat_id', str(client_chat_id))\
                            .eq('sender_type', 'partner')
            
            if partner_chat_id:
                query = query.eq('partner_chat_id', str(partner_chat_id))\
                            .eq('sender_type', 'client')
            
            result = query.execute()
            return result.count if hasattr(result, 'count') else len(result.data or [])
        except Exception as e:
            logging.error(f"Error getting unread messages count: {e}", exc_info=True)
            return 0

    def get_partner_conversations(self, partner_chat_id: str) -> list[dict]:
        """Получает список всех переписок партнёра с непрочитанными сообщениями.
        
        Args:
            partner_chat_id: Chat ID партнёра
        
        Returns:
            Список переписок с информацией о последнем сообщении и количестве непрочитанных
        """
        if not self.client:
            return []
        
        try:
            # Получаем все уникальные клиенты, с которыми есть переписка
            result = self.client.from_('messages')\
                .select('client_chat_id')\
                .eq('partner_chat_id', str(partner_chat_id))\
                .execute()
            
            if not result.data:
                return []
            
            client_ids = list(set([msg.get('client_chat_id') for msg in result.data if msg.get('client_chat_id')]))
            
            conversations = []
            for client_id in client_ids:
                # Получаем последнее сообщение
                last_msg_result = self.client.from_('messages')\
                    .select('*')\
                    .eq('client_chat_id', client_id)\
                    .eq('partner_chat_id', str(partner_chat_id))\
                    .order('created_at', desc=True)\
                    .limit(1)\
                    .execute()
                
                if last_msg_result.data:
                    last_msg = last_msg_result.data[0]
                    
                    # Получаем количество непрочитанных сообщений от этого клиента
                    unread_result = self.client.from_('messages')\
                        .select('id', count='exact')\
                        .eq('client_chat_id', client_id)\
                        .eq('partner_chat_id', str(partner_chat_id))\
                        .eq('sender_type', 'client')\
                        .eq('is_read', False)\
                        .execute()
                    
                    unread_count = unread_result.count if hasattr(unread_result, 'count') else len(unread_result.data or [])
                    
                    conversations.append({
                        'client_chat_id': client_id,
                        'last_message': last_msg,
                        'unread_count': unread_count
                    })
            
            return conversations
        except Exception as e:
            logging.error(f"Error getting partner conversations: {e}", exc_info=True)
            return []

    # ============================================
    # INSTAGRAM OUTREACH METHODS
    # ============================================
    
    def get_instagram_outreach_by_handle(self, instagram_handle: str) -> Optional[dict]:
        """
        Получает контакт outreach по Instagram handle
        
        Args:
            instagram_handle: Instagram handle (без @)
        
        Returns:
            dict или None: Данные контакта или None
        """
        if not self.client:
            return None
        
        instagram_handle = instagram_handle.lstrip('@')
        
        try:
            result = self.client.from_('instagram_outreach')\
                .select('*')\
                .eq('instagram_handle', instagram_handle)\
                .maybe_single()\
                .execute()
            return result.data if result.data else None
        except Exception as e:
            logging.error(f"Error getting Instagram outreach contact: {e}")
            return None
    
    def get_instagram_outreach_queue(self, limit: int = 10) -> list:
        """
        Получает очередь контактов для outreach
        
        Args:
            limit: Количество контактов
        
        Returns:
            list: Список контактов
        """
        if not self.client:
            return []
        
        try:
            result = self.client.from_('instagram_outreach')\
                .select('*')\
                .eq('outreach_status', 'NOT_CONTACTED')\
                .order('priority', desc=False)\
                .order('created_at', desc=False)\
                .limit(limit)\
                .execute()
            return result.data if result.data else []
        except Exception as e:
            logging.error(f"Error getting Instagram outreach queue: {e}")
            return []
    
    def get_instagram_outreach_stats(self) -> dict:
        """
        Получает статистику Instagram outreach
        
        Returns:
            dict: Статистика по статусам
        """
        if not self.client:
            return {}
        
        try:
            result = self.client.from_('instagram_outreach')\
                .select('outreach_status, messages_sent, response_time_hours')\
                .execute()
            
            contacts = result.data if result.data else []
            
            stats = {
                'total': len(contacts),
                'by_status': {},
                'avg_messages_sent': 0,
                'avg_response_time_hours': 0
            }
            
            total_messages = 0
            total_response_times = []
            
            for contact in contacts:
                status = contact.get('outreach_status', 'UNKNOWN')
                stats['by_status'][status] = stats['by_status'].get(status, 0) + 1
                
                messages = contact.get('messages_sent', 0)
                if messages:
                    total_messages += messages
                
                response_time = contact.get('response_time_hours')
                if response_time:
                    total_response_times.append(response_time)
            
            if stats['total'] > 0:
                stats['avg_messages_sent'] = round(total_messages / stats['total'], 2)
            
            if total_response_times:
                stats['avg_response_time_hours'] = round(sum(total_response_times) / len(total_response_times), 2)
            
            return stats
        except Exception as e:
            logging.error(f"Error getting Instagram outreach stats: {e}")
            return {}

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
                'category_group, ui_config, default_cashback_percent, default_referral_commission_percent, base_reward_percent'
            ).eq('chat_id', str(partner_chat_id)).single().execute()
            return response.data or {}
        except Exception as e:
            logging.error(f"Error getting partner config: {e}")
            return {}

    def get_partner_b2b_deals(self, partner_chat_id: str, as_source: bool = True, as_target: bool = True) -> List[dict]:
        """
        Получает список B2B сделок партнера.
        
        :param partner_chat_id: ID партнера
        :param as_source: Включить сделки, где партнер является источником (привел клиентов)
        :param as_target: Включить сделки, где партнер является целью (куда привели клиентов)
        :return: Список сделок
        """
        if not self.client: return []
        try:
            deals = []
            
            if as_source:
                # Сделки, где партнер привел клиентов к другим
                response_source = self.client.table('partner_deals').select('*').eq('source_partner_chat_id', str(partner_chat_id)).execute()
                if response_source.data:
                    deals.extend(response_source.data)
            
            if as_target:
                # Сделки, где к партнеру привели клиентов
                response_target = self.client.table('partner_deals').select('*').eq('target_partner_chat_id', str(partner_chat_id)).execute()
                if response_target.data:
                    deals.extend(response_target.data)
            
            # Фильтруем по сроку действия
            active_deals = []
            now = datetime.datetime.now(datetime.timezone.utc)
            for deal in deals:
                if deal.get('status') != 'active':
                    continue
                if deal.get('expires_at'):
                    try:
                        expires_str = deal['expires_at']
                        expires = datetime.datetime.fromisoformat(expires_str.replace('Z', '+00:00'))
                        if expires < now:
                            continue
                    except Exception:
                        pass
                active_deals.append(deal)
            
            return active_deals
        except Exception as e:
            logging.error(f"Error getting partner B2B deals: {e}")
            return []

    def update_partner_base_reward_percent(self, partner_chat_id: str, new_percent: float) -> bool:
        """
        Обновляет процент комиссионного фонда партнера (base_reward_percent).
        
        :param partner_chat_id: ID партнера
        :param new_percent: Новый процент (например, 0.05 для 5%)
        :return: True если успешно
        """
        if not self.client: return False
        if new_percent < 0 or new_percent > 1:
            logging.error(f"Invalid base_reward_percent: {new_percent} (must be between 0 and 1)")
            return False
        try:
            self.client.table('partners').update({
                'base_reward_percent': new_percent
            }).eq('chat_id', str(partner_chat_id)).execute()
            logging.info(f"Updated base_reward_percent for partner {partner_chat_id} to {new_percent}")
            return True
        except Exception as e:
            logging.error(f"Error updating base_reward_percent: {e}")
            return False

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

    def _calculate_accrual_points_with_deals(self, client_chat_id: int, partner_chat_id: int, raw_amount: float, currency: str = 'USD') -> tuple[float, str]:
        """
        Рассчитывает баллы с учетом B2B Deals в USD эквиваленте.
        
        ✅ Возвращает баллы в USD эквиваленте (float)
        
        Returns:
            tuple: (points_usd, description_suffix)
        """
        if raw_amount <= 0: 
            return 0.0, ""

        # ✅ 1. Конвертируем сумму в USD
        amount_usd = raw_amount
        if currency != 'USD':
            try:
                from currency_utils import convert_currency
                amount_usd = convert_currency(
                    raw_amount,
                    from_currency=currency,
                    to_currency='USD',
                    supabase_client=self.client
                )
            except Exception as e:
                logging.warning(f"Ошибка конвертации {currency}→USD в _calculate_accrual_points_with_deals: {e}")
                # Используем raw_amount (предполагаем USD)

        # 2. Получаем источник реферала
        source_partner_id = self._get_referral_source(str(client_chat_id))
        
        # 3. Ищем сделку (Deal)
        deal = None
        if source_partner_id and str(source_partner_id) != str(partner_chat_id):
            deal = self.get_active_deal(source_partner_id, str(partner_chat_id))
            
        # 4. Определяем процент кэшбэка
        percent = 0.05  # Базовый дефолт 5%
        deal_info = ""
        
        if deal:
            # Если есть сделка, берем процент оттуда
            percent = float(deal.get('client_cashback_percent', 5.0)) / 100.0
            deal_info = " (B2B Deal 🔥)"
        else:
            # Иначе берем дефолтный процент партнера или глобальный
            partner_config = self.get_partner_config(str(partner_chat_id))
            percent = float(partner_config.get('default_cashback_percent', 5.0)) / 100.0
            
        # ✅ 5. Расчет: баллы в USD
        points_usd = amount_usd * percent
        return points_usd, deal_info

    # Переопределяем execute_transaction для использования новой логики
    def execute_transaction_v2(self, client_chat_id: int, partner_chat_id: int, txn_type: str, raw_amount: float, allow_queue: bool = True) -> dict:
        """
        Версия 2.0 с поддержкой B2B Deals
        """
        # ... (Код аналогичен execute_transaction, но вызывает _calculate_accrual_points_with_deals)
        # Для минимизации изменений в огромном файле, я предложу заменить тело execute_transaction
        pass

    # -------------------------------------------------------------------------
    # Платформенные продукты (кросс-абонементы)
    # -------------------------------------------------------------------------

    def get_platform_products_list(self, city: Optional[str] = None, active_only: bool = True) -> List[dict]:
        """Список продуктов платформы. По city — фильтр по городу (None = все)."""
        if not self.client:
            return []
        try:
            q = self.client.from_('platform_products').select('*')
            if active_only:
                q = q.eq('is_active', True)
            if city is not None:
                q = q.eq('city', city)
            r = q.order('id').execute()
            return list(r.data) if r.data else []
        except Exception as e:
            logging.error(f"get_platform_products_list: {e}")
            return []

    def get_platform_product(self, product_id: int) -> Optional[dict]:
        """Один продукт по id."""
        if not self.client:
            return None
        try:
            r = self.client.from_('platform_products').select('*').eq('id', product_id).limit(1).execute()
            return r.data[0] if r.data else None
        except Exception as e:
            logging.error(f"get_platform_product: {e}")
            return None

    def get_platform_product_partners(self, product_id: int, active_only: bool = True) -> List[dict]:
        """Партнёры, входящие в продукт (с payout_per_visit и лимитами)."""
        if not self.client:
            return []
        try:
            q = self.client.from_('platform_product_partners').select('*').eq('product_id', product_id)
            if active_only:
                q = q.eq('is_active', True)
            r = q.execute()
            return list(r.data) if r.data else []
        except Exception as e:
            logging.error(f"get_platform_product_partners: {e}")
            return []

    def check_platform_product_visit_allowed(
        self,
        client_chat_id: str,
        partner_chat_id: str,
        product_id: int,
    ) -> dict:
        """
        Проверяет, может ли клиент пройти к партнёру по продукту (кросс-абонемент).
        Returns: {
            'allowed': bool,
            'subscription': dict | None,
            'error': str (если not allowed)
        }
        """
        if not self.client:
            return {"allowed": False, "subscription": None, "error": "DB is not initialized."}
        try:
            now = datetime.datetime.now(datetime.timezone.utc)
            # Активная подписка по этому продукту у клиента
            sub_r = (
                self.client.from_('client_product_subscriptions')
                .select('*')
                .eq('client_chat_id', str(client_chat_id))
                .eq('product_id', product_id)
                .eq('status', 'active')
                .gte('valid_until', now.isoformat())
                .order('valid_until', desc=True)
                .limit(1)
                .execute()
            )
            if not sub_r.data:
                return {"allowed": False, "subscription": None, "error": "Нет активного абонемента по этому продукту."}
            sub = sub_r.data[0]
            # Партнёр входит в продукт
            pp_r = (
                self.client.from_('platform_product_partners')
                .select('*')
                .eq('product_id', product_id)
                .eq('partner_chat_id', str(partner_chat_id))
                .eq('is_active', True)
                .limit(1)
                .execute()
            )
            if not pp_r.data:
                return {"allowed": False, "subscription": sub, "error": "Эта студия не входит в ваш абонемент."}
            pp = pp_r.data[0]
            product = self.get_platform_product(product_id)
            if not product:
                return {"allowed": False, "subscription": sub, "error": "Продукт не найден."}
            # Лимит общих визитов по подписке
            max_total = product.get('max_visits_total')
            if max_total is not None and sub.get('visits_total_used', 0) >= max_total:
                return {"allowed": False, "subscription": sub, "error": "Исчерпан лимит визитов по абонементу."}
            # Лимит визитов к этому партнёру по подписке
            limit_per_partner = pp.get('visit_limit_per_client')
            if limit_per_partner is not None:
                count_r = (
                    self.client.from_('product_visits')
                    .select('id')
                    .eq('subscription_id', sub['id'])
                    .eq('partner_chat_id', str(partner_chat_id))
                    .eq('status', 'confirmed')
                    .execute()
                )
                count = len(count_r.data or [])
                if count >= limit_per_partner:
                    return {"allowed": False, "subscription": sub, "error": f"Лимит визитов в эту студию ({limit_per_partner}) исчерпан."}
            return {"allowed": True, "subscription": sub, "error": None}
        except Exception as e:
            logging.error(f"check_platform_product_visit_allowed: {e}", exc_info=True)
            return {"allowed": False, "subscription": None, "error": str(e)}

    def record_platform_product_visit(
        self,
        client_chat_id: str,
        partner_chat_id: str,
        product_id: int,
        source: str = 'bot_manual',
    ) -> dict:
        """
        Проверяет право и записывает визит по кросс-абонементу. Начисляет payout в product_visits.
        Returns: {
            'success': bool,
            'visit': dict | None,
            'error': str (если success=False)
        }
        """
        if not self.client:
            return {"success": False, "visit": None, "error": "DB is not initialized."}
        try:
            check = self.check_platform_product_visit_allowed(client_chat_id, partner_chat_id, product_id)
            if not check["allowed"]:
                return {"success": False, "visit": None, "error": check.get("error", "Визит не разрешён.")}
            sub = check["subscription"]
            pp_list = self.get_platform_product_partners(product_id)
            pp = next((p for p in pp_list if str(p.get('partner_chat_id')) == str(partner_chat_id)), None)
            if not pp:
                return {"success": False, "visit": None, "error": "Партнёр не найден в продукте."}
            payout_amount = float(pp.get('payout_per_visit', 0))
            payout_currency = 'RUB'
            visit_row = {
                'subscription_id': sub['id'],
                'product_id': product_id,
                'client_chat_id': str(client_chat_id),
                'partner_chat_id': str(partner_chat_id),
                'source': source,
                'status': 'confirmed',
                'payout_amount': payout_amount,
                'payout_currency': payout_currency,
                'payout_status': 'not_processed',
            }
            ins = self.client.from_('product_visits').insert(visit_row).execute()
            if not ins.data:
                return {"success": False, "visit": None, "error": "Не удалось создать запись визита."}
            visit = ins.data[0]
            # Увеличить visits_total_used у подписки
            new_used = (sub.get('visits_total_used') or 0) + 1
            self.client.from_('client_product_subscriptions').update({
                'visits_total_used': new_used,
            }).eq('id', sub['id']).execute()
            return {"success": True, "visit": visit, "error": None}
        except Exception as e:
            logging.error(f"record_platform_product_visit: {e}", exc_info=True)
            return {"success": False, "visit": None, "error": str(e)}

    def get_client_active_platform_subscriptions(self, client_chat_id: str) -> List[dict]:
        """Активные подписки клиента на продукты платформы."""
        if not self.client:
            return []
        try:
            now = datetime.datetime.now(datetime.timezone.utc)
            r = (
                self.client.from_('client_product_subscriptions')
                .select('*, platform_products(name, description, product_type, duration_days, max_visits_total)')
                .eq('client_chat_id', str(client_chat_id))
                .eq('status', 'active')
                .gte('valid_until', now.isoformat())
                .order('valid_until')
                .execute()
            )
            return list(r.data) if r.data else []
        except Exception as e:
            logging.error(f"get_client_active_platform_subscriptions: {e}")
            return []

    def create_client_product_subscription(
        self,
        client_chat_id: str,
        product_id: int,
        purchase_amount: Optional[float] = None,
        purchase_currency: Optional[str] = None,
        valid_from: Optional[datetime.datetime] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        """
        Создаёт подписку клиента на продукт (после оплаты).
        valid_from/valid_until считаются по product.duration_days если не переданы.
        Returns: {'success': bool, 'subscription': dict | None, 'error': str}
        """
        if not self.client:
            return {"success": False, "subscription": None, "error": "DB is not initialized."}
        try:
            product = self.get_platform_product(product_id)
            if not product or not product.get('is_active'):
                return {"success": False, "subscription": None, "error": "Продукт не найден или неактивен."}
            now = datetime.datetime.now(datetime.timezone.utc)
            start = valid_from if valid_from is not None else now
            if getattr(start, 'tzinfo', None) is None and hasattr(start, 'replace'):
                start = start.replace(tzinfo=datetime.timezone.utc)
            duration_days = product.get('duration_days') or 30
            end = start + datetime.timedelta(days=duration_days)
            row = {
                'client_chat_id': str(client_chat_id),
                'product_id': product_id,
                'purchase_amount': purchase_amount,
                'purchase_currency': purchase_currency or product.get('price_currency', 'RUB'),
                'valid_from': start.isoformat() if hasattr(start, 'isoformat') else str(start),
                'valid_until': end.isoformat() if hasattr(end, 'isoformat') else str(end),
                'status': 'active',
                'visits_total_used': 0,
                'metadata': metadata or {},
            }
            ins = self.client.from_('client_product_subscriptions').insert(row).execute()
            if not ins.data:
                return {"success": False, "subscription": None, "error": "Не удалось создать подписку."}
            return {"success": True, "subscription": ins.data[0], "error": None}
        except Exception as e:
            logging.error(f"create_client_product_subscription: {e}", exc_info=True)
            return {"success": False, "subscription": None, "error": str(e)}

    def get_partner_product_visits_summary(
        self,
        partner_chat_id: str,
        period_start: Optional[datetime.date] = None,
        period_end: Optional[datetime.date] = None,
    ) -> dict:
        """
        Сводка по визитам и выплатам партнёра за период (для партнёрского кабинета).
        Returns: {'total_visits': int, 'total_payout': float, 'currency': str, 'visits': list}
        """
        if not self.client:
            return {"total_visits": 0, "total_payout": 0.0, "currency": "RUB", "visits": []}
        try:
            q = (
                self.client.from_('product_visits')
                .select('*')
                .eq('partner_chat_id', str(partner_chat_id))
                .eq('status', 'confirmed')
            )
            if period_start:
                q = q.gte('visited_at', period_start.isoformat())
            if period_end:
                q = q.lte('visited_at', period_end.isoformat())
            r = q.order('visited_at', desc=True).execute()
            visits = list(r.data) if r.data else []
            total_payout = sum(float(v.get('payout_amount', 0)) for v in visits)
            currency = visits[0].get('payout_currency', 'RUB') if visits else 'RUB'
            return {"total_visits": len(visits), "total_payout": total_payout, "currency": currency, "visits": visits}
        except Exception as e:
            logging.error(f"get_partner_product_visits_summary: {e}")
            return {"total_visits": 0, "total_payout": 0.0, "currency": "RUB", "visits": []}

    def aggregate_platform_product_payouts(
        self,
        period_start: datetime.date,
        period_end: datetime.date,
    ) -> dict:
        """
        Собирает визиты с payout_status='not_processed' за период, создаёт batch и items,
        обновляет product_visits.payout_batch_id и payout_status.
        Returns: {'success': bool, 'batch_id': int | None, 'items_count': int, 'error': str}
        """
        if not self.client:
            return {"success": False, "batch_id": None, "items_count": 0, "error": "DB is not initialized."}
        try:
            start_iso = period_start.isoformat()
            end_iso = period_end.isoformat()
            r = (
                self.client.from_('product_visits')
                .select('id, partner_chat_id, payout_amount, payout_currency')
                .eq('payout_status', 'not_processed')
                .eq('status', 'confirmed')
                .gte('visited_at', start_iso)
                .lte('visited_at', end_iso)
                .execute()
            )
            visits = list(r.data) if r.data else []
            if not visits:
                return {"success": True, "batch_id": None, "items_count": 0, "error": None}
            batch_row = {'period_start': start_iso, 'period_end': end_iso, 'status': 'draft'}
            batch_ins = self.client.from_('partner_payout_batches').insert(batch_row).execute()
            if not batch_ins.data:
                return {"success": False, "batch_id": None, "items_count": 0, "error": "Не удалось создать batch."}
            batch_id = batch_ins.data[0]['id']
            by_partner: Dict[str, Dict[str, Any]] = {}
            for v in visits:
                pid = str(v['partner_chat_id'])
                if pid not in by_partner:
                    by_partner[pid] = {'total_visits': 0, 'total_payout_amount': 0, 'currency': v.get('payout_currency', 'RUB')}
                by_partner[pid]['total_visits'] += 1
                by_partner[pid]['total_payout_amount'] += float(v.get('payout_amount', 0))
            for pid, agg in by_partner.items():
                self.client.from_('partner_payout_items').insert({
                    'batch_id': batch_id,
                    'partner_chat_id': pid,
                    'total_visits': agg['total_visits'],
                    'total_payout_amount': round(agg['total_payout_amount'], 2),
                    'currency': agg['currency'],
                    'status': 'pending',
                }).execute()
            visit_ids = [v['id'] for v in visits]
            for vid in visit_ids:
                self.client.from_('product_visits').update({
                    'payout_status': 'included_in_batch',
                    'payout_batch_id': batch_id,
                }).eq('id', vid).execute()
            return {"success": True, "batch_id": batch_id, "items_count": len(by_partner), "error": None}
        except Exception as e:
            logging.error(f"aggregate_platform_product_payouts: {e}", exc_info=True)
            return {"success": False, "batch_id": None, "items_count": 0, "error": str(e)}
