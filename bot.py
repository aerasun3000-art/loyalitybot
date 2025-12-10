import telebot
from telebot import types
import os
import sys
import time
import datetime
import html
import requests
import random
from io import BytesIO
import io
try:
    import qrcode
    QR_IMAGE_AVAILABLE = True
except Exception:
    qrcode = None
    QR_IMAGE_AVAILABLE = False

try:
    from PIL import Image
except Exception:
    Image = None
from dotenv import load_dotenv
from logger_config import get_bot_logger, log_exception

# Устанавливаем путь к libzbar для arm64 (если установлен через нативный Homebrew)
if os.path.exists('/opt/homebrew/lib/libzbar.dylib'):
    os.environ['DYLD_LIBRARY_PATH'] = '/opt/homebrew/lib:' + os.environ.get('DYLD_LIBRARY_PATH', '')

# Инициализация логгера до импорта pyzbar
logger = get_bot_logger('partner_bot')

# Попытка импортировать pyzbar (может не работать на некоторых архитектурах)
try:
    from pyzbar.pyzbar import decode as decode_qr
    QR_DECODE_AVAILABLE = True
    logger.info("✅ QR декодирование доступно (libzbar найден)")
except (ImportError, OSError) as e:
    QR_DECODE_AVAILABLE = False
    decode_qr = None
    logger.warning(f"QR декодирование недоступно (libzbar не установлен или неправильная архитектура): {e}")
from image_handler import process_photo_for_promotion
from dashboard_urls import get_partner_dashboard_url
import sentry_sdk

load_dotenv()

# Инициализация Sentry для мониторинга ошибок
sentry_dsn = os.getenv('SENTRY_DSN')
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.getenv('SENTRY_ENVIRONMENT', 'production'),
        traces_sample_rate=0.1,  # 10% транзакций для отслеживания производительности
        profiles_sample_rate=0.1,  # 10% профилирования
        release=f"loyaltybot@{os.getenv('APP_VERSION', '1.0.0')}",
        send_default_pii=True,  # Добавляет данные запросов (headers, IP) для отладки
        before_send=lambda event, hint: event if event.get('level') in ['error', 'fatal'] else None,
    )
    print("✅ Sentry инициализирован для partner_bot")

sys.path.append(os.path.dirname(__file__))
# Предполагается, что 'supabase_manager' существует и содержит необходимые методы.
from supabase_manager import SupabaseManager
from currency_utils import format_currency, get_currency_by_city
from partner_revenue_share import PartnerRevenueShare

# --- Инициализация ---
PARTNER_TOKEN = os.environ.get('TOKEN_PARTNER')
if not PARTNER_TOKEN:
    logger.critical("TOKEN_PARTNER не найден в окружении")
    raise ValueError("FATAL: TOKEN_PARTNER не найден в окружении.")

logger.info("Инициализация партнёрского бота...")
bot = telebot.TeleBot(PARTNER_TOKEN)

# Инициализация клиентского бота для отправки сообщений клиентам
CLIENT_TOKEN = os.environ.get('TOKEN_CLIENT')
if CLIENT_TOKEN:
    client_bot = telebot.TeleBot(CLIENT_TOKEN)
    logger.info("Клиентский бот инициализирован для отправки сообщений")
else:
    client_bot = None
    logger.warning("TOKEN_CLIENT не найден, отправка сообщений клиентам недоступна")

try:
    sm = SupabaseManager()
    logger.info("SupabaseManager успешно инициализирован")
except Exception as e:
    log_exception(logger, e, "Ошибка инициализации SupabaseManager")
    raise

# Инициализация MLM Revenue Share системы
try:
    revenue_share = PartnerRevenueShare(sm)
    logger.info("PartnerRevenueShare успешно инициализирован")
except Exception as e:
    log_exception(logger, e, "Ошибка инициализации PartnerRevenueShare")
    revenue_share = None
    logger.warning("Revenue Share функции будут недоступны")

# НОВАЯ ЛОГИКА: ЗАГРУЗКА БОНУСА ИЗ .ENV
try:
    # Загружаем из .env. Если переменной нет, используем 100 по умолчанию.
    WELCOME_BONUS_AMOUNT = int(os.environ.get('WELCOME_BONUS_AMOUNT', 100))
except ValueError:
    print("WARNING: Переменная WELCOME_BONUS_AMOUNT некорректна или не число. Установлено 100.")
    WELCOME_BONUS_AMOUNT = 100 
# --------------------------------------------------

# Глобальные переменные для диалогов
USER_STATE = {}
TEMP_DATA = {}


# --- УВЕДОМЛЕНИЕ ДЛЯ КЛИЕНТСКОГО БОТА (имитация) ---
try:
    from client_handler import send_nps_request
except ImportError:
    def send_nps_request(chat_id: str, partner_chat_id: str):
        print(f"DEBUG: NPS request sent to client {chat_id} (Partner: {partner_chat_id})")

# ------------------------------------
# КЛАВИАТУРЫ И УВЕДОМЛЕНИЯ
# ------------------------------------

def get_partner_keyboard():
    """Главная клавиатура Партнера - оптимизированная версия."""
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    
    # Основные категории
    btn_operations = types.KeyboardButton("💰 Операции")
    btn_content = types.KeyboardButton("📝 Контент")
    btn_analytics = types.KeyboardButton("📊 Аналитика")
    btn_revenue = types.KeyboardButton("💎 Revenue Share")
    btn_invite = types.KeyboardButton("👥 Пригласить клиента")
    btn_more = types.KeyboardButton("⚙️ Ещё")
    
    markup.add(btn_operations, btn_content)
    markup.add(btn_analytics, btn_revenue)
    markup.add(btn_invite, btn_more)
    return markup

def partner_main_menu(chat_id, message_text="Выберите следующее действие:"):
    """Возвращает партнера в главное меню."""
    markup = get_partner_keyboard()
    bot.send_message(chat_id, message_text, reply_markup=markup, parse_mode='Markdown')


# ------------------------------------
# ГЛАВНЫЙ ОБРАБОТЧИК /START
# ------------------------------------

@bot.message_handler(commands=['start', 'partner_start'])
def handle_partner_start(message):
    chat_id = message.chat.id
    payload = message.text.replace('/start', '').replace('/partner_start', '').strip()
    
    logger.info(f"Партнёр {chat_id} запустил бота с payload: {payload}")

    if payload == 'partner_applied':
        bot.send_message(chat_id, "⏳ Ваша заявка принята и ожидает одобрения.")
        return

    try:
        if sm.partner_exists(chat_id):
            status = sm.get_partner_status(chat_id)
    except Exception as e:
        log_exception(logger, e, f"Ошибка проверки существования партнёра {chat_id}")
        bot.send_message(chat_id, "Произошла ошибка при доступе к системе. Попробуйте позже.")
        return
    
    if sm.partner_exists(chat_id):
        status = sm.get_partner_status(chat_id)

        if status == 'Approved':
            partner_main_menu(chat_id, "🤝 **Добро пожаловать в рабочее меню партнера!**")
            return

        elif status == 'Pending':
            bot.send_message(chat_id, "⏳ Ваша заявка находится на рассмотрении.", reply_markup=types.ReplyKeyboardRemove())
            return
        elif status == 'Rejected':
            bot.send_message(chat_id, "❌ Ваша заявка была отклонена. Свяжитесь с администратором.", reply_markup=types.ReplyKeyboardRemove())
            return

    # Если не партнер: Запуск регистрации (оставлено в качестве заглушки)
    bot.send_message(chat_id, "Для начала работы нажмите ссылку на регистрацию Партнера.", reply_markup=types.ReplyKeyboardRemove())
    # Здесь должна быть ссылка на фронтенд /partner-apply


# ------------------------------------
# ФУНКЦИОНАЛ: ОБЩИЕ КНОПКИ МЕНЮ (ОПТИМИЗИРОВАННОЕ)
# ------------------------------------
@bot.message_handler(func=lambda message: message.text in [
    "💰 Операции", "📝 Контент", "📊 Аналитика", "💎 Revenue Share", "⚙️ Ещё"
])
def handle_partner_categories(message):
    """Обработчик категорий главного меню."""
    chat_id = message.chat.id
    
    if not sm.partner_exists(chat_id) or sm.get_partner_status(chat_id) != 'Approved':
        bot.send_message(chat_id, "У вас нет прав для выполнения этой операции.")
        return
    
    if message.text == "💰 Операции":
        markup = types.InlineKeyboardMarkup(row_width=1)
        btn_add = types.InlineKeyboardButton("➕ Начислить баллы", callback_data="menu_add_points")
        btn_subtract = types.InlineKeyboardButton("➖ Списать баллы", callback_data="menu_subtract_points")
        btn_queue = types.InlineKeyboardButton("📦 Очередь операций", callback_data="menu_queue")
        btn_find = types.InlineKeyboardButton("👤 Найти клиента", callback_data="menu_find_client")
        btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="partner_main_menu")
        markup.add(btn_add, btn_subtract, btn_queue, btn_find, btn_back)
        bot.send_message(chat_id, "*💰 Операции:*\nВыберите действие:", reply_markup=markup, parse_mode='Markdown')
        return
    
    if message.text == "📝 Контент":
        markup = types.InlineKeyboardMarkup(row_width=1)
        btn_promo = types.InlineKeyboardButton("🌟 Акции", callback_data="menu_promotions")
        btn_service = types.InlineKeyboardButton("🛠️ Услуги", callback_data="menu_services")
        btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="partner_main_menu")
        markup.add(btn_promo, btn_service, btn_back)
        bot.send_message(chat_id, "*📝 Контент:*\nВыберите действие:", reply_markup=markup, parse_mode='Markdown')
        return
    
    if message.text == "📊 Аналитика":
        markup = types.InlineKeyboardMarkup(row_width=1)
        btn_stats = types.InlineKeyboardButton("📊 Моя статистика", callback_data="menu_stats")
        btn_dashboard = types.InlineKeyboardButton("📈 Дашборд", callback_data="menu_dashboard")
        btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="partner_main_menu")
        markup.add(btn_stats, btn_dashboard, btn_back)
        bot.send_message(chat_id, "*📊 Аналитика:*\nВыберите действие:", reply_markup=markup, parse_mode='Markdown')
        return
    
    if message.text == "💎 Revenue Share":
        if revenue_share is None:
            bot.send_message(chat_id, "❌ Revenue Share система временно недоступна.")
            return
        handle_revenue_share_menu(message)
        return
    
    if message.text == "⚙️ Ещё":
        markup = types.InlineKeyboardMarkup(row_width=1)
        btn_messages = types.InlineKeyboardButton("💬 Мои сообщения", callback_data="menu_messages")
        btn_settings = types.InlineKeyboardButton("⚙️ Настройки", callback_data="menu_settings")
        btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="partner_main_menu")
        markup.add(btn_messages, btn_settings, btn_back)
        bot.send_message(chat_id, "*⚙️ Ещё:*\nВыберите действие:", reply_markup=markup, parse_mode='Markdown')
        return


# ------------------------------------
# ОБРАБОТЧИК CALLBACK ДЛЯ ПОДМЕНЮ
# ------------------------------------
@bot.callback_query_handler(
    func=lambda call: call.data.startswith('menu_') or call.data in (
        'partner_main_menu',
        'revenue_share_info',
        'revenue_pv',
        'revenue_network',
    )
)
def handle_menu_callbacks(call):
    """Обработчик callback для кнопок подменю."""
    chat_id = call.message.chat.id
    
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass
    
    if call.data == 'menu_add_points':
        USER_STATE[chat_id] = 'awaiting_client_id_issue'
        bot.send_message(chat_id, 
            "Введите *Chat ID клиента* или *ID телефона клиента*.\n\n"
            "📱 Или отправьте фото с QR-кодом клиента для быстрого сканирования.",
            parse_mode="Markdown"
        )
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'menu_subtract_points':
        USER_STATE[chat_id] = 'awaiting_client_id_spend'
        bot.send_message(chat_id, 
            "Введите *Chat ID клиента* или *ID телефона клиента* для списания баллов.\n\n"
            "📱 Или отправьте фото с QR-кодом клиента для быстрого сканирования.",
            parse_mode="Markdown"
        )
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'menu_queue':
        show_offline_queue(chat_id)
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'menu_find_client':
        # Создаём временное сообщение для передачи в handle_find_client
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
                self.text = "👤 Найти клиента"
        
        handle_find_client(TempMessage(chat_id))
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'menu_promotions':
        # Создаём временное сообщение для передачи в handle_promotions_menu
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
                self.text = "🌟 Акции"
        
        handle_promotions_menu(TempMessage(chat_id))
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'menu_services':
        # Создаём временное сообщение для передачи в handle_services_menu
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
                self.text = "🛠️ Услуги"
        
        handle_services_menu(TempMessage(chat_id))
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'menu_stats':
        # Создаём временное сообщение для передачи в handle_partner_stats
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
                self.text = "📊 Моя статистика"
        
        handle_partner_stats(TempMessage(chat_id))
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'menu_dashboard':
        # Создаём временное сообщение для передачи в handle_partner_dashboard
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
                self.text = "📈 Дашборд"
        
        handle_partner_dashboard(TempMessage(chat_id))
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'menu_messages':
        # Создаём временное сообщение для передачи в handle_partner_messages
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
                self.text = "💬 Мои сообщения"
        
        handle_partner_messages(TempMessage(chat_id))
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'menu_settings':
        # Создаём временное сообщение для передачи в handle_partner_settings
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
                self.text = "⚙️ Настройки"
        
        handle_partner_settings(TempMessage(chat_id))
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'partner_main_menu':
        partner_main_menu(chat_id)
        bot.answer_callback_query(call.id)
        return
    
    # Обработка Revenue Share callback'ов
    if call.data == 'revenue_share_info':
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
        handle_revenue_share_menu(TempMessage(chat_id))
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'revenue_pv':
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
        handle_pv_info(TempMessage(chat_id))
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'revenue_network':
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
        handle_network_info(TempMessage(chat_id))
        bot.answer_callback_query(call.id)
        return
    
    bot.answer_callback_query(call.id)


# ------------------------------------
# ФУНКЦИОНАЛ: ПРИГЛАШЕНИЕ КЛИЕНТА
# ------------------------------------

def generate_qr_code(data: str) -> io.BytesIO:
    """Генерирует QR-код с данными и возвращает BytesIO объект.
    
    На некоторых конфигурациях macOS (arm64) Pillow может быть недоступен.
    В этом случае функция возбуждает исключение, а вызывающий код
    должен обработать ошибку и показать сообщение пользователю.
    """
    if not QR_IMAGE_AVAILABLE or qrcode is None or Image is None:
        raise RuntimeError("QR-коды недоступны в этой среде (Pillow/qrcode не инициализированы).")
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return img_byte_arr

@bot.message_handler(func=lambda message: message.text == '👥 Пригласить клиента')
def handle_invite_start(message):
    chat_id = message.chat.id
    if not sm.partner_exists(chat_id) or sm.get_partner_status(chat_id) != 'Approved':
        bot.send_message(chat_id, "У вас нет прав для выполнения этой операции.")
        return

    # Меню с реферальной ссылкой
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_link = types.InlineKeyboardButton("🔗 Получить реферальную ссылку", callback_data="invite_by_link")
    markup.add(btn_link)

    bot.send_message(
        chat_id,
        "Получите реферальную ссылку для приглашения клиентов:",
        reply_markup=markup
    )

@bot.callback_query_handler(func=lambda call: call.data.startswith('invite_'))
def handle_invite_callbacks(call):
    chat_id = call.message.chat.id
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None) 
    except Exception:
        pass

    if call.data == 'invite_by_link':
        partner_id = str(chat_id)
        # Ссылка на клиентский бот @mindbeatybot
        link = f"https://t.me/mindbeatybot?start=partner_{partner_id}"
        
        # Создаем кнопки для действий со ссылкой
        markup = types.InlineKeyboardMarkup(row_width=1)
        btn_copy = types.InlineKeyboardButton("📋 Копировать ссылку", callback_data="invite_copy_link")
        btn_send = types.InlineKeyboardButton("📤 Отправить клиенту", callback_data="invite_send_to_client")
        btn_qr = types.InlineKeyboardButton("📱 Получить QR-код", callback_data="invite_get_qr")
        markup.add(btn_copy, btn_send, btn_qr)
        
        bot.send_message(
            chat_id,
            f"🔗 **Ваша реферальная ссылка:**\n\n`{link}`\n\n📱 Выберите действие:",
            parse_mode='Markdown',
            reply_markup=markup
        )
        
    elif call.data == 'invite_copy_link':
        partner_id = str(chat_id)
        link = f"https://t.me/mindbeatybot?start=partner_{partner_id}"
        # Отправляем ссылку как текст для копирования
        bot.send_message(
            chat_id,
            f"📋 **Скопируйте ссылку:**\n\n`{link}`\n\n"
            f"💡 *Нажмите на ссылку выше, чтобы скопировать её*",
            parse_mode='Markdown'
        )
        bot.answer_callback_query(call.id, "Ссылка отправлена для копирования")
        
    elif call.data == 'invite_send_to_client':
        # Запрашиваем chat_id клиента
        USER_STATE[chat_id] = 'awaiting_client_id_for_invite'
        bot.send_message(
            chat_id,
            "📤 **Отправка ссылки клиенту**\n\n"
            "Введите *Chat ID клиента* (число), которому хотите отправить реферальную ссылку.\n\n"
            "💡 *Подсказка: Chat ID можно узнать, если клиент напишет боту @userinfobot*",
            parse_mode='Markdown'
        )
        
    elif call.data == 'invite_get_qr':
        partner_id = str(chat_id)
        link = f"https://t.me/mindbeatybot?start=partner_{partner_id}"
        
        try:
            # Генерируем QR-код
            qr_image = generate_qr_code(link)
            
            bot.send_photo(
                chat_id,
                qr_image,
                caption=(
                    f"📱 **QR-код реферальной ссылки**\n\n"
                    f"🔗 Ссылка: `{link}`\n\n"
                    f"💡 **Как использовать:**\n"
                    f"• Покажите QR-код клиенту\n"
                    f"• Клиент отсканирует его камерой\n"
                    f"• Клиент автоматически получит приветственные баллы!"
                ),
                parse_mode='Markdown'
            )
            bot.answer_callback_query(call.id, "QR-код отправлен")
        except Exception as e:
            log_exception(logger, e, f"Ошибка генерации QR-кода для партнера {chat_id}")
            bot.answer_callback_query(call.id, "Ошибка при генерации QR-кода")
            bot.send_message(chat_id, "❌ Произошла ошибка при генерации QR-кода. Попробуйте позже.")
        



# ------------------------------------
# ЛОГИКА ТРАНЗАКЦИЙ ПАРТНЕРА (ОСТАВЛЕНО)
# ------------------------------------
def decode_qr_from_photo(file_id: str) -> str | None:
    """Декодирует QR-код из фото и возвращает данные или None."""
    if not QR_DECODE_AVAILABLE:
        logger.warning("QR декодирование недоступно. Установите libzbar для arm64 архитектуры.")
        return None
    
    try:
        # Получаем информацию о файле
        file_info = bot.get_file(file_id)
        file_url = f"https://api.telegram.org/file/bot{PARTNER_TOKEN}/{file_info.file_path}"
        
        # Скачиваем фото
        response = requests.get(file_url, timeout=30)
        if response.status_code != 200:
            return None
        
        # Открываем изображение
        img = Image.open(BytesIO(response.content))
        
        # Декодируем QR-код
        decoded_objects = decode_qr(img)
        if decoded_objects:
            # Извлекаем данные из первого найденного QR-кода
            qr_data = decoded_objects[0].data.decode('utf-8')
            logger.info(f"QR-код успешно декодирован: {qr_data}")
            return qr_data
        
        return None
    except Exception as e:
        log_exception(logger, e, f"Ошибка декодирования QR-кода")
        return None


def show_offline_queue(chat_id: int):
    """Отображает очередь отложенных операций для партнера."""
    try:
        pending = sm.transaction_queue.list_pending() if sm.transaction_queue else []
    except Exception as e:
        log_exception(logger, e, "Ошибка при чтении очереди транзакций")
        bot.send_message(chat_id, "❌ Не удалось получить очередь операций. Попробуйте позже.")
        return

    count = len(pending)
    message_lines = [
        "<b>📦 Очередь операций</b>",
        "",
        f"Всего ожидает обработки: <b>{count}</b>"
    ]

    if count:
        message_lines.append("")
        preview = pending[:5]
        for idx, payload in enumerate(preview, start=1):
            txn_type = payload.get('txn_type', '?').upper()
            client_id = html.escape(str(payload.get('client_chat_id', 'неизв.')))
            amount = payload.get('raw_amount', 0)
            try:
                amount_display = int(amount) if float(amount).is_integer() else round(float(amount), 2)
            except (TypeError, ValueError):
                amount_display = amount
            message_lines.append(f"{idx}. {txn_type} → {client_id} ({amount_display})")
        if count > len(preview):
            message_lines.append(f"... и ещё {count - len(preview)} операций")
    else:
        message_lines.append("")
        message_lines.append("Очередь пуста — все операции обработаны.")

    markup = types.InlineKeyboardMarkup(row_width=2)
    markup.add(
        types.InlineKeyboardButton("➕ Добавить", callback_data="queue_add"),
        types.InlineKeyboardButton("🔄 Синхронизировать", callback_data="queue_sync")
    )
    markup.add(
        types.InlineKeyboardButton("🧹 Очистить", callback_data="queue_clear"),
        types.InlineKeyboardButton("⬅️ В меню", callback_data="queue_back")
    )

    bot.send_message(chat_id, "\n".join(message_lines), parse_mode='HTML', reply_markup=markup)


@bot.callback_query_handler(func=lambda call: call.data in ['queue_add', 'queue_sync', 'queue_clear', 'queue_back'])
def handle_queue_callbacks(call):
    chat_id = call.message.chat.id
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass

    action = call.data
    if action == 'queue_add':
        TEMP_DATA[chat_id] = {'offline': {'partner_id': str(chat_id)}}
        USER_STATE[chat_id] = 'awaiting_offline_client'
        bot.send_message(chat_id, "Введите Chat ID клиента для отложенной операции:")
    elif action == 'queue_sync':
        result = sm.transaction_queue.process_pending() if sm.transaction_queue else {"processed": 0, "failed": 0}
        processed = result.get('processed', 0)
        failed = result.get('failed', 0)
        bot.send_message(
            chat_id,
            f"🔄 Синхронизация завершена.\n✅ Успешно: {processed}\n⚠️ Ошибок: {failed}",
            parse_mode='Markdown'
        )
        show_offline_queue(chat_id)
    elif action == 'queue_clear':
        if sm.transaction_queue:
            sm.transaction_queue.clear()
        bot.send_message(chat_id, "🧹 Очередь операций очищена.")
        show_offline_queue(chat_id)
    elif action == 'queue_back':
        partner_main_menu(chat_id)

    bot.answer_callback_query(call.id)


@bot.message_handler(func=lambda message: USER_STATE.get(message.chat.id) == 'awaiting_offline_client')
def process_offline_client_id(message):
    chat_id = message.chat.id
    client_id = message.text.strip()

    if not client_id:
        bot.send_message(chat_id, "❌ Укажите корректный Chat ID клиента.")
        return

    data = TEMP_DATA.setdefault(chat_id, {}).setdefault('offline', {})
    data['client_id'] = client_id

    markup = types.InlineKeyboardMarkup(row_width=2)
    markup.add(
        types.InlineKeyboardButton("Начисление", callback_data="txn_offline_type_accrual"),
        types.InlineKeyboardButton("Списание", callback_data="txn_offline_type_spend")
    )

    USER_STATE[chat_id] = 'awaiting_offline_type'
    bot.send_message(chat_id, "Выберите тип операции для очереди:", reply_markup=markup)


@bot.callback_query_handler(func=lambda call: call.data.startswith('reply_to_client_'))
def handle_reply_to_client(call):
    """Обработчик кнопки 'Ответить клиенту'"""
    chat_id = call.message.chat.id
    client_chat_id = call.data.replace('reply_to_client_', '')
    
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass
    
    # Сохраняем chat_id клиента в состояние партнера
    USER_STATE[chat_id] = f'replying_to_client_{client_chat_id}'
    TEMP_DATA.setdefault(chat_id, {})['client_chat_id'] = client_chat_id
    
    bot.send_message(
        chat_id,
        f"💬 **Ответ клиенту**\n\n"
        f"Клиент ID: `{client_chat_id}`\n\n"
        f"Напишите ваш ответ клиенту. Сообщение будет отправлено через клиентского бота.",
        parse_mode='Markdown'
    )
    bot.answer_callback_query(call.id, "Напишите ваш ответ клиенту")


@bot.callback_query_handler(func=lambda call: call.data.startswith('txn_offline_type_'))
def handle_offline_type(call):
    chat_id = call.message.chat.id
    data = TEMP_DATA.setdefault(chat_id, {}).setdefault('offline', {})
    selected = call.data.replace('txn_offline_type_', '', 1)
    data['txn_type'] = 'accrual' if selected == 'accrual' else 'spend'
    USER_STATE[chat_id] = 'awaiting_offline_amount'

    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass

    if data['txn_type'] == 'accrual':
        prompt = "Введите сумму чека (в долларах), которую хотите добавить в очередь:"
    else:
        prompt = "Введите количество баллов для списания, которое хотите добавить в очередь:"

    bot.send_message(chat_id, prompt)
    bot.answer_callback_query(call.id)


@bot.message_handler(func=lambda message: str(USER_STATE.get(message.chat.id, '')).startswith('replying_to_client_'))
def handle_partner_reply_message(message):
    """Обработчик ответа партнера клиенту"""
    chat_id = message.chat.id
    state = USER_STATE.get(chat_id, '')
    
    # Извлекаем client_chat_id из состояния
    client_chat_id = state.replace('replying_to_client_', '')
    
    if not client_chat_id:
        bot.send_message(chat_id, "❌ Ошибка: не указан клиент")
        USER_STATE.pop(chat_id, None)
        partner_main_menu(chat_id)
        return
    
    reply_text = message.text
    
    # Отправляем ответ клиенту через клиентского бота
    try:
        if client_bot:
            # Получаем информацию о партнере
            partner_data = sm.get_all_partners()
            partner_info = partner_data[partner_data['chat_id'] == str(chat_id)]
            partner_name = partner_info.iloc[0].get('name', 'Специалист') if not partner_info.empty else 'Специалист'
            partner_company = partner_info.iloc[0].get('company_name', '') if not partner_info.empty else ''
            
            # Сначала сохраняем сообщение в БД
            message_id = sm.save_message(
                client_chat_id=str(client_chat_id),
                partner_chat_id=str(chat_id),
                sender_type='partner',
                message_text=reply_text,
                message_type='text'
            )
            
            # Формируем сообщение для клиента
            client_message = (
                f"💬 **Ответ от специалиста**\n\n"
            )
            if partner_company:
                client_message += f"🏢 {partner_company}\n"
            client_message += f"👤 {partner_name}\n\n"
            client_message += f"_{reply_text}_"
            
            # Пытаемся отправить клиенту
            try:
                client_bot.send_message(
                    int(client_chat_id),
                    client_message,
                    parse_mode='Markdown'
                )
                # Если сообщение отправлено, отмечаем как прочитанное
                if message_id:
                    sm.mark_message_as_read(message_id)
            except Exception as send_error:
                # Если клиент недоступен, сообщение уже сохранено в БД
                logger.warning(f"Не удалось отправить сообщение клиенту {client_chat_id}, но оно сохранено в БД: {send_error}")
            
            # Подтверждаем партнеру
            bot.send_message(
                chat_id,
                f"✅ **Ответ сохранён!**\n\n"
                f"Клиент ID: `{client_chat_id}`\n"
                f"Сообщение: _{reply_text}_\n\n"
                f"_Ответ сохранён в истории переписки._",
                parse_mode='Markdown'
            )
            
            logger.info(f"Партнёр {chat_id} отправил ответ клиенту {client_chat_id} (сохранено в БД: ID={message_id})")
        else:
            bot.send_message(chat_id, "❌ Клиентский бот не настроен")
    except Exception as e:
        logger.error(f"Ошибка отправки ответа клиенту {client_chat_id} от партнёра {chat_id}: {e}")
        bot.send_message(chat_id, "❌ Произошла ошибка при отправке ответа клиенту. Попробуйте позже.")
    
    # Очищаем состояние
    USER_STATE.pop(chat_id, None)
    TEMP_DATA.pop(chat_id, None)
    partner_main_menu(chat_id)


@bot.message_handler(func=lambda message: USER_STATE.get(message.chat.id) == 'awaiting_offline_amount')
def process_offline_amount(message):
    chat_id = message.chat.id
    entry = TEMP_DATA.get(chat_id, {}).get('offline', {})
    raw_amount_text = message.text.strip()

    try:
        amount = float(raw_amount_text.replace(',', '.'))
        if amount <= 0:
            raise ValueError
    except ValueError:
        bot.send_message(chat_id, "❌ Неверный формат. Введите положительное число.")
        return

    client_id = entry.get('client_id')
    txn_type = entry.get('txn_type')
    partner_id = entry.get('partner_id', str(chat_id))

    if not client_id or not txn_type:
        bot.send_message(chat_id, "❌ Сессия устарела. Попробуйте добавить операцию заново.")
        TEMP_DATA.pop(chat_id, None)
        USER_STATE.pop(chat_id, None)
        return

    success = sm.transaction_queue.enqueue_manual(client_id, partner_id, txn_type, amount)
    TEMP_DATA.pop(chat_id, None)
    USER_STATE.pop(chat_id, None)

    if success:
        bot.send_message(chat_id, "✅ Операция добавлена в очередь.")
    else:
        bot.send_message(chat_id, "❌ Не удалось добавить операцию. Попробуйте позже.")

    show_offline_queue(chat_id)


def prompt_transaction_amount(chat_id: int, client_id: str, txn_type: str, current_balance: int):
    templates = sm.get_operation_templates(str(chat_id), txn_type) if sm else []
    markup = None
    if templates:
        markup = types.InlineKeyboardMarkup(row_width=3)
        for template in templates:
            value = template.get('value')
            label = template.get('label', value)
            if value is None:
                continue
            markup.add(types.InlineKeyboardButton(
                str(label),
                callback_data=f"txn_template_{txn_type}_{value}"
            ))
        markup.add(types.InlineKeyboardButton("✏️ Ввести вручную", callback_data="txn_manual"))

    if txn_type == 'accrual':
        text = (
            f"Текущий баланс клиента: *{current_balance}* баллов.\n\n"
            "Выберите сумму чека (в долларах) из подсказок ниже или введите значение вручную."
        )
    else:
        text = (
            f"Текущий баланс клиента: *{current_balance}* баллов.\n\n"
            "Выберите количество баллов для списания или введите значение вручную."
        )

    bot.send_message(chat_id, text, parse_mode="Markdown", reply_markup=markup)


@bot.callback_query_handler(func=lambda call: call.data.startswith('txn_template_'))
def handle_template_selection(call):
    chat_id = call.message.chat.id
    parts = call.data.split('_', 3)
    if len(parts) < 4:
        bot.answer_callback_query(call.id, "Некорректный шаблон.", show_alert=True)
        return

    txn_type = parts[2]
    raw_value = parts[3]

    txn_data = TEMP_DATA.get(chat_id)
    if not txn_data or txn_data.get('txn_type') != txn_type:
        bot.answer_callback_query(call.id, "Сессия устарела. Начните заново.", show_alert=True)
        partner_main_menu(chat_id)
        return

    try:
        amount = float(raw_value)
    except ValueError:
        bot.answer_callback_query(call.id, "Не удалось применить шаблон.", show_alert=True)
        return

    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass

    TEMP_DATA.pop(chat_id, None)
    USER_STATE.pop(chat_id, None)

    bot.answer_callback_query(call.id, "Шаблон применён")
    complete_partner_transaction(chat_id, txn_data['client_id'], txn_type, amount)


@bot.callback_query_handler(func=lambda call: call.data == 'txn_manual')
def handle_manual_selection(call):
    chat_id = call.message.chat.id
    USER_STATE[chat_id] = 'awaiting_amount'
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass

    txn_data = TEMP_DATA.get(chat_id, {})
    txn_type = txn_data.get('txn_type', 'accrual')
    if txn_type == 'accrual':
        prompt = "Введите сумму чека (в долларах):"
    else:
        prompt = "Введите количество баллов для списания:"

    bot.send_message(chat_id, prompt)
    bot.answer_callback_query(call.id)


def update_partner_stats_on_transaction(partner_chat_id: str, transaction_amount: float, transaction_type: str = None):
    """
    Обновляет статистику партнера при транзакции для Revenue Share
    
    Args:
        partner_chat_id: ID партнера в Telegram
        transaction_amount: Сумма транзакции
        transaction_type: Тип транзакции (опционально, для дифференциации комиссий)
    """
    if revenue_share is None:
        return
    
    try:
        # Получаем текущие данные партнера
        partner = sm.client.table('partners').select(
            'personal_income_monthly, client_base_count, partner_type, commission_rate'
        ).eq('chat_id', partner_chat_id).single().execute()
        
        if not partner.data:
            return
        
        current_income = float(partner.data.get('personal_income_monthly', 0))
        
        # ЛОГИКА РАСЧЕТА ДОХОДА ПАРТНЕРА
        # Настройте эту логику под вашу бизнес-модель
        
        # Вариант 1: Использовать commission_rate из базы данных
        commission_rate = float(partner.data.get('commission_rate', 10.0))  # По умолчанию 10%
        income_from_transaction = transaction_amount * (commission_rate / 100.0)
        
        # Вариант 2: Фиксированная комиссия + процент (раскомментируйте, если нужно)
        # fixed_commission = 5.0  # Фиксированная комиссия $5
        # percentage_commission = transaction_amount * 0.10  # 10% от суммы
        # income_from_transaction = fixed_commission + percentage_commission
        
        # Вариант 3: Зависит от типа транзакции (раскомментируйте, если нужно)
        # if transaction_type == 'premium':
        #     income_from_transaction = transaction_amount * 0.20  # 20% для премиум
        # elif transaction_type == 'standard':
        #     income_from_transaction = transaction_amount * 0.10  # 10% для стандартных
        # else:
        #     income_from_transaction = transaction_amount * 0.05  # 5% для остальных
        
        # Вариант 4: Зависит от типа партнера (раскомментируйте, если нужно)
        # partner_type = partner.data.get('partner_type', 'partner')
        # if partner_type == 'master':
        #     income_from_transaction = transaction_amount * 0.15  # 15% для мастер-партнеров
        # elif partner_type == 'regional':
        #     income_from_transaction = transaction_amount * 0.12  # 12% для региональных
        # else:
        #     income_from_transaction = transaction_amount * 0.10  # 10% для обычных
        
        new_income = current_income + income_from_transaction
        
        # Получаем количество уникальных клиентов
        clients = sm.client.table('transactions').select(
            'client_chat_id'
        ).eq('partner_chat_id', partner_chat_id).execute()
        
        unique_clients = set()
        if clients.data:
            for txn in clients.data:
                client_id = txn.get('client_chat_id')
                if client_id:
                    unique_clients.add(client_id)
        
        client_count = len(unique_clients)
        
        # Обновляем данные (PV обновится автоматически)
        revenue_share.update_partner_income_and_clients(
            partner_chat_id=partner_chat_id,
            personal_income=new_income,
            client_count=client_count
        )
        
        logger.info(f"Обновлена статистика партнера {partner_chat_id}: доход={new_income}, клиентов={client_count}")
        
    except Exception as e:
        logger.warning(f"Ошибка обновления статистики партнера {partner_chat_id}: {e}")


def complete_partner_transaction(chat_id: int, client_id: str, txn_type: str, amount: float):
    try:
        logger.info(f"Партнёр {chat_id} инициирует транзакцию: тип={txn_type}, клиент={client_id}, сумма={amount}")
        result = sm.execute_transaction(client_id, str(chat_id), txn_type, amount)
        display_amount = int(amount) if float(amount).is_integer() else round(float(amount), 2)

        if result['success']:
            if result.get('queued'):
                msg = (
                    "⏳ **Операция поставлена в очередь.**\n"
                    "Мы повторим её автоматически, как только связь с базой восстановится.\n"
                )
                if txn_type == 'accrual':
                    msg += f"Планируется начислить: **{result.get('points', 0)}** баллов.\n"
                else:
                    msg += f"Планируется списать: **{display_amount}** баллов.\n"
                predicted_balance = result.get('new_balance')
                if predicted_balance is not None:
                    msg += f"Ожидаемый баланс после выполнения: **{predicted_balance}**.\n"
                if result.get('error'):
                    msg += f"\nℹ️ {result['error']}"
            else:
                msg = f"✅ **Транзакция успешна!**\n"
                if txn_type == 'accrual':
                    msg += f"Начислено: **{result.get('points', 0)}** баллов.\n"
                else:
                    msg += f"Списано: **{display_amount}** баллов.\n"

                msg += f"Текущий баланс клиента: **{result.get('new_balance', 'N/A')}**."
            bot.send_message(chat_id, msg, parse_mode="Markdown")
            logger.info(f"Транзакция успешна: {txn_type} для клиента {client_id}")
            
            # Обновляем статистику партнера для Revenue Share (если система активна)
            if revenue_share is not None and txn_type == 'accrual':
                try:
                    update_partner_stats_on_transaction(str(chat_id), amount)
                except Exception as e:
                    logger.warning(f"Ошибка обновления статистики партнера: {e}")

            if not result.get('queued') and not str(client_id).startswith('VIA_PARTNER_'):
                try:
                    logger.info(f"[NPS] Отправка NPS запроса клиенту {client_id} от партнёра {chat_id}")
                    send_nps_request(client_id, str(chat_id))
                    logger.info(f"[NPS] ✅ NPS запрос успешно отправлен клиенту {client_id}")
                except Exception as e:
                    logger.error(f"[NPS] ❌ Ошибка отправки NPS запроса клиенту {client_id}: {e}", exc_info=True)
                    log_exception(logger, e, f"Ошибка отправки NPS запроса клиенту {client_id}")

        else:
            error_msg = result.get('error', 'Неизвестная ошибка')
            logger.warning(f"Транзакция не удалась для клиента {client_id}: {error_msg}")
            bot.send_message(chat_id, f"❌ Ошибка транзакции: {error_msg}")

    except Exception as e:
        log_exception(logger, e, f"Критическая ошибка при выполнении транзакции партнёра {chat_id}")
        bot.send_message(chat_id, "Произошла системная ошибка при проведении транзакции. Обратитесь в поддержку.")
    finally:
        partner_main_menu(chat_id)

@bot.message_handler(content_types=['photo'])
def process_qr_photo(message):
    """Обрабатывает фото с QR-кодом (акции или клиенты)."""
    chat_id = message.chat.id
    
    if not message.photo:
        bot.send_message(chat_id, "❌ Не удалось получить фото. Попробуйте отправить фото еще раз.")
        return
    
    # Получаем самое большое фото
    file_id = message.photo[-1].file_id
    
    bot.send_message(chat_id, "🔍 Сканирую QR-код...")
    
    # Декодируем QR-код
    qr_data = decode_qr_from_photo(file_id)
    
    if not qr_data:
        error_msg = (
            "❌ Не удалось распознать QR-код на фото.\n\n"
        )
        if not QR_DECODE_AVAILABLE:
            error_msg += (
                "⚠️ QR декодирование временно недоступно на сервере.\n\n"
                "📝 **Как ввести Chat ID вручную:**\n"
                "1. Посмотрите на QR-код клиента - под ним указан Chat ID (например: ID: 1234567890)\n"
                "2. Или попросите клиента показать его Chat ID из приложения\n"
                "3. Введите Chat ID вручную в следующем сообщении\n\n"
            )
        else:
            error_msg += (
                "Пожалуйста, убедитесь, что:\n"
                "• QR-код четко виден на фото\n"
                "• Фото хорошо освещено\n"
                "• QR-код не поврежден\n\n"
                "📝 **Альтернатива:** Введите Chat ID клиента вручную.\n"
                "Chat ID указан под QR-кодом в приложении клиента.\n\n"
            )
        error_msg += "💡 Просто отправьте Chat ID следующим сообщением."
        bot.send_message(chat_id, error_msg, parse_mode='Markdown')
        return
    
    # Проверяем, нужно ли обрабатывать как обычный QR-код клиента
    is_awaiting_client = USER_STATE.get(chat_id) in ['awaiting_client_id_issue', 'awaiting_client_id_spend']
    
    # Парсим данные из QR-кода
    if qr_data.startswith('PROMOTION:'):
        # Формат: PROMOTION:promotion_id:client_chat_id:points_to_spend:points_value_usd
        try:
            parts = qr_data.replace('PROMOTION:', '').split(':')
            if len(parts) >= 4:
                promotion_id = parts[0]  # UUID как строка
                client_id = parts[1]
                points_to_spend = int(parts[2])
                points_value_usd = float(parts[3])
                
                # Получаем информацию об акции
                promotion = sm.get_promotion_by_id(promotion_id)
                if not promotion:
                    bot.send_message(chat_id, "❌ Акция не найдена.")
                    return
                
                # Получаем информацию о клиенте
                if not sm.client_exists(client_id):
                    bot.send_message(chat_id, f"❌ Клиент с ID `{client_id}` не найден.", parse_mode='Markdown')
                    return
                
                client_balance = sm.get_client_balance(client_id)
                service_price = promotion.get('service_price', 0)
                cash_payment = service_price - points_value_usd if service_price > 0 else 0
                
                # Рассчитываем сколько баллов начислить (5% от суммы доплаты наличными)
                # Кэшбэк начисляется ТОЛЬКО от cash_payment, НЕ от суммы оплаты баллами
                if cash_payment > 0:
                    points_to_earn = sm._calculate_accrual_points(int(chat_id), cash_payment)
                else:
                    # Если доплата = 0 (полная оплата баллами), кэшбэк не начисляется
                    points_to_earn = 0
                
                # Сохраняем данные для подтверждения
                TEMP_DATA[chat_id] = {
                    'promotion_id': promotion_id,
                    'client_id': client_id,
                    'points_to_spend': points_to_spend,
                    'points_value_usd': points_value_usd,
                    'cash_payment': cash_payment,  # Передаем cash_payment вместо purchase_amount
                    'points_to_earn': points_to_earn
                }
                
                # Показываем интерактивное сообщение с кнопками
                message_text = (
                    f"🎁 **Оплата по акции**\n\n"
                    f"**Акция:** {promotion.get('title', 'Не указано')}\n"
                    f"**Клиент ID:** `{client_id}`\n"
                    f"**Баланс клиента:** {client_balance} баллов\n\n"
                    f"📊 **Операции:**\n"
                    f"➖ Списать: **{points_to_spend}** баллов (${points_value_usd:.2f})\n"
                )
                
                if cash_payment > 0:
                    message_text += (
                        f"➕ Начислить: **{points_to_earn}** баллов (5% кэшбэк от доплаты ${cash_payment:.2f})\n"
                        f"💰 **Доплата наличными:** ${cash_payment:.2f}\n"
                    )
                else:
                    message_text += (
                        f"💰 **Полная оплата баллами** (кэшбэк не начисляется)\n"
                    )
                
                message_text += f"\n✅ Нажмите 'Одобрить' для выполнения транзакции."
                
                markup = types.InlineKeyboardMarkup()
                btn_approve = types.InlineKeyboardButton("✅ Одобрить", callback_data=f"promo_approve_{promotion_id}|{client_id}")
                btn_cancel = types.InlineKeyboardButton("❌ Отмена", callback_data="promo_cancel")
                markup.add(btn_approve, btn_cancel)
                
                bot.send_message(chat_id, message_text, parse_mode='Markdown', reply_markup=markup)
                logger.info(f"Партнёр {chat_id} отсканировал QR-код акции {promotion_id} для клиента {client_id}")
                return
        except (ValueError, IndexError) as e:
            logger.error(f"Ошибка парсинга QR-кода акции: {e}")
            bot.send_message(chat_id, "❌ Ошибка формата QR-кода акции.")
            return
    
    # Старый формат: CLIENT_ID:<chat_id> (только если партнер ожидает ввода ID клиента)
    if is_awaiting_client:
        if qr_data.startswith('CLIENT_ID:'):
            client_id_payload = qr_data.replace('CLIENT_ID:', '', 1).strip()
            client_id = client_id_payload.split(';', 1)[0].strip()
        else:
            # Если формат другой, пытаемся использовать как есть
            client_id = qr_data.strip()
        
        # Проверяем существование клиента
        if not sm.client_exists(client_id):
            bot.send_message(chat_id, 
                f"❌ Клиент с ID `{client_id}` не найден в системе.\n\n"
                "Попробуйте отсканировать QR-код еще раз или введите ID вручную.",
                parse_mode='Markdown'
            )
            return
        
        # Успешно получили ID клиента
        TEMP_DATA[chat_id] = {
            'client_id': client_id,
            'txn_type': 'accrual' if USER_STATE[chat_id] == 'awaiting_client_id_issue' else 'spend'
        }
        USER_STATE[chat_id] = 'awaiting_amount'
        
        current_balance = sm.get_client_balance(client_id)
        bot.send_message(chat_id, f"✅ QR-код успешно распознан!\n\nКлиент ID: `{client_id}`", parse_mode="Markdown")
        prompt_transaction_amount(chat_id, client_id, TEMP_DATA[chat_id]['txn_type'], current_balance)
        logger.info(f"Партнёр {chat_id} отсканировал QR-код клиента {client_id}")
    else:
        # Если партнер не ожидает ввода ID, но отправил фото - возможно это QR-код акции или клиента
        # Проверяем формат CLIENT_ID для обратной совместимости
        if qr_data.startswith('CLIENT_ID:'):
            client_id_payload = qr_data.replace('CLIENT_ID:', '', 1).strip()
            client_id = client_id_payload.split(';', 1)[0].strip()
            
            if sm.client_exists(client_id):
                # Предлагаем выбрать действие
                markup = types.InlineKeyboardMarkup()
                btn_accrual = types.InlineKeyboardButton("➕ Начислить баллы", callback_data=f"qr_accrual_{client_id}")
                btn_spend = types.InlineKeyboardButton("➖ Списать баллы", callback_data=f"qr_spend_{client_id}")
                markup.add(btn_accrual, btn_spend)
                
                current_balance = sm.get_client_balance(client_id)
                bot.send_message(
                    chat_id,
                    f"✅ QR-код клиента распознан!\n\n"
                    f"Клиент ID: `{client_id}`\n"
                    f"Баланс: {current_balance} баллов\n\n"
                    f"Выберите действие:",
                    parse_mode='Markdown',
                    reply_markup=markup
                )
                return
        
        # Если формат не распознан
        bot.send_message(
            chat_id,
            "❓ Не удалось распознать формат QR-кода.\n\n"
            "Поддерживаемые форматы:\n"
            "• PROMOTION:... (для оплаты по акции)\n"
            "• CLIENT_ID:... (для операций с клиентом)\n\n"
            "💡 Используйте меню для выбора операции."
        )


@bot.message_handler(func=lambda message: USER_STATE.get(message.chat.id) in ['awaiting_client_id_issue', 'awaiting_client_id_spend'])
def process_client_id(message):
    chat_id = message.chat.id
    client_id_input = message.text.strip()

    client_id = client_id_input
    if client_id_input.isdigit() and len(client_id_input) >= 10:
        if not sm.client_exists(client_id_input):
            client_id = f"VIA_PARTNER_{client_id_input}"

    if not sm.client_exists(client_id):
        bot.send_message(chat_id, "❌ Клиент с таким ID не найден. Попробуйте снова.")
        USER_STATE.pop(chat_id, None)
        return

    TEMP_DATA[chat_id] = {
        'client_id': client_id,
        'txn_type': 'accrual' if USER_STATE[chat_id] == 'awaiting_client_id_issue' else 'spend'
    }
    USER_STATE[chat_id] = 'awaiting_amount'

    current_balance = sm.get_client_balance(client_id)
    prompt_transaction_amount(chat_id, client_id, TEMP_DATA[chat_id]['txn_type'], current_balance)


@bot.message_handler(func=lambda message: USER_STATE.get(message.chat.id) == 'awaiting_client_id_for_invite')
def process_send_invite_to_client(message):
    """Обрабатывает отправку реферальной ссылки клиенту."""
    chat_id = message.chat.id
    partner_id = str(chat_id)
    client_id_input = message.text.strip()
    
    # Очищаем состояние
    USER_STATE.pop(chat_id, None)
    
    # Проверяем, что клиентский бот доступен
    if not client_bot:
        bot.send_message(
            chat_id,
            "❌ Отправка сообщений клиентам временно недоступна. Используйте кнопку 'Копировать ссылку' для ручной отправки."
        )
        partner_main_menu(chat_id)
        return
    
    # Формируем реферальную ссылку
    link = f"https://t.me/mindbeatybot?start=partner_{partner_id}"
    
    try:
        # Создаем кнопку с прямой ссылкой для клиента
        client_markup = types.InlineKeyboardMarkup()
        client_btn = types.InlineKeyboardButton("🎉 Присоединиться и получить баллы", url=link)
        client_markup.add(client_btn)
        
        # Отправляем ссылку клиенту
        client_bot.send_message(
            client_id_input,
            f"🎉 **Приглашение от партнера!**\n\n"
            f"Вы получили приглашение присоединиться к программе лояльности.\n\n"
            f"💎 При переходе по ссылке вы автоматически получите приветственные баллы!\n\n"
            f"🔗 Ссылка: `{link}`",
            parse_mode='Markdown',
            reply_markup=client_markup
        )
        
        # Подтверждаем партнеру
        bot.send_message(
            chat_id,
            f"✅ **Ссылка успешно отправлена клиенту!**\n\n"
            f"📱 Chat ID клиента: `{client_id_input}`\n"
            f"🔗 Ссылка: `{link}`\n\n"
            f"Клиент получит приветственные баллы при переходе по ссылке.",
            parse_mode='Markdown'
        )
        logger.info(f"Партнер {chat_id} отправил реферальную ссылку клиенту {client_id_input}")
        
    except telebot.apihelper.ApiTelegramException as e:
        if e.error_code == 403:
            bot.send_message(
                chat_id,
                f"❌ **Не удалось отправить сообщение клиенту**\n\n"
                f"Клиент с Chat ID `{client_id_input}` не начал диалог с ботом @mindbeatybot.\n\n"
                f"💡 *Попросите клиента сначала написать боту @mindbeatybot, а затем попробуйте снова.*",
                parse_mode='Markdown'
            )
        elif e.error_code == 400:
            bot.send_message(
                chat_id,
                f"❌ **Неверный Chat ID клиента**\n\n"
                f"Chat ID `{client_id_input}` недействителен.\n\n"
                f"💡 *Проверьте правильность Chat ID и попробуйте снова.*",
                parse_mode='Markdown'
            )
        else:
            log_exception(logger, e, f"Ошибка отправки ссылки клиенту {client_id_input} от партнера {chat_id}")
            bot.send_message(
                chat_id,
                f"❌ Произошла ошибка при отправке ссылки клиенту. Попробуйте позже или используйте кнопку 'Копировать ссылку'."
            )
    except Exception as e:
        log_exception(logger, e, f"Неожиданная ошибка при отправке ссылки клиенту {client_id_input} от партнера {chat_id}")
        bot.send_message(
            chat_id,
            f"❌ Произошла ошибка при отправке ссылки клиенту. Попробуйте позже или используйте кнопку 'Копировать ссылку'."
        )
    
    partner_main_menu(chat_id)


@bot.message_handler(func=lambda message: USER_STATE.get(message.chat.id) == 'awaiting_amount')
def process_amount(message):
    chat_id = message.chat.id

    try:
        amount = float(message.text.strip().replace(',', '.'))
        if amount <= 0:
            raise ValueError
    except ValueError:
        bot.send_message(chat_id, "❌ Неверный формат суммы. Введите корректное число.")
        return

    txn_data = TEMP_DATA.pop(chat_id, None)
    USER_STATE.pop(chat_id, None)

    if not txn_data or 'client_id' not in txn_data:
        bot.send_message(chat_id, "Ошибка сессии. Попробуйте начать снова: /start")
        return

    complete_partner_transaction(chat_id, txn_data['client_id'], txn_data['txn_type'], amount)


# ------------------------------------
# ФУНКЦИОНАЛ: ДАШБОРД ПАРТНЕРА
# ------------------------------------

def handle_partner_dashboard(message):
    """Отправляет ссылку на дашборд партнера с визуализацией метрик."""
    chat_id = message.chat.id
    
    try:
        # Генерируем персональную ссылку на дашборд партнера
        dashboard_url = get_partner_dashboard_url(str(chat_id))
        
        # Используем HTML вместо Markdown для корректной работы с URL
        message_text = (
            "📈 <b>Дашборд партнера</b>\n\n"
            "Ваш персональный дашборд с визуализацией всех метрик:\n\n"
            f"🔗 <a href='{dashboard_url}'>Открыть дашборд</a>\n\n"
            "На дашборде вы найдете:\n"
            "• 📊 График оборота и транзакций\n"
            "• 👥 Динамика клиентской базы\n"
            "• ⭐ NPS метрики и отзывы\n"
            "• 💰 Финансовые показатели\n"
            "• 📈 Тренды и аналитика"
        )
        bot.send_message(chat_id, message_text, parse_mode='HTML', disable_web_page_preview=False)
        logger.info(f"Партнёр {chat_id} запросил дашборд")
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка отправки дашборда партнёру {chat_id}")
        bot.send_message(chat_id, "Произошла ошибка при генерации дашборда.")
    
    partner_main_menu(chat_id)


# ------------------------------------
# ФУНКЦИОНАЛ: REVENUE SHARE
# ------------------------------------

@bot.message_handler(commands=['revenue_share', 'rs', 'revenue'])
def handle_revenue_share_command(message):
    """Команда /revenue_share - показывает статус Revenue Share"""
    if revenue_share is None:
        bot.send_message(message.chat.id, "❌ Revenue Share система временно недоступна.")
        return
    handle_revenue_share_menu(message)

@bot.message_handler(commands=['pv', 'partner_value'])
def handle_pv_command(message):
    """Команда /pv - показывает текущий PV и уровень"""
    if revenue_share is None:
        bot.send_message(message.chat.id, "❌ Revenue Share система временно недоступна.")
        return
    handle_pv_info(message)

@bot.message_handler(commands=['network', 'сеть'])
def handle_network_command(message):
    """Команда /network - показывает реферальную сеть"""
    if revenue_share is None:
        bot.send_message(message.chat.id, "❌ Revenue Share система временно недоступна.")
        return
    handle_network_info(message)

def handle_revenue_share_menu(message):
    """Показывает меню Revenue Share"""
    chat_id = message.chat.id
    partner_chat_id = str(chat_id)
    
    try:
        # Получаем сводку Revenue Share
        summary = revenue_share.get_partner_revenue_share_summary(partner_chat_id)
        
        if 'error' in summary:
            bot.send_message(chat_id, f"❌ Ошибка получения данных: {summary['error']}")
            return
        
        # Формируем сообщение
        status_emoji = "✅" if summary['is_active'] else "⏳"
        status_text = "АКТИВЕН" if summary['is_active'] else "НЕ АКТИВЕН"
        
        # Получаем валюту партнера
        try:
            partner_data_full = sm.get_all_partners()
            if partner_data_full is not None and not partner_data_full.empty:
                partner_info = partner_data_full[partner_data_full['chat_id'] == partner_chat_id]
                if not partner_info.empty:
                    partner_city = partner_info.iloc[0].get('city')
                    currency = get_currency_by_city(partner_city) if partner_city else 'RUB'
                else:
                    currency = 'RUB'
            else:
                currency = 'RUB'
        except:
            currency = 'RUB'
        
        message_text = f"""
💰 **REVENUE SHARE**

{status_emoji} **Статус:** {status_text}

📊 **ТЕКУЩИЕ ПОКАЗАТЕЛИ:**
├─ Личный доход: {format_currency(summary['personal_income'], currency)}/мес
├─ Клиентская база: {summary['client_base_count']} клиентов
├─ Revenue Share за месяц: {format_currency(summary['revenue_share_monthly'], currency)}
├─ Общий Revenue Share: {format_currency(summary['total_revenue_share_earned'], currency)}
└─ Лимит (30%): {format_currency(summary['limit_30_percent'], currency)}/мес

📈 **СООТНОШЕНИЕ:**
├─ От использования: {summary['usage_percent']}%
└─ От Revenue Share: {summary['revenue_share_percent']}%

💵 **ВЫПЛАТЫ:**
├─ Ожидают: {format_currency(summary['period_pending'], currency)}
├─ Выплачено: {format_currency(summary['period_paid'], currency)}
└─ Всего: {format_currency(summary['period_total'], currency)}
"""
        
        if not summary['is_active']:
            message_text += f"""

⚠️ **УСЛОВИЯ АКТИВАЦИИ:**
├─ Личный доход: {format_currency(summary['personal_income'], currency)} / {format_currency(500, currency)} {'✅' if summary['personal_income'] >= 500 else '❌'}
├─ Клиентская база: {summary['client_base_count']} / 20 {'✅' if summary['client_base_count'] >= 20 else '❌'}
└─ Использование продукта: {'✅' if summary['personal_income'] > 0 else '❌'}

Для активации Revenue Share необходимо выполнить все условия.
"""
        
        # Кнопки
        markup = types.InlineKeyboardMarkup(row_width=2)
        btn_pv = types.InlineKeyboardButton("💎 PV уровень", callback_data="revenue_pv")
        btn_network = types.InlineKeyboardButton("🌐 Реферальная сеть", callback_data="revenue_network")
        btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="partner_main_menu")
        
        markup.add(btn_pv, btn_network)
        markup.add(btn_back)
        
        bot.send_message(chat_id, message_text, reply_markup=markup, parse_mode='Markdown')
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка в handle_revenue_share_menu для {chat_id}")
        bot.send_message(chat_id, "❌ Ошибка получения данных Revenue Share. Попробуйте позже.")

def handle_pv_info(message):
    """Показывает информацию о PV"""
    chat_id = message.chat.id
    partner_chat_id = str(chat_id)
    
    try:
        # Получаем PV
        pv = revenue_share.get_partner_pv(partner_chat_id)
        
        if pv is None:
            bot.send_message(chat_id, "❌ Партнер не найден в системе")
            return
        
        # Получаем данные партнера
        partner_data = sm.client.table('partners').select(
            'personal_income_monthly, industry_type'
        ).eq('chat_id', partner_chat_id).single().execute()
        
        if not partner_data.data:
            bot.send_message(chat_id, "❌ Ошибка получения данных партнера")
            return
        
        personal_income = float(partner_data.data.get('personal_income_monthly', 0))
        industry_type = partner_data.data.get('industry_type', 'Не указана')
        
        # Получаем валюту
        try:
            partner_city = sm.get_partner_city(partner_chat_id)
            currency = get_currency_by_city(partner_city) if partner_city else 'RUB'
        except:
            currency = 'RUB'
        
        # Определяем уровень
        if personal_income < 1000:
            level = "Новичок"
            level_emoji = "🌱"
            next_level = "Активный ($1,000/мес)"
            next_income = 1000
        elif personal_income < 2000:
            level = "Активный"
            level_emoji = "⭐"
            next_level = "Растущий ($2,000/мес)"
            next_income = 2000
        elif personal_income < 5000:
            level = "Растущий"
            level_emoji = "🚀"
            next_level = "Премиум ($5,000/мес)"
            next_income = 5000
        else:
            level = "Премиум"
            level_emoji = "👑"
            next_level = "Максимальный уровень"
            next_income = None
        
        # Прогресс до следующего уровня
        if next_income:
            progress = min((personal_income / next_income) * 100, 100)
            progress_bar = "█" * int(progress / 5) + "░" * (20 - int(progress / 5))
        else:
            progress = 100
            progress_bar = "█" * 20
        
        message_text = f"""
💎 **PARTNER VALUE (PV)**

📊 **ТЕКУЩИЙ PV:** {pv}%

{level_emoji} **УРОВЕНЬ:** {level}

💰 **ЛИЧНЫЙ ДОХОД:**
├─ Текущий: {format_currency(personal_income, currency)}/мес
└─ Отрасль: {industry_type}

🎯 **СЛЕДУЮЩИЙ УРОВЕНЬ:**
├─ {next_level}
└─ Прогресс: {progress:.1f}%
   {progress_bar}

📈 **УРОВНИ PV:**
├─ Новичок ($0-999): 3%
├─ Активный ($1,000-1,999): 5%
├─ Растущий ($2,000-4,999): 7%
└─ Премиум ($5,000+): 10%

💡 PV автоматически увеличивается при росте дохода!
"""
        
        markup = types.InlineKeyboardMarkup()
        btn_revenue = types.InlineKeyboardButton("💰 Revenue Share", callback_data="revenue_share_info")
        btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="partner_main_menu")
        markup.add(btn_revenue)
        markup.add(btn_back)
        
        bot.send_message(chat_id, message_text, reply_markup=markup, parse_mode='Markdown')
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка в handle_pv_info для {chat_id}")
        bot.send_message(chat_id, "❌ Ошибка получения данных PV. Попробуйте позже.")

def handle_network_info(message):
    """Показывает реферальную сеть"""
    chat_id = message.chat.id
    partner_chat_id = str(chat_id)
    
    try:
        # Получаем структуру сети
        network = sm.client.table('partner_network').select(
            'referred_chat_id, level, is_active'
        ).eq('referrer_chat_id', partner_chat_id).execute()
        
        if not network.data:
            bot.send_message(
                chat_id,
                "🌐 **РЕФЕРАЛЬНАЯ СЕТЬ**\n\n"
                "У вас пока нет партнеров в сети.\n"
                "Пригласите партнеров, чтобы начать получать Revenue Share!"
            )
            return
        
        # Группируем по уровням
        level_1 = [n for n in network.data if n.get('level') == 1]
        level_2 = [n for n in network.data if n.get('level') == 2]
        level_3 = [n for n in network.data if n.get('level') == 3]
        
        message_text = f"""
🌐 **РЕФЕРАЛЬНАЯ СЕТЬ**

📊 **СТАТИСТИКА:**
├─ Уровень 1: {len(level_1)} партнеров
├─ Уровень 2: {len(level_2)} партнеров
├─ Уровень 3: {len(level_3)} партнеров
└─ Всего: {len(network.data)} партнеров

💰 **REVENUE SHARE:**
Вы получаете 5% от дохода системы с каждого партнера в вашей сети.

💡 Пригласите больше партнеров, чтобы увеличить Revenue Share!
"""
        
        markup = types.InlineKeyboardMarkup()
        btn_revenue = types.InlineKeyboardButton("💰 Revenue Share", callback_data="revenue_share_info")
        btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="partner_main_menu")
        markup.add(btn_revenue)
        markup.add(btn_back)
        
        bot.send_message(chat_id, message_text, reply_markup=markup, parse_mode='Markdown')
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка в handle_network_info для {chat_id}")
        bot.send_message(chat_id, "❌ Ошибка получения данных сети. Попробуйте позже.")

# ------------------------------------
# ФУНКЦИОНАЛ: СТАТИСТИКА ПАРТНЕРА (ОСТАВЛЕНО)
# ------------------------------------

def handle_partner_stats(message):
    """Выводит расширенную статистику Партнера с выбором периода."""
    chat_id = message.chat.id
    
    # Создаем inline меню для выбора периода и типа статистики
    markup = types.InlineKeyboardMarkup(row_width=2)
    
    btn_7d = types.InlineKeyboardButton("📊 7 дней", callback_data="stats_7")
    btn_30d = types.InlineKeyboardButton("📊 30 дней", callback_data="stats_30")
    btn_90d = types.InlineKeyboardButton("📊 90 дней", callback_data="stats_90")
    btn_all = types.InlineKeyboardButton("📊 Всё время", callback_data="stats_all")
    btn_export = types.InlineKeyboardButton("📥 Экспорт данных", callback_data="stats_export")
    btn_cohort = types.InlineKeyboardButton("👥 Когортный анализ", callback_data="stats_cohort")
    btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="partner_main_menu")
    
    markup.add(btn_7d, btn_30d)
    markup.add(btn_90d, btn_all)
    markup.add(btn_export, btn_cohort)
    markup.add(btn_back)
    
    bot.send_message(
        chat_id,
        "📊 **АНАЛИТИКА И СТАТИСТИКА**\n\n"
        "Выберите период для детального отчета:",
        reply_markup=markup,
        parse_mode='Markdown'
    )

@bot.callback_query_handler(func=lambda call: call.data.startswith('stats_'))
def handle_stats_callbacks(call):
    """Обработка выбора типа статистики"""
    chat_id = call.message.chat.id
    
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass
    
    if call.data == 'partner_main_menu':
        partner_main_menu(chat_id)
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'stats_export':
        handle_export_data(chat_id)
        bot.answer_callback_query(call.id)
        return
    
    if call.data == 'stats_cohort':
        handle_cohort_analysis(chat_id)
        bot.answer_callback_query(call.id)
        return
    
    # Определяем период
    period_map = {
        'stats_7': 7,
        'stats_30': 30,
        'stats_90': 90,
        # Для "всё время" используем специальное значение,
        # которое в supabase_manager интерпретируется как "вся история"
        'stats_all': -1
    }
    
    period_days = period_map.get(call.data, 30)
    
    bot.send_message(chat_id, "⏳ Собираю расширенную аналитику...")
    
    try:
        # Получаем расширенную статистику
        stats = sm.get_advanced_partner_stats(str(chat_id), period_days)
        
        if not stats:
            bot.send_message(chat_id, "❌ Ошибка получения статистики")
            partner_main_menu(chat_id)
            bot.answer_callback_query(call.id)
            return
        
        # Получаем информацию о партнере для определения валюты
        partner_city = None
        try:
            partner_data = sm.get_all_partners()
            if partner_data is not None and not partner_data.empty:
                partner_info = partner_data[partner_data['chat_id'] == str(chat_id)]
                if not partner_info.empty:
                    partner_city = partner_info.iloc[0].get('city')
        except Exception as e:
            logger.warning(f"Could not get partner city: {e}")
        
        # Формируем красивый отчет
        period_label = "7 дней" if period_days == 7 else f"{period_days} дней" if period_days < 365 else "Всё время"

        response_text = f"""
📊 **ДЕТАЛЬНАЯ СТАТИСТИКА** (за {period_label})
{'=' * 35}

👥 **КЛИЕНТЫ:**
├─ Всего клиентов: **{stats['total_clients']}** чел.
├─ Активных за период: **{stats['active_clients']}** чел.
├─ Новых за период: **{stats['new_clients']}** чел.
└─ Повторные покупки: **{stats['returning_clients']}** чел.

💰 **ФИНАНСЫ:**
├─ Общий оборот: **{format_currency(stats['total_revenue'], partner_city)}**
├─ Средний чек: **{format_currency(stats['avg_check'], partner_city)}**
└─ Средний LTV: **{format_currency(stats['avg_ltv'], partner_city)}**/клиент

🧾 **ТРАНЗАКЦИИ:**
├─ Всего операций: **{stats['total_transactions']}**
├─ Начислений: **{stats['accrual_transactions']}**
├─ Списаний: **{stats['redemption_transactions']}**
├─ Начислено баллов: **{stats['total_points_accrued']:,}**
└─ Списано баллов: **{stats['total_points_redeemed']:,}**

📈 **ВОВЛЕЧЕННОСТЬ:**
├─ Средняя частота покупок: **{stats['avg_frequency']}** транз/клиент
└─ Churn Rate (отток): **{stats['churn_rate']}%**

⭐ **NPS ИНДЕКС:**
├─ Средний NPS: **{stats['avg_nps']:.2f}**
├─ Чистый NPS: **{stats['nps_score']}**
├─ 🟢 Промоутеры (9-10): **{stats['promoters']}**
├─ 🟡 Нейтральные (7-8): **{stats['passives']}**
├─ 🔴 Детракторы (0-6): **{stats['detractors']}**
└─ 👑 Активных промоутеров: **{stats.get('total_promoters', 0)}**

🎯 **КОНВЕРСИИ:**
├─ Регистрация → Покупка: **{stats['registration_to_first_purchase']}%**
└─ Повторные покупки: **{stats['repeat_purchase_rate']}%**
"""
        
        # Добавляем интерпретацию метрик
        insights = []
        
        if stats['churn_rate'] > 50:
            insights.append("⚠️ Высокий отток клиентов - рекомендуем активировать программу удержания")
        elif stats['churn_rate'] < 20:
            insights.append("✅ Отличное удержание клиентов!")
        
        if stats['repeat_purchase_rate'] > 60:
            insights.append("✅ Высокая лояльность - клиенты возвращаются!")
        elif stats['repeat_purchase_rate'] < 30:
            insights.append("💡 Низкий процент повторных покупок - создайте акции для возврата клиентов")
        
        if stats['nps_score'] > 50:
            insights.append("🌟 Отличный NPS! Клиенты рекомендуют вас")
        elif stats['nps_score'] < 0:
            insights.append("⚠️ Низкий NPS - обратите внимание на качество обслуживания")
        
        if insights:
            response_text += "\n💡 **РЕКОМЕНДАЦИИ:**\n"
            for insight in insights:
                response_text += f"• {insight}\n"

        bot.send_message(chat_id, response_text, parse_mode='Markdown')
        
    except Exception as e:
        logger.error(f"Error showing advanced stats: {e}")
        bot.send_message(chat_id, "❌ Ошибка при формировании статистики")
    
    partner_main_menu(chat_id)
    bot.answer_callback_query(call.id)


def handle_export_data(chat_id):
    """Экспортирует данные партнера в CSV"""
    bot.send_message(chat_id, "📥 Подготовка данных для экспорта...", parse_mode='Markdown')
    
    try:
        # Экспортируем данные за последние 90 дней
        success, result = sm.export_partner_data_to_csv(str(chat_id), period_days=90)
        
        if success:
            # result содержит путь к файлу
            with open(result, 'rb') as file:
                bot.send_document(
                    chat_id,
                    file,
                    caption="📊 **Экспорт данных за последние 90 дней**\n\n"
                           "Файл содержит все транзакции с деталями.\n"
                           "Откройте в Excel или Google Sheets для анализа.",
                    parse_mode='Markdown'
                )
            
            logger.info(f"Данные экспортированы для партнёра {chat_id}")
            
            # Удаляем временный файл
            try:
                os.remove(result)
            except:
                pass
        else:
            bot.send_message(
                chat_id,
                f"❌ Ошибка экспорта: {result}\n\n"
                "Возможно, у вас пока нет данных за этот период.",
                parse_mode='Markdown'
            )
    
    except Exception as e:
        logger.error(f"Error exporting data: {e}")
        bot.send_message(chat_id, "❌ Произошла ошибка при экспорте данных")
    
    partner_main_menu(chat_id)


def handle_cohort_analysis(chat_id):
    """Показывает когортный анализ клиентов"""
    bot.send_message(chat_id, "📊 Формирую когортный анализ...", parse_mode='Markdown')
    
    try:
        cohort_data = sm.get_partner_cohort_analysis(str(chat_id))
        
        if not cohort_data.get('cohorts'):
            bot.send_message(
                chat_id,
                "📊 У вас пока недостаточно данных для когортного анализа.\n\n"
                "Когортный анализ показывает, как ведут себя клиенты, "
                "зарегистрированные в разные месяцы.",
                parse_mode='Markdown'
            )
            partner_main_menu(chat_id)
            return
        
        # Получаем город партнера для форматирования валюты
        partner_city = None
        try:
            partner_data = sm.get_all_partners()
            if partner_data is not None and not partner_data.empty:
                partner_info = partner_data[partner_data['chat_id'] == str(chat_id)]
                if not partner_info.empty:
                    partner_city = partner_info.iloc[0].get('city')
        except Exception:
            pass
        
        response_text = "👥 **КОГОРТНЫЙ АНАЛИЗ**\n"
        response_text += "(клиенты по месяцам регистрации)\n\n"
        
        for cohort in cohort_data['cohorts']:
            response_text += f"📅 **{cohort['month']}**\n"
            response_text += f"├─ Клиентов: {cohort['clients_count']}\n"
            response_text += f"├─ Оборот: {format_currency(cohort['total_revenue'], partner_city)}\n"
            response_text += f"├─ Транзакций: {cohort['total_transactions']}\n"
            response_text += f"└─ Средний чек/клиент: {format_currency(cohort['avg_revenue_per_client'], partner_city)}\n\n"
        
        bot.send_message(chat_id, response_text, parse_mode='Markdown')
        
    except Exception as e:
        logger.error(f"Error in cohort analysis: {e}")
        bot.send_message(chat_id, "❌ Ошибка при формировании когортного анализа")
    
    partner_main_menu(chat_id)


# ------------------------------------
# ФУНКЦИОНАЛ: УПРАВЛЕНИЕ АКЦИЯМИ (ОСТАВЛЕНО)
# ------------------------------------

def handle_promotions_menu(message):
    chat_id = message.chat.id
    if not sm.partner_exists(chat_id) or sm.get_partner_status(chat_id) != 'Approved':
        bot.send_message(chat_id, "У вас нет прав для выполнения этой операции.")
        return

    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_add = types.InlineKeyboardButton("➕ Создать новую акцию", callback_data="promo_add")
    btn_manage = types.InlineKeyboardButton("⚙️ Редактировать / Удалить", callback_data="promo_manage")
    btn_back = types.InlineKeyboardButton("⬅️ Назад в меню", callback_data="partner_main_menu")
    markup.add(btn_add, btn_manage, btn_back)

    bot.send_message(chat_id, "*Управление Акциями:*\nВыберите действие:", reply_markup=markup, parse_mode='Markdown')

# Обработка Callback-запросов
@bot.callback_query_handler(func=lambda call: call.data.startswith('promo_'))
def handle_promo_callbacks(call):
    chat_id = call.message.chat.id
    
    # Пытаемся удалить Inline-клавиатуру, чтобы избежать повторных нажатий
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)  
    except Exception:
        pass

    if call.data == 'promo_add':
        USER_STATE[chat_id] = 'awaiting_promo_type'
        # Заполняем TEMP_DATA начальными данными
        TEMP_DATA[chat_id] = {
            'partner_chat_id': str(chat_id), 
            'start_date': datetime.datetime.now().strftime("%Y-%m-%d"),
            'image_url': None,
            'service_ids': []  # Список выбранных услуг
        } 
        
        # Создаем клавиатуру для выбора типа акции
        markup = types.InlineKeyboardMarkup(row_width=1)
        markup.add(types.InlineKeyboardButton("💰 Обычная скидка", callback_data="promo_type_discount"))
        markup.add(types.InlineKeyboardButton("💸 Обмен баллов на услуги", callback_data="promo_type_points_redemption"))
        markup.add(types.InlineKeyboardButton("🎁 Кэшбэк/Бонусы", callback_data="promo_type_cashback"))
        markup.add(types.InlineKeyboardButton("❌ Отмена", callback_data="promo_cancel"))
        
        msg = bot.send_message(
            chat_id, 
            "✍️ *Создание Акции (Шаг 1 из 7):*\n\n"
            "Выберите **тип акции**:\n\n"
            "💰 *Обычная скидка* - просто скидка без обмена баллов\n"
            "💸 *Обмен баллов* - клиенты могут обменивать баллы на услуги\n"
            "🎁 *Кэшбэк* - начисление баллов за покупку",
            reply_markup=markup,
            parse_mode='Markdown'
        )
    
    elif call.data == 'promo_manage':
        handle_promo_manage_list(chat_id)
    
    elif call.data == 'promo_back':
        # Возвращаемся в меню акций
        markup = types.InlineKeyboardMarkup(row_width=1)
        btn_add = types.InlineKeyboardButton("➕ Создать новую акцию", callback_data="promo_add")
        btn_manage = types.InlineKeyboardButton("⚙️ Редактировать / Удалить", callback_data="promo_manage")
        btn_back = types.InlineKeyboardButton("⬅️ Назад в меню", callback_data="partner_main_menu")
        markup.add(btn_add, btn_manage, btn_back)
        
        bot.edit_message_text(
            "*Управление Акциями:*\nВыберите действие:",
            chat_id, call.message.message_id,
            reply_markup=markup,
            parse_mode='Markdown'
        )
    
    elif call.data.startswith('promo_type_'):
        promo_type = call.data.replace('promo_type_', '')
        if chat_id not in TEMP_DATA:
            TEMP_DATA[chat_id] = {
                'partner_chat_id': str(chat_id),
                'start_date': datetime.datetime.now().strftime("%Y-%m-%d"),
                'image_url': None,
                'service_ids': []
            }
        TEMP_DATA[chat_id]['promotion_type'] = promo_type
        USER_STATE[chat_id] = 'awaiting_promo_title'
        
        type_names = {
            'discount': 'Обычная скидка',
            'points_redemption': 'Обмен баллов на услуги',
            'cashback': 'Кэшбэк/Бонусы'
        }
        
        bot.edit_message_text(
            chat_id=chat_id,
            message_id=call.message.message_id,
            text=f"✅ Выбран тип: **{type_names.get(promo_type, promo_type)}**\n\n"
                 f"✍️ *Создание Акции (Шаг 2 из 7):*\n\n"
                 f"Введите **Заголовок** акции (например: 'Скидка 20% на десерты'):",
            parse_mode='Markdown'
        )
        bot.answer_callback_query(call.id, f"Тип: {type_names.get(promo_type, promo_type)}")
        
        msg = bot.send_message(chat_id, "Введите заголовок акции:")
        bot.register_next_step_handler(msg, process_promo_title)
    
    elif call.data.startswith('promo_toggle_service_'):
        # Переключение выбора услуги
        service_id = call.data.replace('promo_toggle_service_', '')
        if chat_id not in TEMP_DATA:
            TEMP_DATA[chat_id] = {'service_ids': []}
        if 'service_ids' not in TEMP_DATA[chat_id]:
            TEMP_DATA[chat_id]['service_ids'] = []
        
        if service_id in TEMP_DATA[chat_id]['service_ids']:
            TEMP_DATA[chat_id]['service_ids'].remove(service_id)
            bot.answer_callback_query(call.id, "Услуга убрана")
        else:
            TEMP_DATA[chat_id]['service_ids'].append(service_id)
            bot.answer_callback_query(call.id, "Услуга выбрана")
        
        # Обновляем список услуг
        handle_promo_service_selection(chat_id)
    
    elif call.data == 'promo_services_done':
        # Завершение выбора услуг
        selected_count = len(TEMP_DATA.get(chat_id, {}).get('service_ids', []))
        
        if TEMP_DATA[chat_id].get('promotion_type') == 'points_redemption' and selected_count == 0:
            bot.answer_callback_query(call.id, "Выберите хотя бы одну услугу")
            return
        
        # Переходим к параметрам оплаты баллами (если points_redemption)
        if TEMP_DATA[chat_id].get('promotion_type') == 'points_redemption':
            USER_STATE[chat_id] = 'awaiting_promo_service_price'
            bot.edit_message_text(
                chat_id=chat_id,
                message_id=call.message.message_id,
                text=f"✅ Выбрано услуг: {selected_count}\n\n"
                     f"✍️ *Создание Акции (Шаг 7 из 7):*\n\n"
                     f"Введите **стоимость услуги в долларах** (например: 100):",
                parse_mode='Markdown'
            )
            bot.answer_callback_query(call.id, f"Выбрано {selected_count} услуг")
            msg = bot.send_message(chat_id, "Введите стоимость услуги в долларах:")
            bot.register_next_step_handler(msg, process_promo_service_price)
        else:
            # Для других типов акций переходим к фото
            USER_STATE[chat_id] = 'awaiting_promo_photo'
            handle_promo_photo_step(chat_id)
        
    elif call.data == 'promo_cancel':
        TEMP_DATA.pop(chat_id, None)
        USER_STATE.pop(chat_id, None)
        bot.send_message(chat_id, "❌ Операция отменена.")
        partner_main_menu(chat_id)
    
    elif call.data.startswith('promo_approve_'):
        # Формат: promo_approve_{promotion_id}|{client_id} (| используется как разделитель для UUID)
        try:
            # Формат: promo_approve_{promotion_id}|{client_id} (используем | как разделитель для UUID)
            parts = call.data.replace('promo_approve_', '').split('|')
            if len(parts) >= 2:
                promotion_id = parts[0]  # UUID как строка
                client_id = parts[1]
                
                # Получаем данные из TEMP_DATA
                promo_data = TEMP_DATA.get(chat_id, {})
                if not promo_data or str(promo_data.get('promotion_id')) != promotion_id:
                    bot.send_message(chat_id, "❌ Данные транзакции не найдены. Отсканируйте QR-код еще раз.")
                    bot.answer_callback_query(call.id, "Ошибка: данные не найдены")
                    return
                
                points_to_spend = promo_data.get('points_to_spend', 0)
                cash_payment = promo_data.get('cash_payment', 0)
                
                if points_to_spend <= 0:
                    bot.send_message(chat_id, "❌ Некорректные данные транзакции.")
                    bot.answer_callback_query(call.id, "Ошибка данных")
                    return
                
                # Выполняем транзакцию
                bot.answer_callback_query(call.id, "Выполняю транзакцию...")
                bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=call.message.message_id,
                    text=call.message.text + "\n\n⏳ Выполняю транзакцию...",
                    parse_mode='Markdown'
                )
                
                result = sm.execute_promotion_transaction(
                    client_id,
                    str(chat_id),
                    promotion_id,
                    points_to_spend,
                    cash_payment  # Передаем cash_payment вместо purchase_amount
                )
                
                if result.get("success"):
                    # Очищаем временные данные
                    TEMP_DATA.pop(chat_id, None)
                    
                    success_msg = (
                        f"✅ **Транзакция выполнена успешно!**\n\n"
                        f"➖ Списано: **{result.get('points_spent', 0)}** баллов\n"
                        f"➕ Начислено: **{result.get('points_earned', 0)}** баллов\n"
                        f"💰 Новый баланс клиента: **{result.get('new_balance', 0)}** баллов\n\n"
                        f"Клиент ID: `{client_id}`"
                    )
                    
                    if result.get("warning"):
                        success_msg += f"\n\n⚠️ {result.get('warning')}"
                    
                    bot.edit_message_text(
                        chat_id=chat_id,
                        message_id=call.message.message_id,
                        text=success_msg,
                        parse_mode='Markdown'
                    )
                    
                    # Отправляем уведомление клиенту
                    try:
                        if client_bot:
                            client_bot.send_message(
                                client_id,
                                f"✅ **Оплата по акции выполнена!**\n\n"
                                f"➖ Списано: {result.get('points_spent', 0)} баллов\n"
                                f"➕ Начислено: {result.get('points_earned', 0)} баллов\n"
                                f"💰 Ваш баланс: {result.get('new_balance', 0)} баллов",
                                parse_mode='Markdown'
                            )
                    except Exception as e:
                        logger.warning(f"Не удалось отправить уведомление клиенту {client_id}: {e}")
                    
                    logger.info(f"Партнёр {chat_id} одобрил транзакцию по акции {promotion_id} для клиента {client_id}")
                else:
                    error_msg = f"❌ **Ошибка выполнения транзакции:**\n\n{result.get('error', 'Неизвестная ошибка')}"
                    bot.edit_message_text(
                        chat_id=chat_id,
                        message_id=call.message.message_id,
                        text=error_msg,
                        parse_mode='Markdown'
                    )
                    bot.answer_callback_query(call.id, "Ошибка транзакции", show_alert=True)
        except (ValueError, KeyError) as e:
            logger.error(f"Ошибка обработки подтверждения акции: {e}")
            bot.send_message(chat_id, "❌ Ошибка обработки запроса.")
            bot.answer_callback_query(call.id, "Ошибка обработки")
        
    elif call.data == 'partner_main_menu':
        partner_main_menu(chat_id)
    
    # Важно: отвечаем на callback query (если еще не ответили)
    if not call.data.startswith('promo_approve_'):
        bot.answer_callback_query(call.id)


# Обработчик для QR-кодов клиентов (выбор операции)
@bot.callback_query_handler(func=lambda call: call.data.startswith('qr_accrual_') or call.data.startswith('qr_spend_'))
def handle_qr_operation(call):
    """Обработка выбора операции после сканирования QR клиента."""
    chat_id = call.message.chat.id
    
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass
    
    try:
        parts = call.data.split('_')
        operation = parts[1]  # accrual или spend
        client_id = '_'.join(parts[2:])  # client_id может содержать подчеркивания
        
        if not sm.client_exists(client_id):
            bot.send_message(chat_id, f"❌ Клиент с ID `{client_id}` не найден.", parse_mode='Markdown')
            bot.answer_callback_query(call.id, "Клиент не найден")
            return
        
        TEMP_DATA[chat_id] = {
            'client_id': client_id,
            'txn_type': operation
        }
        USER_STATE[chat_id] = 'awaiting_amount'
        
        current_balance = sm.get_client_balance(client_id)
        bot.edit_message_text(
            chat_id=chat_id,
            message_id=call.message.message_id,
            text=f"✅ Клиент ID: `{client_id}`\nБаланс: {current_balance} баллов",
            parse_mode='Markdown'
        )
        prompt_transaction_amount(chat_id, client_id, operation, current_balance)
        bot.answer_callback_query(call.id)
    except Exception as e:
        logger.error(f"Ошибка обработки QR операции: {e}")
        bot.send_message(chat_id, "❌ Ошибка обработки запроса.")
        bot.answer_callback_query(call.id, "Ошибка")

def process_promo_title(message):
    chat_id = message.chat.id
    if len(message.text.strip()) < 3:
        msg = bot.send_message(chat_id, "Заголовок слишком короткий. Введите более подробный заголовок:")
        bot.register_next_step_handler(msg, process_promo_title)
        return

        TEMP_DATA[chat_id]['title'] = message.text.strip()
    USER_STATE[chat_id] = 'awaiting_promo_description'
    
    step_num = "3" if TEMP_DATA[chat_id].get('promotion_type') else "2"
    total_steps = "7" if TEMP_DATA[chat_id].get('promotion_type') == 'points_redemption' else "6"
    
    msg = bot.send_message(chat_id, f"✍️ *Создание Акции (Шаг {step_num} из {total_steps}):*\n\n{step_num}. Введите **Описание** акции (подробности и условия):", parse_mode='Markdown')
    bot.register_next_step_handler(msg, process_promo_description)

def process_promo_description(message):
    chat_id = message.chat.id
    TEMP_DATA[chat_id]['description'] = message.text.strip()
    USER_STATE[chat_id] = 'awaiting_promo_discount'
    
    step_num = "4" if TEMP_DATA[chat_id].get('promotion_type') else "3"
    total_steps = "7" if TEMP_DATA[chat_id].get('promotion_type') == 'points_redemption' else "6"
    
    msg = bot.send_message(chat_id, f"✍️ *Создание Акции (Шаг {step_num} из {total_steps}):*\n\n{step_num}. Введите **Размер скидки/Бонуса** (например: '20%' или 'x2 бонуса'):", parse_mode='Markdown')
    bot.register_next_step_handler(msg, process_promo_discount)

def process_promo_discount(message):
    chat_id = message.chat.id
    TEMP_DATA[chat_id]['discount_value'] = message.text.strip()
    USER_STATE[chat_id] = 'awaiting_promo_end_date'
    
    step_num = "5" if TEMP_DATA[chat_id].get('promotion_type') else "4"
    total_steps = "7" if TEMP_DATA[chat_id].get('promotion_type') == 'points_redemption' else "6"
    
    msg = bot.send_message(chat_id, f"✍️ *Создание Акции (Шаг {step_num} из {total_steps}):*\n\n{step_num}. Введите **Дату окончания** акции в формате *ДД.ММ.ГГГГ* (например: 31.12.2025):", parse_mode='Markdown')
    bot.register_next_step_handler(msg, process_promo_end_date)

def process_promo_end_date(message):
    chat_id = message.chat.id
    date_str = message.text.strip()
    
    try:
        # Проверяем формат и конвертируем в формат YYYY-MM-DD для БД
        end_date = datetime.datetime.strptime(date_str, "%d.%m.%Y")
        db_date_format = end_date.strftime("%Y-%m-%d")

        # Проверка, что дата не в прошлом
        if end_date.date() < datetime.date.today():
             msg = bot.send_message(chat_id, "❌ Дата окончания не может быть в прошлом. Пожалуйста, введите корректную дату:", parse_mode='Markdown')
             bot.register_next_step_handler(msg, process_promo_end_date)
             return

        TEMP_DATA[chat_id]['end_date'] = db_date_format
    except ValueError:
        msg = bot.send_message(chat_id, "❌ Неверный формат даты. Пожалуйста, введите дату в формате *ДД.ММ.ГГГГ* (например: 31.12.2025):", parse_mode='Markdown')
        bot.register_next_step_handler(msg, process_promo_end_date)
        return

    # Проверяем тип акции - если points_redemption, нужно выбрать услуги
    promotion_type = TEMP_DATA[chat_id].get('promotion_type', 'discount')
    
    if promotion_type == 'points_redemption':
        # Переходим к выбору услуг (Шаг 6)
        USER_STATE[chat_id] = 'awaiting_promo_services'
        handle_promo_service_selection(chat_id)
    else:
        # Переходим к загрузке фото (Шаг 6 для обычных акций)
        USER_STATE[chat_id] = 'awaiting_promo_photo'
        handle_promo_photo_step(chat_id)

def handle_promo_service_selection(chat_id):
    """Показывает список услуг партнера для выбора"""
    try:
        # Получаем одобренные услуги партнера
        services = sm.get_partner_services(str(chat_id))
        approved_services = [s for s in services if s.get('approval_status') == 'Approved' and s.get('is_active')]
        
        if not approved_services:
            bot.send_message(
                chat_id,
                "❌ У вас нет одобренных услуг.\n\n"
                "Сначала создайте и получите одобрение услуг, затем создавайте акцию для обмена баллов.",
                parse_mode='Markdown'
            )
            TEMP_DATA.pop(chat_id, None)
            USER_STATE.pop(chat_id, None)
            partner_main_menu(chat_id)
            return
        
        # Инициализируем список выбранных услуг если его нет
        if 'service_ids' not in TEMP_DATA[chat_id]:
            TEMP_DATA[chat_id]['service_ids'] = []
        
        # Создаем клавиатуру с услугами
        markup = types.InlineKeyboardMarkup(row_width=1)
        
        for service in approved_services[:10]:  # Ограничиваем до 10 услуг
            service_id = service.get('id')
            title = service.get('title', 'Без названия')
            price = service.get('price_points', 0)
            is_selected = service_id in TEMP_DATA[chat_id]['service_ids']
            
            button_text = f"{'✅ ' if is_selected else ''}{title} ({price} баллов)"
            callback_data = f"promo_toggle_service_{service_id}"
            markup.add(types.InlineKeyboardButton(button_text, callback_data=callback_data))
        
        # Кнопка "Готово"
        selected_count = len(TEMP_DATA[chat_id]['service_ids'])
        markup.add(types.InlineKeyboardButton(
            f"✅ Готово ({selected_count} выбрано)" if selected_count > 0 else "➡️ Продолжить без услуг",
            callback_data="promo_services_done"
        ))
        markup.add(types.InlineKeyboardButton("❌ Отмена", callback_data="promo_cancel"))
        
        bot.send_message(
            chat_id,
            f"✍️ *Создание Акции (Шаг 6 из 7):*\n\n"
            f"Выберите **услуги** для акции (можно выбрать несколько):\n\n"
            f"Выбрано: {selected_count}",
            reply_markup=markup,
            parse_mode='Markdown'
        )
    except Exception as e:
        logger.error(f"Error in handle_promo_service_selection: {e}")
        bot.send_message(chat_id, "❌ Ошибка при получении списка услуг.")
        partner_main_menu(chat_id)

def handle_promo_photo_step(chat_id):
    """Показывает шаг загрузки фото"""
    promotion_type = TEMP_DATA[chat_id].get('promotion_type', 'discount')
    step_num = "7" if promotion_type == 'points_redemption' else "6"
    total_steps = "7" if promotion_type == 'points_redemption' else "6"
    
    # Создаём кнопку для пропуска загрузки фото
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
    markup.add(types.KeyboardButton("⏩ Пропустить загрузку фото"))
    
    bot.send_message(
        chat_id, 
        f"📸 *Создание Акции (Шаг {step_num} из {total_steps}):*\n\n"
        f"{step_num}. Загрузите **Изображение** для акции (фото товара, баннер и т.д.)\n\n"
        f"Или нажмите кнопку *'Пропустить'* для создания акции без изображения.",
        reply_markup=markup,
        parse_mode='Markdown'
    )
    
    bot.register_next_step_handler_by_chat_id(chat_id, process_promo_photo)

def process_promo_photo(message):
    """Обработка загрузки фото для акции (новый шаг 5)"""
    chat_id = message.chat.id
    
    # Убираем кастомную клавиатуру
    markup_remove = types.ReplyKeyboardRemove()
    
    # Проверяем - пропустил ли пользователь загрузку
    if message.text and message.text == "⏩ Пропустить загрузку фото":
        # Сохраняем без фото
        bot.send_message(chat_id, "⏳ Сохранение акции без изображения...", reply_markup=markup_remove)
        save_promotion(chat_id)
        return
    
    # Проверяем, что это фото
    if not message.photo:
        msg = bot.send_message(
            chat_id, 
            "❌ Пожалуйста, отправьте изображение или нажмите *'Пропустить'*.",
            parse_mode='Markdown',
            reply_markup=markup_remove
        )
        
        # Возвращаем кнопку пропуска
        markup = types.ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
        markup.add(types.KeyboardButton("⏩ Пропустить загрузку фото"))
        bot.send_message(chat_id, "Выберите действие:", reply_markup=markup)
        
        bot.register_next_step_handler_by_chat_id(chat_id, process_promo_photo)
        return
    
    # Получаем file_id самого большого размера фото
    file_id = message.photo[-1].file_id
    
    # Отправляем сообщение о начале обработки
    processing_msg = bot.send_message(
        chat_id, 
        "📸 Обрабатываю изображение...\n⏳ Пожалуйста, подождите.", 
        reply_markup=markup_remove
    )
    
    try:
        # Обрабатываем и загружаем фото
        success, result = process_photo_for_promotion(file_id, PARTNER_TOKEN)
        
        if success:
            # result - это URL загруженного изображения
            TEMP_DATA[chat_id]['image_url'] = result
            try:
                bot.edit_message_text(
                    "✅ Изображение успешно загружено!",
                    chat_id,
                    processing_msg.message_id
                )
            except:
                # Если не можем редактировать, отправляем новое сообщение
                bot.send_message(chat_id, "✅ Изображение успешно загружено!")
        else:
            # result - это сообщение об ошибке
            try:
                bot.edit_message_text(
                    f"❌ Ошибка загрузки изображения:\n{result}\n\nАкция будет создана без изображения.",
                    chat_id,
                    processing_msg.message_id
                )
            except:
                # Если не можем редактировать, отправляем новое сообщение
                bot.send_message(
                    chat_id,
                    f"❌ Ошибка загрузки изображения:\n{result}\n\nАкция будет создана без изображения."
                )
    
    except Exception as e:
        logger.error(f"Error processing photo: {e}")
        try:
            bot.edit_message_text(
                f"❌ Ошибка при обработке изображения.\nАкция будет создана без изображения.",
                chat_id,
                processing_msg.message_id
            )
        except:
            # Если не можем редактировать, отправляем новое сообщение
            bot.send_message(
                chat_id,
                f"❌ Ошибка при обработке изображения.\nАкция будет создана без изображения."
            )
    
    # Сохраняем акцию (с фото или без)
    bot.send_message(chat_id, "⏳ Сохранение акции...")
    save_promotion(chat_id)

def process_promo_service_price(message):
    """Обработка стоимости услуги"""
    chat_id = message.chat.id
    
    try:
        service_price = float(message.text.strip())
        if service_price <= 0:
            msg = bot.send_message(chat_id, "❌ Стоимость должна быть больше 0. Введите стоимость:")
            bot.register_next_step_handler(msg, process_promo_service_price)
            return
        
        TEMP_DATA[chat_id]['service_price'] = service_price
        USER_STATE[chat_id] = 'awaiting_promo_max_points'
        
        msg = bot.send_message(
            chat_id,
            f"✅ Стоимость услуги: ${service_price}\n\n"
            f"Введите **максимальную сумму оплаты баллами** в долларах (например: {min(50, service_price)}):\n\n"
            f"Максимум: ${service_price}",
            parse_mode='Markdown'
        )
        bot.register_next_step_handler(msg, process_promo_max_points)
    except ValueError:
        msg = bot.send_message(chat_id, "❌ Неверный формат. Введите число (например: 100):")
        bot.register_next_step_handler(msg, process_promo_service_price)

def process_promo_max_points(message):
    """Обработка максимальной оплаты баллами"""
    chat_id = message.chat.id
    service_price = TEMP_DATA[chat_id].get('service_price', 0)
    
    try:
        max_points = float(message.text.strip())
        if max_points <= 0:
            msg = bot.send_message(chat_id, "❌ Сумма должна быть больше 0. Введите сумму:")
            bot.register_next_step_handler(msg, process_promo_max_points)
            return
        if max_points > service_price:
            msg = bot.send_message(
                chat_id,
                f"❌ Максимальная оплата не может быть больше стоимости услуги (${service_price}). Введите сумму:"
            )
            bot.register_next_step_handler(msg, process_promo_max_points)
            return
        
        TEMP_DATA[chat_id]['max_points_payment'] = max_points
        USER_STATE[chat_id] = 'awaiting_promo_points_rate'
        
        msg = bot.send_message(
            chat_id,
            f"✅ Максимальная оплата баллами: ${max_points}\n\n"
            f"Введите **курс обмена** (сколько долларов стоит 1 балл):\n\n"
            f"По умолчанию: 1.0 (1 балл = $1)",
            parse_mode='Markdown'
        )
        bot.register_next_step_handler(msg, process_promo_points_rate)
    except ValueError:
        msg = bot.send_message(chat_id, "❌ Неверный формат. Введите число (например: 50):")
        bot.register_next_step_handler(msg, process_promo_max_points)

def process_promo_points_rate(message):
    """Обработка курса обмена"""
    chat_id = message.chat.id
    
    try:
        rate = float(message.text.strip())
        if rate <= 0:
            msg = bot.send_message(chat_id, "❌ Курс должен быть больше 0. Введите курс:")
            bot.register_next_step_handler(msg, process_promo_points_rate)
            return
        
        TEMP_DATA[chat_id]['points_to_dollar_rate'] = rate
        
        # Переходим к загрузке фото
        USER_STATE[chat_id] = 'awaiting_promo_photo'
        handle_promo_photo_step(chat_id)
    except ValueError:
        msg = bot.send_message(chat_id, "❌ Неверный формат. Введите число (например: 1.0):")
        bot.register_next_step_handler(msg, process_promo_points_rate)

def save_promotion(chat_id):
    """Сохранение акции в БД"""
    promo_data = TEMP_DATA.pop(chat_id, None)
    USER_STATE.pop(chat_id, None)

    if not promo_data:
        bot.send_message(chat_id, "❌ Ошибка сессии. Попробуйте начать снова: /start")
        return
    
    # Логируем данные акции для отладки
    logger.info(f"Saving promotion data: {promo_data}")
        
    try:
        success = sm.add_promotion(promo_data)
        
        if success:
            logger.info(f"Promotion saved successfully for partner {chat_id}")
            if promo_data.get('image_url'):
                bot.send_message(
                    chat_id, 
                    "🎉 **Акция с изображением успешно создана!**\n\n"
                    "Она будет отображена в приложении с вашим фото.",
                    parse_mode='Markdown'
                )
            else:
                bot.send_message(
                    chat_id, 
                    "🎉 **Акция успешно создана!**\n\n"
                    "Она будет отображена с placeholder изображением.",
                    parse_mode='Markdown'
                )
        else:
            logger.error(f"Failed to save promotion for partner {chat_id}. Data: {promo_data}")
            bot.send_message(chat_id, "❌ Ошибка при сохранении акции. Проверьте логи.")

    except Exception as e:
        logger.error(f"Exception saving promotion for partner {chat_id}: {e}")
        bot.send_message(chat_id, "❌ Произошла системная ошибка при сохранении акции.")

    partner_main_menu(chat_id)


# ------------------------------------
# ФУНКЦИОНАЛ: УПРАВЛЕНИЕ УСЛУГАМИ (ОСТАВЛЕНО)
# ------------------------------------

def handle_services_menu(message):
    chat_id = message.chat.id
    if not sm.partner_exists(chat_id) or sm.get_partner_status(chat_id) != 'Approved':
        bot.send_message(chat_id, "У вас нет прав для выполнения этой операции.")
        return

    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_add = types.InlineKeyboardButton("➕ Добавить новую услугу", callback_data="service_add")
    btn_manage = types.InlineKeyboardButton("🔍 Мои услуги", callback_data="service_status")
    btn_edit = types.InlineKeyboardButton("✏️ Редактировать услугу", callback_data="service_edit_list")
    btn_delete = types.InlineKeyboardButton("🗑️ Удалить услугу", callback_data="service_delete_list")
    btn_back = types.InlineKeyboardButton("⬅️ Назад в меню", callback_data="partner_main_menu")
    markup.add(btn_add, btn_manage, btn_edit, btn_delete, btn_back)

    bot.send_message(chat_id, "*Управление Услугами:*\nСоздайте услугу, которая будет доступна для обмена баллов клиентами (требуется одобрение Администратора).", reply_markup=markup, parse_mode='Markdown')

# Обработка Callback-запросов для Услуг
@bot.callback_query_handler(func=lambda call: call.data.startswith('service_'))
def handle_service_callbacks(call):
    chat_id = call.message.chat.id
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None) 
    except Exception:
        pass
    
    # Обработка выбора категории услуги
    if call.data.startswith('service_category_'):
        category = call.data.replace('service_category_', '')
        process_service_category_save(chat_id, category)
        bot.answer_callback_query(call.id, f"Категория выбрана: {category}")
        return
        
    if call.data == 'service_add':
        USER_STATE[chat_id] = 'awaiting_service_title'
        TEMP_DATA[chat_id] = {
            'partner_chat_id': str(chat_id),
            'approval_status': 'Pending'  # Явно устанавливаем статус
        }
        
        msg = bot.send_message(chat_id, "✍️ *Создание Услуги (Шаг 1 из 4):*\n\n1. Введите **Название** услуги (например: 'Бесплатный кофе', 'Скидка 500 руб.'):", parse_mode='Markdown')
        bot.register_next_step_handler(msg, process_service_title)
    
    elif call.data == 'service_status':
        handle_service_status_list(chat_id)
    
    elif call.data == 'service_edit_list':
        handle_service_edit_list(chat_id)
    
    elif call.data == 'service_delete_list':
        handle_service_delete_list(chat_id)
    
    elif call.data == 'service_back':
        # Возвращаемся в меню услуг
        markup = types.InlineKeyboardMarkup(row_width=1)
        btn_add = types.InlineKeyboardButton("➕ Добавить новую услугу", callback_data="service_add")
        btn_manage = types.InlineKeyboardButton("🔍 Мои услуги", callback_data="service_status")
        btn_edit = types.InlineKeyboardButton("✏️ Редактировать услугу", callback_data="service_edit_list")
        btn_delete = types.InlineKeyboardButton("🗑️ Удалить услугу", callback_data="service_delete_list")
        btn_back = types.InlineKeyboardButton("⬅️ Назад в меню", callback_data="partner_main_menu")
        markup.add(btn_add, btn_manage, btn_edit, btn_delete, btn_back)
        
        bot.edit_message_text(
            "*Управление Услугами:*\nСоздайте услугу, которая будет доступна для обмена баллов клиентами (требуется одобрение Администратора).",
            chat_id, call.message.message_id,
            reply_markup=markup,
            parse_mode='Markdown'
        )

    elif call.data == 'partner_main_menu':
        partner_main_menu(chat_id)
    
    # Важно: отвечаем на callback query
    bot.answer_callback_query(call.id)


@bot.callback_query_handler(func=lambda call: call.data.startswith('edit_service_') or call.data.startswith('edit_field_'))
def handle_service_edit_callbacks(call):
    """Обработчик callback'ов для редактирования услуг."""
    chat_id = call.message.chat.id
    
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass
    
    if call.data.startswith('edit_service_'):
        # Формат: edit_service_<service_id> (service_id может быть UUID или int)
        try:
            service_id = call.data.replace('edit_service_', '')
            # Пытаемся преобразовать в int, если не получается - оставляем как строку (UUID)
            try:
                service_id = int(service_id)
            except ValueError:
                pass  # Оставляем как строку для UUID
            handle_service_edit_menu(chat_id, service_id)
        except Exception as e:
            log_exception(logger, e, f"Ошибка парсинга service_id из {call.data}")
            bot.send_message(chat_id, "❌ Ошибка при обработке запроса. Попробуйте еще раз.")
    
    elif call.data.startswith('edit_field_'):
        # Формат: edit_field_<service_id>|<field> (используем | как разделитель для UUID)
        try:
            data_part = call.data.replace('edit_field_', '')
            # Проверяем, есть ли разделитель |
            if '|' in data_part:
                parts = data_part.split('|', 1)
                service_id = parts[0]
                field = parts[1]
            else:
                # Старый формат для обратной совместимости: edit_field_<service_id>_<field>
                parts = data_part.split('_', 1)
                if len(parts) == 2:
                    service_id = parts[0]
                    field = parts[1]
                else:
                    raise ValueError("Неверный формат callback_data")
            
            # Пытаемся преобразовать в int, если не получается - оставляем как строку (UUID)
            try:
                service_id = int(service_id)
            except ValueError:
                pass  # Оставляем как строку для UUID
                
            handle_service_field_edit(chat_id, service_id, field)
        except (ValueError, IndexError) as e:
            log_exception(logger, e, f"Ошибка парсинга edit_field из {call.data}")
            bot.send_message(chat_id, "❌ Ошибка при обработке запроса. Попробуйте еще раз.")
    
    bot.answer_callback_query(call.id)


@bot.callback_query_handler(func=lambda call: call.data.startswith('delete_service_') or call.data.startswith('confirm_delete_service_') or call.data == 'cancel_delete_service')
def handle_service_delete_callbacks(call):
    """Обработчик callback'ов для удаления услуг."""
    chat_id = call.message.chat.id
    
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass
    
    if call.data.startswith('delete_service_'):
        # Формат: delete_service_<service_id> - показываем подтверждение
        try:
            service_id = call.data.replace('delete_service_', '')
            handle_service_delete_confirmation(chat_id, service_id)
        except Exception as e:
            log_exception(logger, e, f"Ошибка парсинга service_id из {call.data}")
            bot.send_message(chat_id, "❌ Ошибка при обработке запроса. Попробуйте еще раз.")
    elif call.data.startswith('confirm_delete_service_'):
        # Формат: confirm_delete_service_<service_id> - подтверждаем удаление
        try:
            service_id = call.data.replace('confirm_delete_service_', '')
            handle_service_delete(chat_id, service_id)
        except Exception as e:
            log_exception(logger, e, f"Ошибка парсинга service_id из {call.data}")
            bot.send_message(chat_id, "❌ Ошибка при обработке запроса. Попробуйте еще раз.")
    elif call.data == 'cancel_delete_service':
        # Отмена удаления - возвращаемся к списку услуг
        handle_service_delete_list(chat_id)
    
    bot.answer_callback_query(call.id)


def process_service_title(message):
    chat_id = message.chat.id
    TEMP_DATA[chat_id]['title'] = message.text.strip()
    USER_STATE[chat_id] = 'awaiting_service_description'
    
    msg = bot.send_message(chat_id, "✍️ *Создание Услуги (Шаг 2 из 4):*\n\n2. Введите **Описание** услуги (подробности, ограничения, как получить):", parse_mode='Markdown')
    bot.register_next_step_handler(msg, process_service_description)

def process_service_description(message):
    chat_id = message.chat.id
    TEMP_DATA[chat_id]['description'] = message.text.strip()
    USER_STATE[chat_id] = 'awaiting_service_price'
    
    msg = bot.send_message(chat_id, "✍️ *Создание Услуги (Шаг 3 из 4):*\n\n3. Введите **Стоимость** услуги в *баллах* (целое число, например: 100):", parse_mode='Markdown')
    bot.register_next_step_handler(msg, process_service_price)

def process_service_price(message):
    chat_id = message.chat.id
    
    try:
        price = int(message.text.strip())
        if price <= 0:
            raise ValueError
        TEMP_DATA[chat_id]['price_points'] = price
    except ValueError:
        msg = bot.send_message(chat_id, "❌ Неверный формат. Введите *целое число* баллов больше нуля.")
        bot.register_next_step_handler(msg, process_service_price)
        return

    # Переходим к выбору категории
    USER_STATE[chat_id] = 'awaiting_service_category'
    
    # Создаём клавиатуру с категориями услуг
    markup = types.InlineKeyboardMarkup(row_width=2)
    
    categories = [
        ('💅', 'manicure', 'Маникюр'),
        ('💇‍♀️', 'hairstyle', 'Прически'),
        ('💆‍♀️', 'massage', 'Массаж'),
        ('🧴', 'cosmetologist', 'Косметолог'),
        ('✨', 'eyebrows', 'Брови'),
        ('👁️', 'eyelashes', 'Ресницы'),
        ('💫', 'laser', 'Лазерная эпиляция'),
        ('💄', 'makeup', 'Визажист'),
        ('🌸', 'skincare', 'Уход за кожей'),
        ('🧹', 'cleaning', 'Уборка'),
        ('🔧', 'repair', 'Ремонт'),
        ('🚗', 'delivery', 'Доставка'),
        ('🏃‍♀️', 'fitness', 'Фитнес'),
        ('🛁', 'spa', 'SPA'),
        ('🧘‍♀️', 'yoga', 'Йога'),
        ('🥗', 'nutrition', 'Питание'),
        ('🧠', 'psychology', 'Психолог')
    ]
    
    # Добавляем кнопки по 2 в ряд
    for i in range(0, len(categories), 2):
        row = []
        for j in range(2):
            if i + j < len(categories):
                emoji, category_key, category_name = categories[i + j]
                row.append(types.InlineKeyboardButton(
                    f"{emoji} {category_name}",
                    callback_data=f"service_category_{category_key}"
                ))
        markup.add(*row)
    
    msg = bot.send_message(
        chat_id,
        "✍️ *Создание Услуги (Шаг 4 из 4):*\n\n4. Выберите **Категорию** услуги:",
        reply_markup=markup,
        parse_mode='Markdown'
    )


def process_service_category_save(chat_id, category):
    """Сохраняет услугу после выбора категории"""
    TEMP_DATA[chat_id]['category'] = category
    
    service_data = TEMP_DATA.pop(chat_id, None)
    USER_STATE.pop(chat_id, None)

    if not service_data:
        bot.send_message(chat_id, "Ошибка сессии. Попробуйте начать снова: /start")
        return

    # Логируем данные услуги для отладки
    logger.info(f"Saving service data: {service_data}")

    try:
        success = sm.add_service(service_data)

        if success:
            bot.send_message(chat_id, "✅ **Услуга отправлена на модерацию!**\nАдминистратор рассмотрит вашу заявку и одобрит услугу, после чего она станет доступна клиентам.", parse_mode='Markdown')
        else:
            logger.error(f"Failed to save service for partner {chat_id}. Data: {service_data}")
            bot.send_message(chat_id, "❌ Ошибка при сохранении услуги. Проверьте логи.")
            
    except Exception as e:
        log_exception(logger, e, f"Exception saving service for partner {chat_id}")
        bot.send_message(chat_id, "Произошла системная ошибка при сохранении услуги.")

    partner_main_menu(chat_id)


# ------------------------------------
# ФУНКЦИОНАЛ: ПОИСК КЛИЕНТА (НОВОЕ)
# ------------------------------------

def handle_find_client(message):
    """Поиск клиента по номеру телефона."""
    chat_id = message.chat.id
    USER_STATE[chat_id] = 'awaiting_client_phone_search'
    bot.send_message(chat_id, "📱 Введите номер телефона клиента для поиска (например: 79991234567):")

@bot.message_handler(func=lambda message: USER_STATE.get(message.chat.id) == 'awaiting_client_phone_search')
def process_client_phone_search(message):
    chat_id = message.chat.id
    phone = message.text.strip().replace('+', '').replace(' ', '').replace('-', '')
    
    try:
        client_data = sm.get_client_by_phone(phone)
        
        if client_data:
            balance = client_data.get('balance', 0)
            name = client_data.get('name', 'Не указано')
            status = client_data.get('status', 'Неизвестно')
            client_chat_id = client_data.get('chat_id', 'N/A')
            
            response = f"✅ **Клиент найден:**\n\n"
            response += f"👤 Имя: {name}\n"
            response += f"📱 Телефон: {phone}\n"
            response += f"💰 Баланс: {balance} баллов\n"
            response += f"📊 Статус: {status}\n"
            response += f"🆔 Chat ID: `{client_chat_id}`"
            
            bot.send_message(chat_id, response, parse_mode='Markdown')
            logger.info(f"Партнёр {chat_id} нашёл клиента {client_chat_id} по телефону")
        else:
            bot.send_message(chat_id, f"❌ Клиент с номером **{phone}** не найден в системе.", parse_mode='Markdown')
            logger.info(f"Партнёр {chat_id} не нашёл клиента по телефону {phone}")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка поиска клиента партнёром {chat_id}")
        bot.send_message(chat_id, "Произошла ошибка при поиске клиента.")
    
    USER_STATE.pop(chat_id, None)
    partner_main_menu(chat_id)


# ------------------------------------
# ФУНКЦИОНАЛ: НАСТРОЙКИ ПАРТНЕРА (НОВОЕ)
# ------------------------------------

def handle_partner_settings(message):
    """Показывает меню настроек партнёра."""
    chat_id = message.chat.id
    
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_bonus = types.InlineKeyboardButton("🎁 Изменить приветственный бонус", callback_data="settings_bonus")
    btn_info = types.InlineKeyboardButton("ℹ️ Моя информация", callback_data="settings_info")
    btn_edit = types.InlineKeyboardButton("✏️ Редактировать данные", callback_data="settings_edit")
    btn_back = types.InlineKeyboardButton("⬅️ Назад в меню", callback_data="partner_main_menu")
    markup.add(btn_bonus, btn_info, btn_edit, btn_back)
    
    bot.send_message(chat_id, "*⚙️ Настройки партнёра:*\nВыберите действие:", reply_markup=markup, parse_mode='Markdown')

@bot.callback_query_handler(func=lambda call: call.data.startswith('settings_'))
def handle_settings_callbacks(call):
    chat_id = call.message.chat.id
    
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass
    
    if call.data == 'settings_info':
        try:
            # Получаем информацию о партнёре из БД
            partner_data = sm.get_all_partners()
            partner_info = partner_data[partner_data['chat_id'] == str(chat_id)]
            
            if not partner_info.empty:
                partner = partner_info.iloc[0]
                info_text = f"**Информация о вашем аккаунте:**\n\n"
                info_text += f"👤 Имя: {partner.get('name', 'Не указано')}\n"
                info_text += f"🏢 Компания: {partner.get('company_name', 'Не указано')}\n"
                info_text += f"📱 Телефон: {partner.get('phone', 'Не указан')}\n"
                info_text += f"📊 Статус: {partner.get('status', 'Неизвестно')}\n"
                info_text += f"🆔 Chat ID: `{chat_id}`"
                
                bot.send_message(chat_id, info_text, parse_mode='Markdown')
                logger.info(f"Партнёр {chat_id} просмотрел свою информацию")
            else:
                bot.send_message(chat_id, "Информация о партнёре не найдена.")
        except Exception as e:
            log_exception(logger, e, f"Ошибка получения информации партнёра {chat_id}")
            bot.send_message(chat_id, "Ошибка при получении информации.")
        
        partner_main_menu(chat_id)
    
    elif call.data == 'settings_bonus':
        bot.send_message(chat_id, 
            f"ℹ️ Текущий приветственный бонус для новых клиентов: **{WELCOME_BONUS_AMOUNT}** баллов.\n\n"
            "Для изменения этой настройки обратитесь к администратору системы.",
            parse_mode='Markdown'
        )
        partner_main_menu(chat_id)
    
    elif call.data == 'settings_edit':
        # Показываем меню выбора поля для редактирования
        markup = types.InlineKeyboardMarkup(row_width=1)
        btn_name = types.InlineKeyboardButton("👤 Редактировать имя", callback_data="edit_name")
        btn_company = types.InlineKeyboardButton("🏢 Редактировать компанию", callback_data="edit_company")
        btn_phone = types.InlineKeyboardButton("📱 Редактировать телефон", callback_data="edit_phone")
        btn_booking = types.InlineKeyboardButton("📅 Редактировать ссылку на бронирование", callback_data="edit_booking_url")
        btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="settings_back")
        markup.add(btn_name, btn_company, btn_phone, btn_booking, btn_back)
        
        bot.send_message(chat_id, "✏️ *Редактирование данных:*\n\nВыберите поле, которое хотите изменить:", reply_markup=markup, parse_mode='Markdown')
    
    elif call.data == 'settings_back':
        # Возвращаемся в меню настроек
        markup = types.InlineKeyboardMarkup(row_width=1)
        btn_bonus = types.InlineKeyboardButton("🎁 Изменить приветственный бонус", callback_data="settings_bonus")
        btn_info = types.InlineKeyboardButton("ℹ️ Моя информация", callback_data="settings_info")
        btn_edit = types.InlineKeyboardButton("✏️ Редактировать данные", callback_data="settings_edit")
        btn_back = types.InlineKeyboardButton("⬅️ Назад в меню", callback_data="partner_main_menu")
        markup.add(btn_bonus, btn_info, btn_edit, btn_back)
        
        bot.edit_message_text(
            "*⚙️ Настройки партнёра:*\nВыберите действие:",
            chat_id, call.message.message_id,
            reply_markup=markup,
            parse_mode='Markdown'
        )
    
    bot.answer_callback_query(call.id)


@bot.callback_query_handler(func=lambda call: call.data.startswith('edit_'))
def handle_edit_callbacks(call):
    """Обработчик callback'ов для редактирования данных партнера."""
    chat_id = call.message.chat.id
    
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass
    
    if call.data == 'edit_name':
        USER_STATE[chat_id] = 'awaiting_edit_name'
        msg = bot.send_message(chat_id, "✏️ *Редактирование имени*\n\nВведите новое имя:", parse_mode='Markdown')
        bot.register_next_step_handler(msg, process_edit_name)
    
    elif call.data == 'edit_company':
        USER_STATE[chat_id] = 'awaiting_edit_company'
        msg = bot.send_message(chat_id, "✏️ *Редактирование названия компании*\n\nВведите новое название компании:", parse_mode='Markdown')
        bot.register_next_step_handler(msg, process_edit_company)
    
    elif call.data == 'edit_phone':
        USER_STATE[chat_id] = 'awaiting_edit_phone'
        msg = bot.send_message(chat_id, "✏️ *Редактирование телефона*\n\nВведите новый номер телефона:", parse_mode='Markdown')
        bot.register_next_step_handler(msg, process_edit_phone)
    
    elif call.data == 'edit_booking_url':
        USER_STATE[chat_id] = 'awaiting_edit_booking_url'
        msg = bot.send_message(chat_id, "✏️ *Редактирование ссылки на бронирование*\n\nВведите новую ссылку на систему бронирования (или отправьте 'удалить' для удаления):", parse_mode='Markdown')
        bot.register_next_step_handler(msg, process_edit_booking_url)
    
    bot.answer_callback_query(call.id)


def process_edit_name(message):
    """Обрабатывает ввод нового имени партнера."""
    chat_id = message.chat.id
    
    if chat_id not in USER_STATE or USER_STATE[chat_id] != 'awaiting_edit_name':
        return
    
    new_name = message.text.strip()
    
    if len(new_name) < 2:
        msg = bot.send_message(chat_id, "❌ Имя слишком короткое. Введите имя еще раз:")
        bot.register_next_step_handler(msg, process_edit_name)
        return
    
    try:
        success = sm.update_partner_data(str(chat_id), name=new_name)
        if success:
            bot.send_message(chat_id, f"✅ Имя успешно обновлено на: **{new_name}**", parse_mode='Markdown')
            logger.info(f"Партнёр {chat_id} обновил имя на: {new_name}")
        else:
            bot.send_message(chat_id, "❌ Ошибка при обновлении имени. Попробуйте позже.")
    except Exception as e:
        log_exception(logger, e, f"Ошибка обновления имени партнёра {chat_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка при обновлении имени.")
    
    USER_STATE.pop(chat_id, None)
    partner_main_menu(chat_id)


def process_edit_company(message):
    """Обрабатывает ввод нового названия компании партнера."""
    chat_id = message.chat.id
    
    if chat_id not in USER_STATE or USER_STATE[chat_id] != 'awaiting_edit_company':
        return
    
    new_company = message.text.strip()
    
    if len(new_company) < 2:
        msg = bot.send_message(chat_id, "❌ Название компании слишком короткое. Введите название еще раз:")
        bot.register_next_step_handler(msg, process_edit_company)
        return
    
    try:
        success = sm.update_partner_data(str(chat_id), company_name=new_company)
        if success:
            bot.send_message(chat_id, f"✅ Название компании успешно обновлено на: **{new_company}**", parse_mode='Markdown')
            logger.info(f"Партнёр {chat_id} обновил название компании на: {new_company}")
        else:
            bot.send_message(chat_id, "❌ Ошибка при обновлении названия компании. Попробуйте позже.")
    except Exception as e:
        log_exception(logger, e, f"Ошибка обновления названия компании партнёра {chat_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка при обновлении названия компании.")
    
    USER_STATE.pop(chat_id, None)
    partner_main_menu(chat_id)


def process_edit_phone(message):
    """Обрабатывает ввод нового телефона партнера."""
    chat_id = message.chat.id
    
    if chat_id not in USER_STATE or USER_STATE[chat_id] != 'awaiting_edit_phone':
        return
    
    new_phone = message.text.strip()
    
    # Простая валидация телефона (должен содержать хотя бы 10 цифр)
    digits = ''.join(filter(str.isdigit, new_phone))
    if len(digits) < 10:
        msg = bot.send_message(chat_id, "❌ Номер телефона слишком короткий. Введите корректный номер телефона:")
        bot.register_next_step_handler(msg, process_edit_phone)
        return
    
    try:
        success = sm.update_partner_data(str(chat_id), phone=new_phone)
        if success:
            bot.send_message(chat_id, f"✅ Номер телефона успешно обновлен на: **{new_phone}**", parse_mode='Markdown')
            logger.info(f"Партнёр {chat_id} обновил телефон на: {new_phone}")
        else:
            bot.send_message(chat_id, "❌ Ошибка при обновлении номера телефона. Попробуйте позже.")
    except Exception as e:
        log_exception(logger, e, f"Ошибка обновления телефона партнёра {chat_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка при обновлении номера телефона.")
    
    USER_STATE.pop(chat_id, None)
    partner_main_menu(chat_id)


def process_edit_booking_url(message):
    """Обрабатывает ввод новой ссылки на бронирование партнера."""
    chat_id = message.chat.id
    
    if chat_id not in USER_STATE or USER_STATE[chat_id] != 'awaiting_edit_booking_url':
        return
    
    new_booking_url = message.text.strip()
    
    # Если пользователь хочет удалить ссылку
    if new_booking_url.lower() in ['удалить', 'delete', 'нет', 'no', '']:
        new_booking_url = None
    else:
        # Простая валидация URL
        if not (new_booking_url.startswith('http://') or new_booking_url.startswith('https://')):
            msg = bot.send_message(chat_id, "❌ Ссылка должна начинаться с http:// или https://. Введите корректную ссылку (или отправьте 'удалить' для удаления):")
            bot.register_next_step_handler(msg, process_edit_booking_url)
            return
    
    try:
        success = sm.update_partner_data(str(chat_id), booking_url=new_booking_url)
        if success:
            if new_booking_url:
                bot.send_message(chat_id, f"✅ Ссылка на бронирование успешно обновлена на: **{new_booking_url}**", parse_mode='Markdown')
            else:
                bot.send_message(chat_id, "✅ Ссылка на бронирование успешно удалена.")
            logger.info(f"Партнёр {chat_id} обновил ссылку на бронирование: {new_booking_url}")
        else:
            bot.send_message(chat_id, "❌ Ошибка при обновлении ссылки на бронирование. Попробуйте позже.")
    except Exception as e:
        log_exception(logger, e, f"Ошибка обновления ссылки на бронирование партнёра {chat_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка при обновлении ссылки на бронирование.")
    
    USER_STATE.pop(chat_id, None)
    partner_main_menu(chat_id)


# ------------------------------------
# ФУНКЦИОНАЛ: УПРАВЛЕНИЕ АКЦИЯМИ - ПРОСМОТР/УДАЛЕНИЕ (НОВОЕ)
# ------------------------------------

def handle_promo_manage_list(chat_id):
    """Показывает список акций партнёра для удаления."""
    try:
        # Получаем все акции партнёра
        all_promos = sm.client.from_('promotions').select('*').eq('partner_chat_id', str(chat_id)).execute()
        
        if not all_promos.data:
            bot.send_message(chat_id, "У вас пока нет созданных акций для удаления.")
            partner_main_menu(chat_id)
            return
        
        markup = types.InlineKeyboardMarkup(row_width=1)
        
        for promo in all_promos.data:
            promo_id = promo.get('id')
            title = promo.get('title', 'Без названия')
            end_date = promo.get('end_date', 'N/A')
            
            # Форматируем дату для отображения
            try:
                if end_date and end_date != 'N/A':
                    from datetime import datetime
                    end_date_obj = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    end_date_str = end_date_obj.strftime('%d.%m.%Y')
                else:
                    end_date_str = 'N/A'
            except:
                end_date_str = str(end_date)[:10] if end_date else 'N/A'
            
            btn = types.InlineKeyboardButton(
                f"🗑️ {title} (до {end_date_str})",
                callback_data=f"delete_promo_{promo_id}"
            )
            markup.add(btn)
        
        btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="promo_back")
        markup.add(btn_back)
        
        bot.send_message(chat_id, "🗑️ **Выберите акцию для удаления:**", reply_markup=markup, parse_mode='Markdown')
        logger.info(f"Партнёр {chat_id} открыл список акций для удаления")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка получения списка акций для удаления {chat_id}")
        bot.send_message(chat_id, "Ошибка при получении списка акций.")


@bot.callback_query_handler(func=lambda call: call.data.startswith('delete_promo_') or call.data.startswith('confirm_delete_promo_') or call.data == 'cancel_delete_promo')
def handle_promo_delete_callbacks(call):
    """Обработчик callback'ов для удаления акций."""
    chat_id = call.message.chat.id
    
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None)
    except Exception:
        pass
    
    if call.data.startswith('delete_promo_'):
        # Формат: delete_promo_<promo_id> - показываем подтверждение
        try:
            promo_id = call.data.replace('delete_promo_', '')
            handle_promo_delete_confirmation(chat_id, promo_id)
        except Exception as e:
            log_exception(logger, e, f"Ошибка парсинга promo_id из {call.data}")
            bot.send_message(chat_id, "❌ Ошибка при обработке запроса. Попробуйте еще раз.")
    elif call.data.startswith('confirm_delete_promo_'):
        # Формат: confirm_delete_promo_<promo_id> - подтверждаем удаление
        try:
            promo_id = call.data.replace('confirm_delete_promo_', '')
            handle_promo_delete(chat_id, promo_id)
        except Exception as e:
            log_exception(logger, e, f"Ошибка парсинга promo_id из {call.data}")
            bot.send_message(chat_id, "❌ Ошибка при обработке запроса. Попробуйте еще раз.")
    elif call.data == 'cancel_delete_promo':
        # Отмена удаления - возвращаемся к списку акций
        handle_promo_manage_list(chat_id)
    
    bot.answer_callback_query(call.id)


def handle_promo_delete_confirmation(chat_id, promo_id):
    """Показывает подтверждение удаления акции."""
    try:
        # Получаем информацию об акции
        promo_response = sm.client.from_('promotions').select('*').eq('id', promo_id).eq('partner_chat_id', str(chat_id)).execute()
        
        if not promo_response.data:
            bot.send_message(chat_id, "❌ Акция не найдена или у вас нет прав для её удаления.")
            handle_promo_manage_list(chat_id)
            return
        
        promo = promo_response.data[0]
        promo_title = promo.get('title', 'Акция')
        promo_type = promo.get('promotion_type', 'discount')
        end_date = promo.get('end_date', 'N/A')
        
        # Форматируем дату
        try:
            if end_date and end_date != 'N/A':
                from datetime import datetime
                end_date_obj = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                end_date_str = end_date_obj.strftime('%d.%m.%Y')
            else:
                end_date_str = 'N/A'
        except:
            end_date_str = str(end_date)[:10] if end_date else 'N/A'
        
        # Типы акций
        type_names = {
            'discount': '💰 Скидка',
            'points_redemption': '💸 Обмен баллов',
            'cashback': '🎁 Кэшбэк'
        }
        type_display = type_names.get(promo_type, promo_type)
        
        # Создаем клавиатуру подтверждения
        markup = types.InlineKeyboardMarkup(row_width=1)
        btn_confirm = types.InlineKeyboardButton("✅ Да, удалить", callback_data=f"confirm_delete_promo_{promo_id}")
        btn_cancel = types.InlineKeyboardButton("❌ Отмена", callback_data="cancel_delete_promo")
        markup.add(btn_confirm, btn_cancel)
        
        confirmation_text = f"⚠️ **Подтверждение удаления акции**\n\n"
        confirmation_text += f"Вы действительно хотите удалить акцию?\n\n"
        confirmation_text += f"**{promo_title}**\n"
        confirmation_text += f"Тип: {type_display}\n"
        confirmation_text += f"Действует до: {end_date_str}\n\n"
        confirmation_text += f"⚠️ Это действие нельзя отменить!"
        
        bot.send_message(chat_id, confirmation_text, reply_markup=markup, parse_mode='Markdown')
        logger.info(f"Партнёр {chat_id} запросил подтверждение удаления акции {promo_id}")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка показа подтверждения удаления акции {promo_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка. Попробуйте еще раз.")
        handle_promo_manage_list(chat_id)


def handle_promo_delete(chat_id, promo_id):
    """Удаляет акцию после подтверждения."""
    try:
        # Получаем информацию об акции перед удалением
        promo_response = sm.client.from_('promotions').select('*').eq('id', promo_id).eq('partner_chat_id', str(chat_id)).execute()
        
        if not promo_response.data:
            bot.send_message(chat_id, "❌ Акция не найдена или у вас нет прав для её удаления.")
            partner_main_menu(chat_id)
            return
        
        promo = promo_response.data[0]
        promo_title = promo.get('title', 'Акция')
        
        # Удаляем акцию
        sm.client.from_('promotions').delete().eq('id', promo_id).execute()
        
        bot.send_message(chat_id, f"✅ Акция **{promo_title}** успешно удалена!", parse_mode='Markdown')
        logger.info(f"Партнёр {chat_id} удалил акцию {promo_id}")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка удаления акции {promo_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка при удалении акции.")
    
    # Возвращаемся в меню акций
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_add = types.InlineKeyboardButton("➕ Создать новую акцию", callback_data="promo_add")
    btn_manage = types.InlineKeyboardButton("⚙️ Редактировать / Удалить", callback_data="promo_manage")
    btn_back = types.InlineKeyboardButton("⬅️ Назад в меню", callback_data="partner_main_menu")
    markup.add(btn_add, btn_manage, btn_back)
    
    bot.send_message(
        chat_id,
        "*Управление Акциями:*\nВыберите действие:",
        reply_markup=markup,
        parse_mode='Markdown'
    )


# ------------------------------------
# ФУНКЦИОНАЛ: ПРОСМОТР СТАТУСА УСЛУГ (НОВОЕ)
# ------------------------------------

def handle_service_status_list(chat_id):
    """Показывает список услуг партнёра с их статусами."""
    try:
        # Получаем все услуги партнёра
        all_services = sm.client.from_('services').select('*').eq('partner_chat_id', str(chat_id)).execute()
        
        if not all_services.data:
            bot.send_message(chat_id, "У вас пока нет созданных услуг.")
            partner_main_menu(chat_id)
            return
        
        response = "**📋 Ваши услуги:**\n\n"
        
        for service in all_services.data:
            service_id = service.get('id')
            title = service.get('title', 'Без названия')
            price = service.get('price_points', 0)
            status = service.get('approval_status', 'Unknown')
            
            # Эмодзи в зависимости от статуса
            status_emoji = {
                'Pending': '⏳',
                'Approved': '✅',
                'Rejected': '❌'
            }.get(status, '❓')
            
            response += f"{status_emoji} **{title}**\n"
            response += f"   💎 Стоимость: {price} баллов | Статус: {status}\n\n"
        
        bot.send_message(chat_id, response, parse_mode='Markdown')
        logger.info(f"Партнёр {chat_id} просмотрел статус своих услуг")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка получения статуса услуг партнёра {chat_id}")
        bot.send_message(chat_id, "Ошибка при получении статуса услуг.")
    
    partner_main_menu(chat_id)


def handle_service_edit_list(chat_id):
    """Показывает список услуг для редактирования."""
    try:
        all_services = sm.client.from_('services').select('*').eq('partner_chat_id', str(chat_id)).execute()
        
        if not all_services.data:
            bot.send_message(chat_id, "У вас пока нет созданных услуг для редактирования.")
            partner_main_menu(chat_id)
            return
        
        markup = types.InlineKeyboardMarkup(row_width=1)
        
        for service in all_services.data:
            service_id = service.get('id')
            title = service.get('title', 'Без названия')
            price = service.get('price_points', 0)
            
            btn = types.InlineKeyboardButton(
                f"✏️ {title} ({price} баллов)",
                callback_data=f"edit_service_{service_id}"
            )
            markup.add(btn)
        
        btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="service_back")
        markup.add(btn_back)
        
        bot.send_message(chat_id, "✏️ **Выберите услугу для редактирования:**", reply_markup=markup, parse_mode='Markdown')
        logger.info(f"Партнёр {chat_id} открыл список услуг для редактирования")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка получения списка услуг для редактирования {chat_id}")
        bot.send_message(chat_id, "Ошибка при получении списка услуг.")


def handle_service_delete_list(chat_id):
    """Показывает список услуг для удаления."""
    try:
        all_services = sm.client.from_('services').select('*').eq('partner_chat_id', str(chat_id)).execute()
        
        if not all_services.data:
            bot.send_message(chat_id, "У вас пока нет созданных услуг для удаления.")
            partner_main_menu(chat_id)
            return
        
        markup = types.InlineKeyboardMarkup(row_width=1)
        
        for service in all_services.data:
            service_id = service.get('id')
            title = service.get('title', 'Без названия')
            price = service.get('price_points', 0)
            
            btn = types.InlineKeyboardButton(
                f"🗑️ {title} ({price} баллов)",
                callback_data=f"delete_service_{service_id}"
            )
            markup.add(btn)
        
        btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="service_back")
        markup.add(btn_back)
        
        bot.send_message(chat_id, "🗑️ **Выберите услугу для удаления:**", reply_markup=markup, parse_mode='Markdown')
        logger.info(f"Партнёр {chat_id} открыл список услуг для удаления")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка получения списка услуг для удаления {chat_id}")
        bot.send_message(chat_id, "Ошибка при получении списка услуг.")


def handle_service_edit_menu(chat_id, service_id):
    """Показывает меню выбора поля для редактирования услуги."""
    try:
        # Преобразуем service_id в строку для работы с UUID
        service = sm.get_service_by_id(str(service_id), str(chat_id))
        
        if not service:
            bot.send_message(chat_id, "❌ Услуга не найдена или у вас нет прав для её редактирования.")
            partner_main_menu(chat_id)
            return
        
        markup = types.InlineKeyboardMarkup(row_width=1)
        # Используем | как разделитель для поддержки UUID
        btn_title = types.InlineKeyboardButton("👤 Редактировать название", callback_data=f"edit_field_{service_id}|title")
        btn_desc = types.InlineKeyboardButton("📝 Редактировать описание", callback_data=f"edit_field_{service_id}|description")
        btn_price = types.InlineKeyboardButton("💎 Редактировать стоимость", callback_data=f"edit_field_{service_id}|price_points")
        btn_back = types.InlineKeyboardButton("⬅️ Назад", callback_data="service_edit_list")
        markup.add(btn_title, btn_desc, btn_price, btn_back)
        
        info_text = f"**Редактирование услуги:**\n\n"
        info_text += f"👤 Название: {service.get('title', 'Не указано')}\n"
        info_text += f"📝 Описание: {service.get('description', 'Не указано')[:50]}...\n"
        info_text += f"💎 Стоимость: {service.get('price_points', 0)} баллов\n\n"
        info_text += "Выберите поле для редактирования:"
        
        bot.send_message(chat_id, info_text, reply_markup=markup, parse_mode='Markdown')
        logger.info(f"Партнёр {chat_id} открыл меню редактирования услуги {service_id}")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка открытия меню редактирования услуги {service_id}")
        bot.send_message(chat_id, "Ошибка при открытии меню редактирования.")


def handle_service_delete_confirmation(chat_id, service_id):
    """Показывает подтверждение удаления услуги."""
    try:
        # Получаем информацию об услуге
        service_response = sm.client.from_('services').select('*').eq('id', service_id).eq('partner_chat_id', str(chat_id)).execute()
        
        if not service_response.data:
            bot.send_message(chat_id, "❌ Услуга не найдена или у вас нет прав для её удаления.")
            handle_service_delete_list(chat_id)
            return
        
        service = service_response.data[0]
        service_title = service.get('title', 'Услуга')
        service_price = service.get('price_points', 0)
        service_status = service.get('approval_status', 'Unknown')
        
        # Создаем клавиатуру подтверждения
        markup = types.InlineKeyboardMarkup(row_width=1)
        btn_confirm = types.InlineKeyboardButton("✅ Да, удалить", callback_data=f"confirm_delete_service_{service_id}")
        btn_cancel = types.InlineKeyboardButton("❌ Отмена", callback_data="cancel_delete_service")
        markup.add(btn_confirm, btn_cancel)
        
        status_emoji = {
            'Pending': '⏳',
            'Approved': '✅',
            'Rejected': '❌'
        }.get(service_status, '❓')
        
        confirmation_text = f"⚠️ **Подтверждение удаления услуги**\n\n"
        confirmation_text += f"Вы действительно хотите удалить услугу?\n\n"
        confirmation_text += f"**{service_title}**\n"
        confirmation_text += f"💎 Стоимость: {service_price} баллов\n"
        confirmation_text += f"Статус: {status_emoji} {service_status}\n\n"
        confirmation_text += f"⚠️ Это действие нельзя отменить!"
        
        bot.send_message(chat_id, confirmation_text, reply_markup=markup, parse_mode='Markdown')
        logger.info(f"Партнёр {chat_id} запросил подтверждение удаления услуги {service_id}")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка показа подтверждения удаления услуги {service_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка. Попробуйте еще раз.")
        handle_service_delete_list(chat_id)


def handle_service_delete(chat_id, service_id):
    """Удаляет услугу после подтверждения."""
    try:
        # Получаем информацию об услуге перед удалением
        service_response = sm.client.from_('services').select('*').eq('id', service_id).eq('partner_chat_id', str(chat_id)).execute()
        
        if not service_response.data:
            bot.send_message(chat_id, "❌ Услуга не найдена или у вас нет прав для её удаления.")
            partner_main_menu(chat_id)
            return
        
        service = service_response.data[0]
        service_title = service.get('title', 'Услуга')
        
        # Удаляем услугу
        success = sm.delete_service(service_id, str(chat_id))
        
        if success:
            bot.send_message(chat_id, f"✅ Услуга **{service_title}** успешно удалена!", parse_mode='Markdown')
            logger.info(f"Партнёр {chat_id} удалил услугу {service_id}")
        else:
            bot.send_message(chat_id, "❌ Ошибка при удалении услуги. Попробуйте еще раз.")
            logger.error(f"Ошибка удаления услуги {service_id} для партнёра {chat_id}")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка удаления услуги {service_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка при удалении услуги.")
    
    # Возвращаемся в меню услуг
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_add = types.InlineKeyboardButton("➕ Добавить новую услугу", callback_data="service_add")
    btn_manage = types.InlineKeyboardButton("🔍 Мои услуги", callback_data="service_status")
    btn_edit = types.InlineKeyboardButton("✏️ Редактировать услугу", callback_data="service_edit_list")
    btn_delete = types.InlineKeyboardButton("🗑️ Удалить услугу", callback_data="service_delete_list")
    btn_back = types.InlineKeyboardButton("⬅️ Назад в меню", callback_data="partner_main_menu")
    markup.add(btn_add, btn_manage, btn_edit, btn_delete, btn_back)
    
    bot.send_message(
        chat_id,
        "*Управление Услугами:*\nСоздайте услугу, которая будет доступна для обмена баллов клиентами (требуется одобрение Администратора).",
        reply_markup=markup,
        parse_mode='Markdown'
    )


def handle_service_field_edit(chat_id, service_id, field):
    """Инициирует процесс редактирования поля услуги."""
    try:
        # Преобразуем service_id в строку для работы с UUID
        service = sm.get_service_by_id(str(service_id), str(chat_id))
        
        if not service:
            bot.send_message(chat_id, "❌ Услуга не найдена.")
            return
        
        # Сохраняем информацию о редактировании
        TEMP_DATA[chat_id] = {
            'editing_service_id': service_id,
            'editing_field': field
        }
        
        field_names = {
            'title': 'название',
            'description': 'описание',
            'price_points': 'стоимость'
        }
        
        field_prompts = {
            'title': f"Введите новое **название** услуги (текущее: {service.get('title', 'Не указано')}):",
            'description': f"Введите новое **описание** услуги (текущее: {service.get('description', 'Не указано')[:100]}...):",
            'price_points': f"Введите новую **стоимость** в баллах (текущая: {service.get('price_points', 0)}):"
        }
        
        prompt = field_prompts.get(field, f"Введите новое значение для {field_names.get(field, field)}:")
        
        USER_STATE[chat_id] = f'awaiting_service_edit_{field}'
        
        msg = bot.send_message(chat_id, f"✏️ *Редактирование {field_names.get(field, field)}:*\n\n{prompt}", parse_mode='Markdown')
        
        if field == 'price_points':
            bot.register_next_step_handler(msg, process_service_edit_price)
        elif field == 'title':
            bot.register_next_step_handler(msg, process_service_edit_title)
        elif field == 'description':
            bot.register_next_step_handler(msg, process_service_edit_description)
        
        logger.info(f"Партнёр {chat_id} начал редактирование поля {field} услуги {service_id}")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка инициализации редактирования поля {field} услуги {service_id}")
        bot.send_message(chat_id, "Ошибка при начале редактирования.")


def process_service_edit_title(message):
    """Обрабатывает ввод нового названия услуги."""
    chat_id = message.chat.id
    
    # Проверяем состояние и данные сессии
    if chat_id not in USER_STATE or USER_STATE[chat_id] != 'awaiting_service_edit_title':
        bot.send_message(chat_id, "Ошибка сессии. Попробуйте начать редактирование снова.")
        return
    
    if chat_id not in TEMP_DATA or 'editing_service_id' not in TEMP_DATA[chat_id]:
        bot.send_message(chat_id, "Ошибка сессии. Попробуйте начать редактирование снова.")
        USER_STATE.pop(chat_id, None)
        return
    
    service_id = TEMP_DATA[chat_id]['editing_service_id']
    new_title = message.text.strip()
    
    if len(new_title) < 2:
        msg = bot.send_message(chat_id, "❌ Название слишком короткое. Введите название еще раз:")
        bot.register_next_step_handler(msg, process_service_edit_title)
        return
    
    try:
        # Преобразуем service_id в строку для работы с UUID
        success = sm.update_service(str(service_id), str(chat_id), title=new_title)
        if success:
            bot.send_message(chat_id, f"✅ Название услуги успешно обновлено на: **{new_title}**", parse_mode='Markdown')
            logger.info(f"Партнёр {chat_id} обновил название услуги {service_id}")
        else:
            bot.send_message(chat_id, "❌ Ошибка при обновлении названия. Попробуйте позже.")
    except Exception as e:
        log_exception(logger, e, f"Ошибка обновления названия услуги {service_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка при обновлении названия.")
    
    TEMP_DATA.pop(chat_id, None)
    USER_STATE.pop(chat_id, None)
    partner_main_menu(chat_id)


def process_service_edit_description(message):
    """Обрабатывает ввод нового описания услуги."""
    chat_id = message.chat.id
    
    # Проверяем состояние и данные сессии
    if chat_id not in USER_STATE or USER_STATE[chat_id] != 'awaiting_service_edit_description':
        bot.send_message(chat_id, "Ошибка сессии. Попробуйте начать редактирование снова.")
        return
    
    if chat_id not in TEMP_DATA or 'editing_service_id' not in TEMP_DATA[chat_id]:
        bot.send_message(chat_id, "Ошибка сессии. Попробуйте начать редактирование снова.")
        USER_STATE.pop(chat_id, None)
        return
    
    service_id = TEMP_DATA[chat_id]['editing_service_id']
    new_description = message.text.strip()
    
    if len(new_description) < 5:
        msg = bot.send_message(chat_id, "❌ Описание слишком короткое. Введите описание еще раз:")
        bot.register_next_step_handler(msg, process_service_edit_description)
        return
    
    try:
        # Преобразуем service_id в строку для работы с UUID
        success = sm.update_service(str(service_id), str(chat_id), description=new_description)
        if success:
            bot.send_message(chat_id, f"✅ Описание услуги успешно обновлено!", parse_mode='Markdown')
            logger.info(f"Партнёр {chat_id} обновил описание услуги {service_id}")
        else:
            bot.send_message(chat_id, "❌ Ошибка при обновлении описания. Попробуйте позже.")
    except Exception as e:
        log_exception(logger, e, f"Ошибка обновления описания услуги {service_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка при обновлении описания.")
    
    TEMP_DATA.pop(chat_id, None)
    USER_STATE.pop(chat_id, None)
    partner_main_menu(chat_id)


def process_service_edit_price(message):
    """Обрабатывает ввод новой стоимости услуги."""
    chat_id = message.chat.id
    
    # Проверяем состояние и данные сессии
    if chat_id not in USER_STATE or USER_STATE[chat_id] != 'awaiting_service_edit_price_points':
        bot.send_message(chat_id, "Ошибка сессии. Попробуйте начать редактирование снова.")
        return
    
    if chat_id not in TEMP_DATA or 'editing_service_id' not in TEMP_DATA[chat_id]:
        bot.send_message(chat_id, "Ошибка сессии. Попробуйте начать редактирование снова.")
        USER_STATE.pop(chat_id, None)
        return
    
    service_id = TEMP_DATA[chat_id]['editing_service_id']
    
    try:
        new_price = int(message.text.strip())
        if new_price <= 0:
            raise ValueError
    except ValueError:
        msg = bot.send_message(chat_id, "❌ Неверный формат. Введите *целое число* баллов больше нуля:")
        bot.register_next_step_handler(msg, process_service_edit_price)
        return
    
    try:
        # Преобразуем service_id в строку для работы с UUID
        success = sm.update_service(str(service_id), str(chat_id), price_points=new_price)
        if success:
            bot.send_message(chat_id, f"✅ Стоимость услуги успешно обновлена на: **{new_price}** баллов", parse_mode='Markdown')
            logger.info(f"Партнёр {chat_id} обновил стоимость услуги {service_id}")
        else:
            bot.send_message(chat_id, "❌ Ошибка при обновлении стоимости. Попробуйте позже.")
    except Exception as e:
        log_exception(logger, e, f"Ошибка обновления стоимости услуги {service_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка при обновлении стоимости.")
    
    TEMP_DATA.pop(chat_id, None)
    USER_STATE.pop(chat_id, None)
    partner_main_menu(chat_id)


# ------------------------------------
# ОБРАБОТЧИК ПРОЧИХ СООБЩЕНИЙ (ОСТАВЛЕНО)
# ------------------------------------
@bot.message_handler(func=lambda message: True)
def handle_partner_all_messages(message):
    chat_id = message.chat.id

    if chat_id not in USER_STATE and not sm.partner_exists(chat_id):
        bot.send_message(chat_id, "Пожалуйста, начните с команды /start.")
        return

    if sm.partner_exists(chat_id) and sm.get_partner_status(chat_id) == 'Approved':
        if chat_id not in USER_STATE:
            partner_main_menu(chat_id, "Используйте меню Партнера.")

    elif chat_id in USER_STATE:
        pass # Ожидаем ввода в рамках текущего шага диалога


# ------------------------------------
# ФУНКЦИОНАЛ: МОИ СООБЩЕНИЯ ПАРТНЕРА
# ------------------------------------

def handle_partner_messages(message):
    """Показывает список сообщений от клиентов партнёру."""
    chat_id = message.chat.id
    
    try:
        # Получаем все переписки партнёра
        conversations = sm.get_partner_conversations(str(chat_id))
        
        if not conversations:
            bot.send_message(
                chat_id,
                "📭 **У вас пока нет сообщений**\n\n"
                "Клиенты смогут написать вам через приложение, и их сообщения появятся здесь.",
                parse_mode='Markdown'
            )
            return
        
        # Сортируем по дате последнего сообщения
        conversations.sort(key=lambda x: x['last_message'].get('created_at', ''), reverse=True)
        
        # Показываем первые 10 переписок
        message_text = "💬 **Мои сообщения**\n\n"
        message_text += f"Всего переписок: {len(conversations)}\n\n"
        message_text += "Выберите переписку для просмотра:\n\n"
        
        markup = types.InlineKeyboardMarkup(row_width=1)
        
        for idx, conv in enumerate(conversations[:10], 1):
            client_id = conv['client_chat_id']
            last_msg = conv['last_message']
            unread_count = conv.get('unread_count', 0)
            
            # Получаем информацию о клиенте
            try:
                client_data = sm.get_client_details_for_partner(int(client_id)) if client_id.isdigit() else None
                client_name = client_data.get('name', 'Не указано') if client_data else 'Неизвестный клиент'
            except:
                client_name = 'Неизвестный клиент'
            
            # Информация о последнем сообщении
            msg_type = last_msg.get('message_type', 'text')
            msg_text = last_msg.get('message_text', '')
            service_title = last_msg.get('service_title', '')
            
            # Формируем краткое описание
            preview = ""
            if msg_type == 'qr_code':
                preview = "📱 QR-код"
            elif msg_type == 'text' and msg_text:
                preview = msg_text[:25] + "..." if len(msg_text) > 25 else msg_text
            else:
                preview = f"📎 {msg_type}"
            
            # Формируем текст кнопки
            unread_badge = f" ({unread_count})" if unread_count > 0 else ""
            button_text = f"{idx}. {client_name}{unread_badge}"
            if service_title:
                service_short = service_title[:20] + "..." if len(service_title) > 20 else service_title
                button_text += f" | {service_short}"
            
            markup.add(types.InlineKeyboardButton(
                button_text,
                callback_data=f"view_conversation_{client_id}"
            ))
        
        bot.send_message(chat_id, message_text, reply_markup=markup, parse_mode='Markdown')
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка получения сообщений партнёра {chat_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка при загрузке сообщений. Попробуйте позже.")


@bot.callback_query_handler(func=lambda call: call.data.startswith('view_conversation_'))
def handle_view_conversation(call):
    """Показывает историю переписки с конкретным клиентом."""
    chat_id = call.message.chat.id
    client_chat_id = call.data.replace('view_conversation_', '')
    
    try:
        bot.answer_callback_query(call.id)
        
        # Получаем информацию о клиенте
        try:
            client_data = sm.get_client_details_for_partner(int(client_chat_id)) if client_chat_id.isdigit() else None
            client_name = client_data.get('name', 'Не указано') if client_data else 'Неизвестный клиент'
            client_phone = client_data.get('phone', 'Не указан') if client_data else 'Не указан'
        except:
            client_name = 'Неизвестный клиент'
            client_phone = 'Не указан'
        
        # Получаем историю переписки
        messages = sm.get_conversation(
            client_chat_id=str(client_chat_id),
            partner_chat_id=str(chat_id),
            limit=50
        )
        
        if not messages:
            bot.send_message(chat_id, "❌ Переписка не найдена.")
            return
        
        # Отмечаем все сообщения как прочитанные
        sm.mark_conversation_as_read(str(client_chat_id), str(chat_id), 'partner')
        
        # Формируем сообщение с историей (показываем последние 20 сообщений)
        recent_messages = messages[-20:]
        
        message_text = f"💬 **Переписка с клиентом**\n\n"
        message_text += f"👤 **Имя:** {client_name}\n"
        message_text += f"🆔 **Chat ID:** `{client_chat_id}`\n"
        message_text += f"📱 **Телефон:** {client_phone}\n"
        message_text += f"\n{'='*35}\n\n"
        
        # Добавляем сообщения
        for msg in recent_messages:
            sender_type = msg.get('sender_type', 'client')
            msg_type = msg.get('message_type', 'text')
            msg_text = msg.get('message_text', '')
            service_title = msg.get('service_title', '')
            created_at = msg.get('created_at', '')
            
            # Форматируем дату
            try:
                from datetime import datetime
                if 'T' in created_at:
                    dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                else:
                    dt = datetime.fromisoformat(created_at)
                date_str = dt.strftime('%d.%m.%Y %H:%M')
            except:
                date_str = created_at[:16] if created_at else 'Неизвестно'
            
            # Определяем автора
            if sender_type == 'client':
                message_text += f"👤 **Клиент** ({date_str}):\n"
            else:
                message_text += f"🤝 **Вы** ({date_str}):\n"
            
            # Добавляем информацию об услуге, если есть
            if service_title:
                message_text += f"📋 Услуга: _{service_title}_\n"
            
            # Добавляем содержимое сообщения
            if msg_type == 'qr_code':
                message_text += f"📱 Отправлен QR-код\n"
                if msg_text:
                    message_text += f"_{msg_text}_\n"
            elif msg_type == 'text' and msg_text:
                message_text += f"{msg_text}\n"
            else:
                message_text += f"📎 {msg_type}\n"
            
            message_text += "\n"
        
        # Создаём кнопки
        markup = types.InlineKeyboardMarkup(row_width=2)
        reply_btn = types.InlineKeyboardButton(
            "💬 Ответить",
            callback_data=f"reply_to_client_{client_chat_id}"
        )
        back_btn = types.InlineKeyboardButton(
            "⬅️ Назад",
            callback_data="back_to_messages_list"
        )
        markup.add(reply_btn, back_btn)
        
        # Отправляем сообщение
        bot.send_message(chat_id, message_text, reply_markup=markup, parse_mode='Markdown')
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка просмотра переписки партнёром {chat_id}")
        bot.send_message(chat_id, "❌ Произошла ошибка при загрузке переписки.")


@bot.callback_query_handler(func=lambda call: call.data == 'back_to_messages_list')
def handle_back_to_messages(call):
    """Возвращает партнёра к списку сообщений."""
    chat_id = call.message.chat.id
    try:
        bot.answer_callback_query(call.id)
        # Создаём временное сообщение для обработки
        class FakeMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
                self.text = "💬 Мои сообщения"
        
        handle_partner_messages(FakeMessage(chat_id))
    except Exception as e:
        log_exception(logger, e, f"Ошибка возврата к списку сообщений {chat_id}")
        partner_main_menu(chat_id)


# ------------------------------------
# ЗАПУСК БОТА (ОСТАВЛЕНО)
# ------------------------------------
def run_bot():
    logger.info("=== Партнёрский бот запущен ===")
    
    # Проверка токена при старте (мягкая проверка - не падаем, если есть проблема)
    try:
        bot_info = bot.get_me()
        logger.info(f"✅ Бот успешно подключен: @{bot_info.username} (ID: {bot_info.id})")
    except Exception as e:
        error_msg = str(e)
        if "401" in error_msg or "Unauthorized" in error_msg:
            logger.warning(f"⚠️ Проблема с токеном при старте (401). Бот попытается переподключиться.")
            logger.warning("Проверьте токен TOKEN_PARTNER в переменных окружения")
        else:
            logger.warning(f"⚠️ Не удалось проверить подключение при старте: {e}. Продолжаем работу.")
    
    # Проверка и удаление webhook перед polling (если есть)
    try:
        import requests
        webhook_info = requests.get(f"https://api.telegram.org/bot{PARTNER_TOKEN}/getWebhookInfo", timeout=5).json()
        if webhook_info.get('result', {}).get('url'):
            logger.warning(f"Обнаружен активный webhook: {webhook_info['result']['url']}")
            delete_result = requests.post(f"https://api.telegram.org/bot{PARTNER_TOKEN}/deleteWebhook", timeout=5).json()
            if delete_result.get('ok'):
                logger.info("✅ Webhook удален, переходим на polling")
            else:
                logger.warning("⚠️ Не удалось удалить webhook")
    except Exception as e:
        logger.debug(f"Не удалось проверить webhook (это нормально): {e}")
    
    retry_count = 0
    max_retries = 10
    base_delay = 5
    
    while True:
        try:
            # Сбрасываем счетчик при успешном подключении
            retry_count = 0
            bot.polling(none_stop=True, interval=1, timeout=20)
        except KeyboardInterrupt:
            logger.info("Бот остановлен пользователем (KeyboardInterrupt)")
            break
        except Exception as e:
            error_msg = str(e)
            
            # Проверяем тип ошибки
            if "401" in error_msg or "Unauthorized" in error_msg:
                logger.error(f"Ошибка авторизации (401): {e}")
                
                # Проверяем токен перед повторной попыткой
                try:
                    bot_info = bot.get_me()
                    logger.info(f"Токен валиден, бот: @{bot_info.username}")
                except Exception as token_error:
                    logger.critical(f"Токен невалиден! Проверьте TOKEN_PARTNER. Ошибка: {token_error}")
                    # Увеличиваем задержку при проблемах с токеном
                    delay = base_delay * (2 ** min(retry_count, 5))
                    logger.warning(f"Переподключение через {delay} секунд... (попытка {retry_count + 1}/{max_retries})")
                    time.sleep(delay)
                    retry_count += 1
                    if retry_count >= max_retries:
                        logger.critical("Превышено максимальное количество попыток. Остановка бота.")
                        break
                    continue
            
            log_exception(logger, e, "Ошибка соединения с Telegram API")
            
            # Exponential backoff с небольшим jitter
            delay = base_delay * (2 ** min(retry_count, 5)) + random.uniform(0, 1)
            logger.warning(f"Переподключение через {delay:.1f} секунд... (попытка {retry_count + 1}/{max_retries})")
            time.sleep(delay)
            retry_count += 1
            
            if retry_count >= max_retries:
                logger.critical("Превышено максимальное количество попыток. Остановка бота.")
                break

if __name__ == '__main__':
    try:
        run_bot()
    except Exception as e:
        log_exception(logger, e, "Критическая ошибка при запуске бота")
        raise