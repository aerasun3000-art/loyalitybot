# client_handler.py (ФИНАЛЬНАЯ ВЕРСИЯ - КЛИЕНТСКИЙ ХАБ С NPS И РЕФЕРАЛАМИ)

import telebot
from telebot import types
import os
import sys
import re # <-- НОВЫЙ ИМПОРТ
import asyncio
import json
import datetime
import io
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


# ------------------------------------
# GDPR COMPLIANCE
# ------------------------------------

@client_bot.message_handler(commands=['export_data', 'экспорт_данных'])
def handle_export_data(message):
    """Обработчик команды экспорта данных (GDPR Right to Data Portability)"""
    chat_id = str(message.chat.id)
    logger.info(f"Клиент {chat_id} запросил экспорт своих данных (GDPR)")
    
    client_bot.send_message(
        chat_id,
        "📦 **Экспорт ваших данных**\n\n"
        "Готовлю полный экспорт всех ваших данных...\n\n"
        "⏳ Это может занять несколько секунд.",
        parse_mode='Markdown'
    )
    
    try:
        # Экспортируем данные пользователя
        user_data = db.export_user_data(chat_id)
        
        if not user_data:
            client_bot.send_message(
                chat_id,
                "❌ **Ошибка экспорта**\n\n"
                "Не удалось экспортировать ваши данные. Пожалуйста, попробуйте позже или свяжитесь с поддержкой.",
                parse_mode='Markdown'
            )
            return
        
        # Конвертируем в JSON и отправляем как файл
        import json
        import io
        
        json_data = json.dumps(user_data, indent=2, ensure_ascii=False, default=str)
        json_file = io.BytesIO(json_data.encode('utf-8'))
        json_file.name = f'user_data_{chat_id}_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        
        client_bot.send_document(
            chat_id,
            json_file,
            caption=(
                "✅ **Экспорт завершен**\n\n"
                "Ваши данные экспортированы в соответствии с GDPR.\n\n"
                "📄 Файл содержит:\n"
                "• Профиль клиента\n"
                "• Данные партнера (если применимо)\n"
                "• История транзакций\n"
                "• Заявки на партнерство\n"
                "• Услуги и акции (для партнеров)\n\n"
                "🔒 Храните файл в безопасном месте."
            ),
            parse_mode='Markdown'
        )
        
        logger.info(f"Successfully sent data export to {chat_id}")
        
    except Exception as e:
        log_exception(logger, e, f"Error exporting data for {chat_id}")
        client_bot.send_message(
            chat_id,
            "❌ **Ошибка**\n\n"
            "Произошла ошибка при экспорте данных. Пожалуйста, попробуйте позже.",
            parse_mode='Markdown'
        )


@client_bot.message_handler(commands=['delete_account', 'удалить_аккаунт'])
def handle_delete_account_request(message):
    """Обработчик запроса на удаление аккаунта (GDPR Right to be Forgotten)"""
    chat_id = str(message.chat.id)
    logger.info(f"Клиент {chat_id} запросил удаление аккаунта (GDPR)")
    
    # Создаем клавиатуру для подтверждения
    markup = types.InlineKeyboardMarkup()
    markup.row(
        types.InlineKeyboardButton("✅ Да, удалить все", callback_data=f"gdpr_delete_confirm_{chat_id}"),
        types.InlineKeyboardButton("❌ Отмена", callback_data="gdpr_delete_cancel")
    )
    
    client_bot.send_message(
        chat_id,
        "⚠️ **УДАЛЕНИЕ АККАУНТА**\n\n"
        "Вы уверены, что хотите удалить все свои данные?\n\n"
        "**Будет удалено:**\n"
        "❌ Ваш профиль и баланс баллов\n"
        "❌ Все услуги и акции (если вы партнер)\n"
        "❌ Заявки на партнерство\n"
        "⚠️ История транзакций будет анонимизирована\n\n"
        "**⚠️ ЭТО ДЕЙСТВИЕ НЕОБРАТИМО!**\n\n"
        "Вы действительно хотите продолжить?",
        parse_mode='Markdown',
        reply_markup=markup
    )


@client_bot.callback_query_handler(func=lambda call: call.data.startswith('gdpr_delete_'))
def handle_gdpr_delete_callback(call):
    """Обработчик подтверждения удаления аккаунта"""
    chat_id = str(call.message.chat.id)
    
    if call.data == "gdpr_delete_cancel":
        client_bot.edit_message_text(
            "❎ **Отменено**\n\n"
            "Удаление аккаунта отменено. Ваши данные сохранены.",
            chat_id=chat_id,
            message_id=call.message.message_id,
            parse_mode='Markdown'
        )
        logger.info(f"Client {chat_id} cancelled account deletion")
        return
    
    if call.data.startswith("gdpr_delete_confirm_"):
        client_bot.edit_message_text(
            "🗑️ **Удаление данных**\n\n"
            "Удаляю все ваши данные из системы...\n\n"
            "⏳ Пожалуйста, подождите.",
            chat_id=chat_id,
            message_id=call.message.message_id,
            parse_mode='Markdown'
        )
        
        try:
            # Удаляем данные пользователя
            deletion_results = db.delete_user_data(chat_id)
            
            if deletion_results.get('success'):
                client_bot.edit_message_text(
                    "✅ **Данные удалены**\n\n"
                    "Все ваши данные успешно удалены из системы в соответствии с GDPR.\n\n"
                    "**Удалено:**\n"
                    f"• Профиль клиента: {deletion_results['tables_deleted'].get('clients', 'N/A')}\n"
                    f"• Профиль партнера: {deletion_results['tables_deleted'].get('partners', 'N/A')}\n"
                    f"• Услуги: {deletion_results['tables_deleted'].get('services', 'N/A')}\n"
                    f"• Акции: {deletion_results['tables_deleted'].get('promotions', 'N/A')}\n"
                    f"• Транзакции: {deletion_results['tables_deleted'].get('transactions', 'N/A')}\n\n"
                    "Вы можете в любой момент зарегистрироваться заново, используя команду /start.\n\n"
                    "Спасибо, что пользовались LoyaltyBot! 👋",
                    chat_id=chat_id,
                    message_id=call.message.message_id,
                    parse_mode='Markdown'
                )
                logger.info(f"Successfully deleted account for {chat_id}")
            else:
                client_bot.edit_message_text(
                    "⚠️ **Частичное удаление**\n\n"
                    "Некоторые данные были удалены, но произошли ошибки:\n\n"
                    f"{json.dumps(deletion_results['tables_deleted'], indent=2, ensure_ascii=False)}\n\n"
                    "Пожалуйста, свяжитесь с поддержкой для завершения удаления.",
                    chat_id=chat_id,
                    message_id=call.message.message_id,
                    parse_mode='Markdown'
                )
                logger.warning(f"Partial deletion for {chat_id}: {deletion_results}")
                
        except Exception as e:
            log_exception(logger, e, f"Error deleting account for {chat_id}")
            client_bot.edit_message_text(
                "❌ **Ошибка**\n\n"
                "Произошла ошибка при удалении данных. Пожалуйста, свяжитесь с поддержкой.",
                chat_id=chat_id,
                message_id=call.message.message_id,
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