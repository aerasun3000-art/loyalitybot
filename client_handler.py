# client_handler.py (ФИНАЛЬНАЯ ВЕРСИЯ - КЛИЕНТСКИЙ ХАБ С NPS И РЕФЕРАЛАМИ)

import telebot
from telebot import types
import os
import sys
import re # <-- НОВЫЙ ИМПОРТ
from dotenv import load_dotenv
from logger_config import get_bot_logger, log_exception

load_dotenv()

sys.path.append(os.path.dirname(__file__))
from supabase_manager import SupabaseManager

# Инициализация логгера
logger = get_bot_logger('client_bot')

# --- Константы и Инициализация ---
CLIENT_TOKEN = os.environ.get('TOKEN_CLIENT')
if not CLIENT_TOKEN:
    logger.critical("TOKEN_CLIENT не найден в окружении")
    raise ValueError("FATAL: TOKEN_CLIENT не найден в окружении.")

logger.info("Инициализация клиентского бота...")
client_bot = telebot.TeleBot(CLIENT_TOKEN)

try:
    sm = SupabaseManager()
    logger.info("SupabaseManager успешно инициализирован")
except Exception as e:
    log_exception(logger, e, "Ошибка инициализации SupabaseManager")
    raise

BASE_DOMAIN = "https://tma-bot-rewards.lovable.app"

# Регулярное выражение для парсинга реферальной ссылки
# Ожидаемый формат: /start partner_<ID>
REFERRAL_PATTERN = re.compile(r'partner_(\d+)', re.IGNORECASE)

# --- ГЛОБАЛЬНОЕ ХРАНИЛИЩЕ ДЛЯ NPS ---
# Ключ: chat_id клиента (str), Значение: chat_id партнера (str)
LAST_TRANSACTION_PARTNER = {}


# ------------------------------------
# ЛОГИКА NPS (БЕЗ ИЗМЕНЕНИЙ)
# ------------------------------------

def send_nps_request(chat_id: str, partner_chat_id: str):
    """Отправляет клиенту запрос на оценку NPS."""
    chat_id = str(chat_id)

    LAST_TRANSACTION_PARTNER[chat_id] = partner_chat_id

    markup = types.InlineKeyboardMarkup(row_width=6)

    row1 = [types.InlineKeyboardButton(str(i), callback_data=f"nps_rate_{i}") for i in range(6)]
    row2 = [types.InlineKeyboardButton(str(i), callback_data=f"nps_rate_{i}") for i in range(6, 11)]

    markup.add(*row1)
    markup.add(*row2)

    client_bot.send_message(
        chat_id,
        "⭐ **Оцените, пожалуйста, качество обслуживания!**\n\n"
        "Насколько вероятно, что вы порекомендуете нас другу или коллеге?\n"
        "(0 - крайне маловероятно, 10 - обязательно порекомендую)",
        reply_markup=markup,
        parse_mode='Markdown'
    )


@client_bot.callback_query_handler(func=lambda call: call.data.startswith('nps_rate_'))
def callback_nps_rating(call):
    client_chat_id = str(call.message.chat.id)
    
    try:
        rating = int(call.data.split('_')[-1])
        partner_chat_id = LAST_TRANSACTION_PARTNER.pop(client_chat_id, 'SYSTEM')
        
        logger.info(f"Клиент {client_chat_id} поставил NPS оценку {rating} для партнёра {partner_chat_id}")

        success = sm.record_nps_rating(client_chat_id, partner_chat_id, rating, master_name='N/A')

        if success:
            client_bot.edit_message_text(
                chat_id=client_chat_id,
                message_id=call.message.message_id,
                text=f"⭐ Спасибо за вашу оценку: **{rating}**!\n"
                     "Ваше мнение помогает нам стать лучше.",
                parse_mode='Markdown'
            )
            logger.info(f"NPS оценка {rating} успешно записана для клиента {client_chat_id}")
        else:
            logger.error(f"Не удалось записать NPS оценку для клиента {client_chat_id}")
            client_bot.edit_message_text(
                chat_id=client_chat_id,
                message_id=call.message.message_id,
                text="❌ Извините, произошла ошибка при записи вашей оценки.",
            )

        client_bot.answer_callback_query(call.id)
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка обработки NPS callback для клиента {client_chat_id}")
        try:
            client_bot.answer_callback_query(call.id, "Произошла ошибка. Попробуйте позже.")
        except:
            pass


# ------------------------------------
# ГЛАВНЫЙ ОБРАБОТЧИК /START (ОБНОВЛЕНО)
# ------------------------------------

@client_bot.message_handler(commands=['start', 'help'])
def handle_new_user_start(message):
    chat_id = str(message.chat.id)
    text = message.text
    
    logger.info(f"Клиент {chat_id} запустил бота с текстом: {text}")

    # --- 1. ПАРСИНГ РЕФЕРАЛЬНОЙ ССЫЛКИ ---
    partner_id = None
    # Ищем совпадение в тексте сообщения, пропуская '/start '
    match = REFERRAL_PATTERN.search(text)
    if match:
        partner_id = match.group(1)
        logger.info(f"Обнаружен partner_id из реферальной ссылки: {partner_id}")

    try:
        client_exists = sm.client_exists(chat_id)
    except Exception as e:
        log_exception(logger, e, f"Ошибка проверки существования клиента {chat_id}")
        client_bot.send_message(chat_id, "Произошла ошибка при доступе к системе. Попробуйте позже.")
        return

    # --- 2. ЛОГИКА: РЕГИСТРАЦИЯ ПО РЕФЕРАЛУ (АТОМАРНАЯ) ---
    if not client_exists and partner_id:
        try:
            # Используем согласованный метод для атомарной регистрации
            result = sm.register_client_via_link(chat_id, partner_id, phone=None, name=None)

            if result and not result[1]:  # Успешная регистрация (нет ошибки)
                # Отправляем приветственное сообщение с бонусом
                bonus_amount = sm.WELCOME_BONUS_AMOUNT
                logger.info(f"Клиент {chat_id} успешно зарегистрирован по ссылке партнёра {partner_id}")
                client_bot.send_message(
                    chat_id,
                    f"🎉 **Добро пожаловать!**\n\n"
                    f"Вы зарегистрировались по ссылке партнера и получили **{bonus_amount}** приветственных баллов!",
                    parse_mode='Markdown'
                )
                # Обновляем флаг, чтобы перейти к логике "Существующий клиент"
                client_exists = True 
            else:
                # Обработка ошибки
                error_msg = result[1] if result else "Неизвестная ошибка"
                logger.error(f"Ошибка регистрации клиента {chat_id} по ссылке партнёра {partner_id}: {error_msg}")
                client_bot.send_message(chat_id, f"Извините, произошла ошибка регистрации: {error_msg}. Пожалуйста, попробуйте команду /start еще раз.")
        except Exception as e:
            log_exception(logger, e, f"Критическая ошибка при регистрации клиента {chat_id} через ссылку")
            client_bot.send_message(chat_id, "Произошла системная ошибка. Обратитесь в поддержку.")
    
    # --- 3. ЛОГИКА: СУЩЕСТВУЮЩИЙ КЛИЕНТ (включая только что зарегистрированных) ---
    if client_exists:

        # --- ЛОГИКА: ОБНОВЛЕНИЕ ВРЕМЕННОГО ID (СУЩЕСТВУЮЩАЯ ЛОГИКА) ---
        client_data = sm.get_client_details_for_partner(chat_id)

        # Если chat_id начинается с VIA_PARTNER_, значит, клиент впервые нажал /start
        if client_data and client_data.get('chat_id', '').startswith('VIA_PARTNER_'):
            temp_id = client_data['chat_id']
            # Обновляем chat_id в таблицах. Поиск идет по temp_id.
            if sm.update_client_chat_id(old_id=temp_id, new_id=chat_id):
                print(f"CLIENT_HANDLER: Обновлен chat_id клиента с {temp_id} на {chat_id}")

        # ---------------------------------------------

        CLIENT_URL = f"{BASE_DOMAIN}/client-dashboard?chat_id={chat_id}#home"
        markup = types.InlineKeyboardMarkup()
        btn_dashboard = types.InlineKeyboardButton("🔑 Открыть Личный Кабинет", url=CLIENT_URL)
        markup.add(btn_dashboard)

        client_bot.send_message(chat_id,
                                 "👋 Здравствуйте! Для всех операций используйте ваш **Личный Кабинет** (Frontend):",
                                 reply_markup=markup,
                                 parse_mode='Markdown')
        return

    # --- 4. ЛОГИКА: НЕЗАРЕГИСТРИРОВАННЫЙ КЛИЕНТ (БЕЗ РЕФЕРАЛА) ---
    # 2. Если клиент НЕ существует: Предлагаем регистрацию или заявку партнера
    CLIENT_URL = f"{BASE_DOMAIN}/register?chat_id={chat_id}&role=client"
    PARTNER_URL = f"{BASE_DOMAIN}/partner-apply?chat_id={chat_id}&role=partner"

    markup = types.InlineKeyboardMarkup()
    btn_client = types.InlineKeyboardButton("✅ Я Клиент (Начать регистрацию)", url=CLIENT_URL)
    btn_partner = types.InlineKeyboardButton("🤝 Я Хочу стать Партнером", url=PARTNER_URL)
    markup.add(btn_client)
    markup.add(btn_partner)

    client_bot.send_message(chat_id,
                             "👋 Добро пожаловать! Для начала работы нажмите кнопку ниже.",
                             reply_markup=markup,
                             parse_mode='Markdown')

@client_bot.message_handler(func=lambda message: True)
def handle_all_messages(message):
    # Предотвращаем потерю сообщений, направляя клиента на /start
    client_bot.send_message(message.chat.id,
                             "Пожалуйста, начните с команды /start.")

if __name__ == '__main__':
    logger.info("=== Клиентский бот запущен ===")
    while True:
        try:
            client_bot.polling(none_stop=True, interval=1, timeout=20)
        except KeyboardInterrupt:
            logger.info("Бот остановлен пользователем (KeyboardInterrupt)")
            break
        except Exception as e:
            log_exception(logger, e, "Ошибка соединения с Telegram API")
            logger.warning("Переподключение через 5 секунд...")
            import time
            time.sleep(5)