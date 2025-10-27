# client_handler.py (ФИНАЛЬНАЯ ВЕРСИЯ - КЛИЕНТСКИЙ ХАБ С NPS И РЕФЕРАЛАМИ)

import telebot
from telebot import types
import os
import sys
import re # <-- НОВЫЙ ИМПОРТ
import asyncio
from dotenv import load_dotenv
from logger_config import get_bot_logger, log_exception

load_dotenv()

sys.path.append(os.path.dirname(__file__))
from supabase_manager import SupabaseManager
from ai_helper import get_ai_support_answer

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

BASE_DOMAIN = "https://loyalitybot.vercel.app"

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

        markup = types.InlineKeyboardMarkup()
        webapp_btn = types.InlineKeyboardButton(
            "🚀 Открыть приложение",
            web_app=types.WebAppInfo(url=BASE_DOMAIN)
        )
        markup.add(webapp_btn)

        client_bot.send_message(
            chat_id,
            "👋 **Добро пожаловать в LoyalityBot!**\n\n"
            "💰 Накапливайте баллы за покупки\n"
            "🎁 Обменивайте на услуги и скидки\n"
            "📊 Отслеживайте историю операций\n\n"
            "Нажмите кнопку ниже для открытия приложения:",
            reply_markup=markup,
            parse_mode='Markdown'
        )
        return

    # --- 4. ЛОГИКА: НЕЗАРЕГИСТРИРОВАННЫЙ КЛИЕНТ (БЕЗ РЕФЕРАЛА) ---
    # Предлагаем открыть приложение для регистрации
    markup = types.InlineKeyboardMarkup()
    webapp_btn = types.InlineKeyboardButton(
        "🚀 Открыть приложение",
        web_app=types.WebAppInfo(url=BASE_DOMAIN)
    )
    markup.add(webapp_btn)

    client_bot.send_message(
        chat_id,
        "👋 **Добро пожаловать в LoyalityBot!**\n\n"
        "🎯 Присоединяйтесь к программе лояльности:\n"
        "• Накапливайте баллы за каждую покупку\n"
        "• Получайте эксклюзивные скидки\n"
        "• Обменивайте баллы на услуги\n\n"
        "Нажмите кнопку ниже для начала:",
        reply_markup=markup,
        parse_mode='Markdown'
    )

# ------------------------------------
# AI ПОДДЕРЖКА
# ------------------------------------

@client_bot.message_handler(commands=['ask', 'спросить'])
def handle_ask_command(message):
    """Обработчик команды /ask - запрос к AI помощнику"""
    chat_id = str(message.chat.id)
    logger.info(f"Клиент {chat_id} использовал команду /ask")
    
    client_bot.send_message(
        chat_id,
        "🤖 **AI Помощник**\n\n"
        "Задайте свой вопрос о программе лояльности, и я постараюсь помочь!\n\n"
        "Например:\n"
        "• Как накопить баллы?\n"
        "• Где найти партнеров?\n"
        "• Как обменять баллы?\n\n"
        "Или начните вопрос с символа **?**",
        parse_mode='Markdown'
    )


@client_bot.message_handler(func=lambda message: message.text and message.text.startswith('?'))
def handle_ai_question(message):
    """Обработчик вопросов, начинающихся с ?"""
    chat_id = str(message.chat.id)
    question = message.text[1:].strip()  # Убираем "?" из начала
    
    if not question:
        client_bot.send_message(chat_id, "Пожалуйста, укажите ваш вопрос после символа ?")
        return
    
    logger.info(f"AI вопрос от клиента {chat_id}: {question}")
    
    # Показываем, что бот "думает"
    thinking_msg = client_bot.send_message(chat_id, "🤔 Думаю...")
    
    try:
        # Получаем ответ от AI (синхронная обертка для async функции)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        answer = loop.run_until_complete(get_ai_support_answer(question))
        loop.close()
        
        # Удаляем сообщение "Думаю..."
        try:
            client_bot.delete_message(chat_id, thinking_msg.message_id)
        except:
            pass
        
        # Отправляем ответ
        client_bot.send_message(
            chat_id,
            f"🤖 **AI Помощник:**\n\n{answer}\n\n"
            f"_Если нужна дополнительная помощь, напишите 'поддержка'_",
            parse_mode='Markdown'
        )
        
        logger.info(f"AI ответ отправлен клиенту {chat_id}")
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка получения AI ответа для клиента {chat_id}")
        
        try:
            client_bot.delete_message(chat_id, thinking_msg.message_id)
        except:
            pass
        
        client_bot.send_message(
            chat_id,
            "😔 Извините, сейчас я не могу ответить на ваш вопрос.\n\n"
            "Попробуйте позже или напишите 'поддержка' для связи с оператором."
        )


@client_bot.message_handler(func=lambda message: message.text and message.text.lower() == 'поддержка')
def handle_support_request(message):
    """Обработчик запроса связи с поддержкой"""
    chat_id = str(message.chat.id)
    logger.info(f"Клиент {chat_id} запросил поддержку")
    
    client_bot.send_message(
        chat_id,
        "📞 **Связь с поддержкой**\n\n"
        "Напишите ваш вопрос или проблему, и наш оператор свяжется с вами в ближайшее время.\n\n"
        "⏰ Время ответа: обычно до 1 часа\n"
        "📧 Email: support@loyalitybot.com",
        parse_mode='Markdown'
    )


@client_bot.message_handler(func=lambda message: True)
def handle_all_messages(message):
    # Предотвращаем потерю сообщений, направляя клиента на /start
    client_bot.send_message(message.chat.id,
                             "Пожалуйста, начните с команды /start.\n\n"
                             "💡 Подсказка: Для вопросов используйте команду /ask или начните сообщение с **?**",
                             parse_mode='Markdown')

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