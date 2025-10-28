import telebot
from telebot import types
import os
import sys
import time
import datetime
from dotenv import load_dotenv
from logger_config import get_bot_logger, log_exception
from image_handler import process_photo_for_promotion
from dashboard_urls import get_partner_dashboard_url

load_dotenv()

sys.path.append(os.path.dirname(__file__))
# Предполагается, что 'supabase_manager' существует и содержит необходимые методы.
from supabase_manager import SupabaseManager

# Инициализация логгера
logger = get_bot_logger('partner_bot')

# --- Инициализация ---
PARTNER_TOKEN = os.environ.get('TOKEN_PARTNER')
if not PARTNER_TOKEN:
    logger.critical("TOKEN_PARTNER не найден в окружении")
    raise ValueError("FATAL: TOKEN_PARTNER не найден в окружении.")

logger.info("Инициализация партнёрского бота...")
bot = telebot.TeleBot(PARTNER_TOKEN)

try:
    sm = SupabaseManager()
    logger.info("SupabaseManager успешно инициализирован")
except Exception as e:
    log_exception(logger, e, "Ошибка инициализации SupabaseManager")
    raise

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
    """Главная клавиатура Партнера, включая Акции и Услуги."""
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    btn_add = types.KeyboardButton("➕ Начислить баллы")
    btn_subtract = types.KeyboardButton("➖ Списать баллы")
    btn_promo = types.KeyboardButton("🌟 Акции")
    btn_service = types.KeyboardButton("🛠️ Услуги") 
    btn_invite = types.KeyboardButton("👥 Пригласить клиента")
    btn_stats = types.KeyboardButton("📊 Моя статистика")
    btn_dashboard = types.KeyboardButton("📈 Дашборд")
    btn_find = types.KeyboardButton("👤 Найти клиента")
    btn_settings = types.KeyboardButton("⚙️ Настройки")

    markup.add(btn_add, btn_subtract)
    markup.add(btn_promo, btn_service)
    markup.add(btn_invite, btn_stats)
    markup.add(btn_dashboard, btn_find)
    markup.add(btn_settings)
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
# ФУНКЦИОНАЛ: ОБЩИЕ КНОПКИ МЕНЮ
# ------------------------------------
@bot.message_handler(func=lambda message: message.text in ["➕ Начислить баллы", "➖ Списать баллы", "📊 Моя статистика", "📈 Дашборд", "👤 Найти клиента", "⚙️ Настройки"])
def handle_partner_menu_buttons(message):
    chat_id = message.chat.id

    if not sm.partner_exists(chat_id) or sm.get_partner_status(chat_id) != 'Approved':
        bot.send_message(chat_id, "У вас нет прав для выполнения этой операции.")
        return

    if message.text == "➕ Начислить баллы":
        USER_STATE[chat_id] = 'awaiting_client_id_issue'
        bot.send_message(chat_id, "Введите *Chat ID клиента* или *ID телефона клиента*.", parse_mode="Markdown")
        return

    if message.text == "➖ Списать баллы":
        USER_STATE[chat_id] = 'awaiting_client_id_spend'
        bot.send_message(chat_id, "Введите *Chat ID клиента* или *ID телефона клиента* для списания баллов.", parse_mode="Markdown")
        return

    if message.text == "📊 Моя статистика":
        handle_partner_stats(message)
        return

    if message.text == "📈 Дашборд":
        handle_partner_dashboard(message)
        return

    if message.text == "👤 Найти клиента":
        handle_find_client(message)
        return
    
    if message.text == "⚙️ Настройки":
        handle_partner_settings(message)
        return


# ------------------------------------
# ФУНКЦИОНАЛ: ПРИГЛАШЕНИЕ КЛИЕНТА
# ------------------------------------

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
        bot.send_message(
            chat_id,
            f"🔗 **Ваша реферальная ссылка:**\n\n`{link}`\n\n📱 Отправьте эту ссылку клиенту. При переходе по ссылке клиент автоматически получит приветственные баллы!",
            parse_mode='Markdown'
        )
        partner_main_menu(chat_id)
        



# ------------------------------------
# ЛОГИКА ТРАНЗАКЦИЙ ПАРТНЕРА (ОСТАВЛЕНО)
# ------------------------------------
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

    prompt = ""
    current_balance = sm.get_client_balance(client_id)
    if TEMP_DATA[chat_id]['txn_type'] == 'accrual':
        prompt = f"Текущий баланс клиента: **{current_balance}** баллов.\nВведите *сумму чека (в рублях)* для начисления баллов:"
    else:
        prompt = f"Текущий баланс клиента: **{current_balance}** баллов.\nВведите *количество баллов* для списания:"

    bot.send_message(chat_id, prompt, parse_mode="Markdown")


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

    try:
        logger.info(f"Партнёр {chat_id} инициирует транзакцию: тип={txn_data['txn_type']}, клиент={txn_data['client_id']}, сумма={amount}")
        result = sm.execute_transaction(txn_data['client_id'], str(chat_id), txn_data['txn_type'], amount)

        if result['success']:
            msg = f"✅ **Транзакция успешна!**\n"
            if txn_data['txn_type'] == 'accrual':
                msg += f"Начислено: **{result.get('points', 0)}** баллов.\n"
            else:
                msg += f"Списано: **{amount}** баллов.\n"

            msg += f"Текущий баланс клиента: **{result.get('new_balance', 'N/A')}**."
            bot.send_message(chat_id, msg, parse_mode="Markdown")
            logger.info(f"Транзакция успешна: {txn_data['txn_type']} для клиента {txn_data['client_id']}")

            # --- КЛЮЧЕВОЙ ШАГ: ЗАПРОС NPS (Отправляется в Клиентский бот) ---
            if not str(txn_data['client_id']).startswith('VIA_PARTNER_'):
                try:
                    send_nps_request(txn_data['client_id'], str(chat_id))
                    logger.info(f"NPS запрос отправлен клиенту {txn_data['client_id']}")
                except Exception as e:
                    log_exception(logger, e, f"Ошибка отправки NPS запроса клиенту {txn_data['client_id']}")

        else:
            error_msg = result.get('error', 'Неизвестная ошибка')
            logger.warning(f"Транзакция не удалась для клиента {txn_data['client_id']}: {error_msg}")
            bot.send_message(chat_id, f"❌ Ошибка транзакции: {error_msg}")

    except Exception as e:
        log_exception(logger, e, f"Критическая ошибка при выполнении транзакции партнёра {chat_id}")
        bot.send_message(chat_id, "Произошла системная ошибка при проведении транзакции. Обратитесь в поддержку.")

    partner_main_menu(chat_id)


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
        'stats_all': 365  # год для "всё время"
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
├─ Общий оборот: **{stats['total_revenue']:,.2f}** ₽
├─ Средний чек: **{stats['avg_check']:,.2f}** ₽
└─ Средний LTV: **{stats['avg_ltv']:,.2f}** ₽/клиент

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
└─ 🔴 Детракторы (0-6): **{stats['detractors']}**

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
        
        response_text = "👥 **КОГОРТНЫЙ АНАЛИЗ**\n"
        response_text += "(клиенты по месяцам регистрации)\n\n"
        
        for cohort in cohort_data['cohorts']:
            response_text += f"📅 **{cohort['month']}**\n"
            response_text += f"├─ Клиентов: {cohort['clients_count']}\n"
            response_text += f"├─ Оборот: {cohort['total_revenue']:,.2f} ₽\n"
            response_text += f"├─ Транзакций: {cohort['total_transactions']}\n"
            response_text += f"└─ Средний чек/клиент: {cohort['avg_revenue_per_client']:,.2f} ₽\n\n"
        
        bot.send_message(chat_id, response_text, parse_mode='Markdown')
        
    except Exception as e:
        logger.error(f"Error in cohort analysis: {e}")
        bot.send_message(chat_id, "❌ Ошибка при формировании когортного анализа")
    
    partner_main_menu(chat_id)


# ------------------------------------
# ФУНКЦИОНАЛ: УПРАВЛЕНИЕ АКЦИЯМИ (ОСТАВЛЕНО)
# ------------------------------------

@bot.message_handler(func=lambda message: message.text == "🌟 Акции")
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
        USER_STATE[chat_id] = 'awaiting_promo_title'
        # Заполняем TEMP_DATA начальными данными
        TEMP_DATA[chat_id] = {
            'partner_chat_id': str(chat_id), 
            'start_date': datetime.datetime.now().strftime("%Y-%m-%d"),
            'image_url': None  # Для хранения URL изображения
        } 
        
        msg = bot.send_message(chat_id, "✍️ *Создание Акции (Шаг 1 из 5):*\n\n1. Введите **Заголовок** акции (например: 'Скидка 20% на десерты'):", parse_mode='Markdown')
        bot.register_next_step_handler(msg, process_promo_title)
    
    elif call.data == 'promo_manage':
        handle_promo_manage_list(chat_id)
        
    elif call.data == 'partner_main_menu':
        partner_main_menu(chat_id)
    
    # Важно: отвечаем на callback query
    bot.answer_callback_query(call.id)

def process_promo_title(message):
    chat_id = message.chat.id
    if len(message.text.strip()) < 3:
        msg = bot.send_message(chat_id, "Заголовок слишком короткий. Введите более подробный заголовок:")
        bot.register_next_step_handler(msg, process_promo_title)
        return

    TEMP_DATA[chat_id]['title'] = message.text.strip()
    USER_STATE[chat_id] = 'awaiting_promo_description'
    
    msg = bot.send_message(chat_id, "✍️ *Создание Акции (Шаг 2 из 5):*\n\n2. Введите **Описание** акции (подробности и условия):", parse_mode='Markdown')
    bot.register_next_step_handler(msg, process_promo_description)

def process_promo_description(message):
    chat_id = message.chat.id
    TEMP_DATA[chat_id]['description'] = message.text.strip()
    USER_STATE[chat_id] = 'awaiting_promo_discount'
    
    msg = bot.send_message(chat_id, "✍️ *Создание Акции (Шаг 3 из 5):*\n\n3. Введите **Размер скидки/Бонуса** (например: '20%' или 'x2 бонуса'):", parse_mode='Markdown')
    bot.register_next_step_handler(msg, process_promo_discount)

def process_promo_discount(message):
    chat_id = message.chat.id
    TEMP_DATA[chat_id]['discount_value'] = message.text.strip()
    USER_STATE[chat_id] = 'awaiting_promo_end_date'
    
    msg = bot.send_message(chat_id, "✍️ *Создание Акции (Шаг 4 из 5):*\n\n4. Введите **Дату окончания** акции в формате *ДД.ММ.ГГГГ* (например: 31.12.2025):", parse_mode='Markdown')
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

    # Переходим к загрузке фото (Шаг 5)
    USER_STATE[chat_id] = 'awaiting_promo_photo'
    
    # Создаём кнопку для пропуска загрузки фото
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
    markup.add(types.KeyboardButton("⏩ Пропустить загрузку фото"))
    
    bot.send_message(
        chat_id, 
        "📸 *Создание Акции (Шаг 5 из 5):*\n\n"
        "5. Загрузите **Изображение** для акции (фото товара, баннер и т.д.)\n\n"
        "Или нажмите кнопку *'Пропустить'* для создания акции без изображения.",
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

@bot.message_handler(func=lambda message: message.text == "🛠️ Услуги")
def handle_services_menu(message):
    chat_id = message.chat.id
    if not sm.partner_exists(chat_id) or sm.get_partner_status(chat_id) != 'Approved':
        bot.send_message(chat_id, "У вас нет прав для выполнения этой операции.")
        return

    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_add = types.InlineKeyboardButton("➕ Добавить новую услугу", callback_data="service_add")
    btn_manage = types.InlineKeyboardButton("🔍 Мои услуги (статус)", callback_data="service_status")
    btn_back = types.InlineKeyboardButton("⬅️ Назад в меню", callback_data="partner_main_menu")
    markup.add(btn_add, btn_manage, btn_back)

    bot.send_message(chat_id, "*Управление Услугами:*\nСоздайте услугу, которая будет доступна для обмена баллов клиентами (требуется одобрение Администратора).", reply_markup=markup, parse_mode='Markdown')

# Обработка Callback-запросов для Услуг
@bot.callback_query_handler(func=lambda call: call.data.startswith('service_'))
def handle_service_callbacks(call):
    chat_id = call.message.chat.id
    try:
        bot.edit_message_reply_markup(chat_id, call.message.message_id, reply_markup=None) 
    except Exception:
        pass
        
    if call.data == 'service_add':
        USER_STATE[chat_id] = 'awaiting_service_title'
        TEMP_DATA[chat_id] = {
            'partner_chat_id': str(chat_id),
            'status': 'Pending'  # Явно устанавливаем статус
        }
        
        msg = bot.send_message(chat_id, "✍️ *Создание Услуги (Шаг 1 из 3):*\n\n1. Введите **Название** услуги (например: 'Бесплатный кофе', 'Скидка 500 руб.'):", parse_mode='Markdown')
        bot.register_next_step_handler(msg, process_service_title)
    
    elif call.data == 'service_status':
        handle_service_status_list(chat_id)

    elif call.data == 'partner_main_menu':
        partner_main_menu(chat_id)
    
    # Важно: отвечаем на callback query
    bot.answer_callback_query(call.id)

def process_service_title(message):
    chat_id = message.chat.id
    TEMP_DATA[chat_id]['title'] = message.text.strip()
    USER_STATE[chat_id] = 'awaiting_service_description'
    
    msg = bot.send_message(chat_id, "✍️ *Создание Услуги (Шаг 2 из 3):*\n\n2. Введите **Описание** услуги (подробности, ограничения, как получить):", parse_mode='Markdown')
    bot.register_next_step_handler(msg, process_service_description)

def process_service_description(message):
    chat_id = message.chat.id
    TEMP_DATA[chat_id]['description'] = message.text.strip()
    USER_STATE[chat_id] = 'awaiting_service_price'
    
    msg = bot.send_message(chat_id, "✍️ *Создание Услуги (Шаг 3 из 3):*\n\n3. Введите **Стоимость** услуги в *баллах* (целое число, например: 100):", parse_mode='Markdown')
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

    # Сохраняем Услугу со статусом 'Pending'
    service_data = TEMP_DATA.pop(chat_id, None)
    USER_STATE.pop(chat_id, None)

    if not service_data:
        bot.send_message(chat_id, "Ошибка сессии. Попробуйте начать снова: /start")
        return

    try:
        success = sm.add_service(service_data)

        if success:
            bot.send_message(chat_id, "✅ **Услуга отправлена на модерацию!**\nАдминистратор рассмотрит вашу заявку и одобрит услугу, после чего она станет доступна клиентам.", parse_mode='Markdown')
        else:
            bot.send_message(chat_id, "❌ Ошибка при сохранении услуги. Проверьте логи.")
            
    except Exception as e:
        print(f"Error saving service: {e}")
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
    btn_back = types.InlineKeyboardButton("⬅️ Назад в меню", callback_data="partner_main_menu")
    markup.add(btn_bonus, btn_info, btn_back)
    
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
    
    bot.answer_callback_query(call.id)


# ------------------------------------
# ФУНКЦИОНАЛ: УПРАВЛЕНИЕ АКЦИЯМИ - ПРОСМОТР/УДАЛЕНИЕ (НОВОЕ)
# ------------------------------------

def handle_promo_manage_list(chat_id):
    """Показывает список акций партнёра для управления."""
    try:
        # Получаем все акции партнёра
        all_promos = sm.client.from_('promotions').select('*').eq('partner_chat_id', str(chat_id)).execute()
        
        if not all_promos.data:
            bot.send_message(chat_id, "У вас пока нет созданных акций.")
            partner_main_menu(chat_id)
            return
        
        response = "**📋 Ваши акции:**\n\n"
        for promo in all_promos.data:
            promo_id = promo.get('id')
            title = promo.get('title', 'Без названия')
            end_date = promo.get('end_date', 'N/A')
            
            response += f"• **{title}**\n"
            response += f"  ID: `{promo_id}` | До: {end_date}\n\n"
        
        response += "\n💡 Для удаления акции отправьте команду:\n`/delete_promo ID_АКЦИИ`"
        
        bot.send_message(chat_id, response, parse_mode='Markdown')
        logger.info(f"Партнёр {chat_id} просмотрел список своих акций")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка получения списка акций партнёра {chat_id}")
        bot.send_message(chat_id, "Ошибка при получении списка акций.")
    
    partner_main_menu(chat_id)


@bot.message_handler(commands=['delete_promo'])
def handle_delete_promo(message):
    """Удаляет акцию по ID."""
    chat_id = message.chat.id
    
    try:
        promo_id = message.text.replace('/delete_promo', '').strip()
        
        if not promo_id.isdigit():
            bot.send_message(chat_id, "❌ Неверный формат. Используйте: /delete_promo ID")
            return
        
        # Проверяем, принадлежит ли акция этому партнёру
        promo_check = sm.client.from_('promotions').select('*').eq('id', int(promo_id)).eq('partner_chat_id', str(chat_id)).execute()
        
        if not promo_check.data:
            bot.send_message(chat_id, "❌ Акция не найдена или не принадлежит вам.")
            return
        
        # Удаляем акцию
        sm.client.from_('promotions').delete().eq('id', int(promo_id)).execute()
        
        bot.send_message(chat_id, f"✅ Акция ID {promo_id} успешно удалена!")
        logger.info(f"Партнёр {chat_id} удалил акцию {promo_id}")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка удаления акции партнёром {chat_id}")
        bot.send_message(chat_id, "Произошла ошибка при удалении акции.")
    
    partner_main_menu(chat_id)


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
            status = service.get('status', 'Unknown')
            
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
# ЗАПУСК БОТА (ОСТАВЛЕНО)
# ------------------------------------
def run_bot():
    logger.info("=== Партнёрский бот запущен ===")
    while True:
        try:
            bot.polling(none_stop=True, interval=1, timeout=20)
        except KeyboardInterrupt:
            logger.info("Бот остановлен пользователем (KeyboardInterrupt)")
            break
        except Exception as e:
            log_exception(logger, e, "Ошибка соединения с Telegram API")
            logger.warning("Переподключение через 5 секунд...")
            time.sleep(5)

if __name__ == '__main__':
    try:
        run_bot()
    except Exception as e:
        log_exception(logger, e, "Критическая ошибка при запуске бота")
        raise