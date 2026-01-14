
from telebot import types
from supabase_manager import SupabaseManager

# Состояния регистрации
STATE_NONE = 0
STATE_WAITING_CATEGORY = 1
STATE_WAITING_NAME = 2
STATE_WAITING_COMPANY = 3
STATE_WAITING_PHONE = 4
STATE_WAITING_CITY = 5

REGISTRATION_DATA = {}

def start_registration(bot, message, sm: SupabaseManager):
    chat_id = message.chat.id
    
    # Проверка, не зарегистрирован ли уже
    if sm.partner_exists(chat_id):
        bot.send_message(chat_id, "✅ Вы уже зарегистрированы как партнер.")
        return

    REGISTRATION_DATA[chat_id] = {'step': STATE_WAITING_CATEGORY}
    
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
    markup.add("💄 Beauty (Салон/Мастер)", "🍔 Food (Кафе/Ресторан)")
    markup.add("🛍️ Retail (Магазин)", "🤳 Influencer (Блогер)")
    
    bot.send_message(chat_id, 
        "🚀 **Регистрация Партнера**\n\nВыберите категорию вашего бизнеса:", 
        reply_markup=markup, parse_mode='Markdown'
    )
    bot.register_next_step_handler(message, process_category, bot, sm)

def process_category(message, bot, sm):
    chat_id = message.chat.id
    text = message.text
    
    category_map = {
        "💄 Beauty (Салон/Мастер)": "beauty",
        "🍔 Food (Кафе/Ресторан)": "food",
        "🛍️ Retail (Магазин)": "retail",
        "🤳 Influencer (Блогер)": "influencer"
    }
    
    category = category_map.get(text)
    if not category:
        bot.send_message(chat_id, "Пожалуйста, выберите категорию из меню.")
        bot.register_next_step_handler(message, process_category, bot, sm)
        return
        
    REGISTRATION_DATA[chat_id]['category'] = category
    REGISTRATION_DATA[chat_id]['step'] = STATE_WAITING_NAME
    
    if category == 'influencer':
        prompt = "Введите ваше Имя (или Никнейм):"
    else:
        prompt = "Введите ваше Имя (ФИО контактного лица):"
        
    bot.send_message(chat_id, prompt, reply_markup=types.ReplyKeyboardRemove())
    bot.register_next_step_handler(message, process_name, bot, sm)

def process_name(message, bot, sm):
    chat_id = message.chat.id
    name = message.text
    REGISTRATION_DATA[chat_id]['name'] = name
    
    category = REGISTRATION_DATA[chat_id].get('category')
    
    if category == 'influencer':
        # Для блогеров пропускаем компанию и адрес
        REGISTRATION_DATA[chat_id]['company_name'] = name  # Используем имя как бренд
        finish_registration(message, bot, sm)
    else:
        REGISTRATION_DATA[chat_id]['step'] = STATE_WAITING_COMPANY
        bot.send_message(chat_id, "Введите название вашей компании (Салона/Кафе):")
        bot.register_next_step_handler(message, process_company, bot, sm)

def process_company(message, bot, sm):
    chat_id = message.chat.id
    company = message.text
    REGISTRATION_DATA[chat_id]['company_name'] = company
    
    REGISTRATION_DATA[chat_id]['step'] = STATE_WAITING_CITY
    bot.send_message(chat_id, "В каком городе вы работаете?")
    bot.register_next_step_handler(message, process_city, bot, sm)

def process_city(message, bot, sm):
    chat_id = message.chat.id
    city = message.text
    REGISTRATION_DATA[chat_id]['city'] = city
    
    finish_registration(message, bot, sm)

def finish_registration(message, bot, sm):
    chat_id = message.chat.id
    data = REGISTRATION_DATA.get(chat_id)
    
    if not data:
        bot.send_message(chat_id, "Ошибка регистрации. Начните заново /start")
        return
        
    # Сохраняем в Supabase
    try:
        # 1. Создаем заявку (или сразу партнера для MVP)
        # Для скорости MVP создаем сразу запись в partners (или application)
        # Используем существующий метод create_partner_application или raw insert
        
        # Подготовка данных
        payload = {
            'chat_id': str(chat_id),
            'name': data['name'],
            'company_name': data.get('company_name', data['name']),
            'city': data.get('city', 'Online'),
            'category_group': data['category'], # Новое поле!
            'business_type': data['category'],  # Дублируем для совместимости
            'status': 'Approved', # АВТО-ОДОБРЕНИЕ ДЛЯ MVP (чтобы сразу тестировать)
            'ui_config': {
                'show_booking': data['category'] == 'beauty', # Только для beauty
                'show_menu': data['category'] == 'food'
            }
        }
        
        # Вставляем в partners (upsert)
        sm.client.table('partners').upsert(payload).execute()
        
        bot.send_message(chat_id, 
            f"🎉 **Поздравляем! Вы зарегистрированы.**\n\n"
            f"Тип: {data['category'].upper()}\n"
            f"Теперь вы можете использовать бота для работы.",
            parse_mode='Markdown'
        )
        
        # Очистка
        del REGISTRATION_DATA[chat_id]
        
        # Показать главное меню (нужен импорт или callback)
        # bot.send_message(chat_id, "Нажмите /start чтобы увидеть меню.")
        
    except Exception as e:
        bot.send_message(chat_id, f"Ошибка сохранения: {e}")
