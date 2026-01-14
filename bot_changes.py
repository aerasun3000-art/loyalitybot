
# ... (начало файла)
from bot_registration import start_registration  # Импорт регистрации

# ...

# ------------------------------------
# КЛАВИАТУРЫ И УВЕДОМЛЕНИЯ
# ------------------------------------

def get_partner_keyboard(chat_id=None):
    """Главная клавиатура Партнера - адаптивная версия (Eco 2.0)."""
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    
    # Получаем конфиг партнера
    is_influencer = False
    is_food = False
    
    if chat_id:
        try:
            config = sm.get_partner_config(str(chat_id))
            category = config.get('category_group', 'beauty')
            is_influencer = category == 'influencer'
            is_food = category == 'food'
        except Exception:
            pass # Если ошибка, показываем дефолт
            
    # Основные категории
    btn_operations = types.KeyboardButton("💰 Операции")
    btn_content = types.KeyboardButton("📝 Контент")
    btn_analytics = types.KeyboardButton("📊 Аналитика")
    btn_revenue = types.KeyboardButton("💎 Revenue Share") # Доступно всем
    btn_invite = types.KeyboardButton("👥 Пригласить клиента") # Доступно всем (рефка)
    btn_more = types.KeyboardButton("⚙️ Ещё")
    
    # Логика отображения
    if is_influencer:
        # Блогеру не нужны операции (он не сканирует) и контент (у него нет услуг)
        # Ему нужны: Аналитика (выплаты), RevShare (сеть), Пригласить (рефка)
        markup.add(btn_analytics, btn_revenue)
        markup.add(btn_invite, btn_more)
    else:
        # Стандарт для Beauty/Food
        markup.add(btn_operations, btn_content)
        markup.add(btn_analytics, btn_revenue)
        markup.add(btn_invite, btn_more)
        
    return markup

def partner_main_menu(chat_id, message_text="Выберите следующее действие:"):
    """Возвращает партнера в главное меню."""
    markup = get_partner_keyboard(chat_id)
    bot.send_message(chat_id, message_text, reply_markup=markup, parse_mode='Markdown')

# ...

@bot.message_handler(commands=['register'])
def handle_register_command(message):
    """Запуск регистрации через бота."""
    start_registration(bot, message, sm)

@bot.message_handler(commands=['start', 'partner_start'])
def handle_partner_start(message):
    # ... (старый код) ...
    # Вместо заглушки регистрации:
    if not sm.partner_exists(chat_id):
        markup = types.ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
        markup.add(types.KeyboardButton("🚀 Зарегистрироваться"))
        bot.send_message(chat_id, 
            "Добро пожаловать в LoyalityBot!\n\n"
            "Вы еще не зарегистрированы как партнер.\n"
            "Нажмите кнопку ниже, чтобы начать.", 
            reply_markup=markup
        )
        return

@bot.message_handler(func=lambda message: message.text == "🚀 Зарегистрироваться")
def handle_registration_btn(message):
    start_registration(bot, message, sm)

# ...
