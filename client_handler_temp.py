# Временная версия клиентского бота для тестирования frontend
import telebot
from telebot import types
import os
import sys
from dotenv import load_dotenv

load_dotenv()

sys.path.append(os.path.dirname(__file__))
from supabase_manager import SupabaseManager

CLIENT_TOKEN = os.environ.get('TOKEN_CLIENT')
client_bot = telebot.TeleBot(CLIENT_TOKEN)
sm = SupabaseManager()

# !!! ЗАМЕНИТЕ НА ВАШ NGROK URL !!!
FRONTEND_URL = "http://127.0.0.1:5173"  # Временно для Web Inspector

@client_bot.message_handler(commands=['start'])
def start_message(message):
    markup = types.InlineKeyboardMarkup()
    
    # Web App кнопка
    webapp_button = types.InlineKeyboardButton(
        "🚀 Открыть приложение",
        web_app=types.WebAppInfo(url=FRONTEND_URL)
    )
    markup.add(webapp_button)
    
    # Инструкция для тестирования
    info_text = (
        f"👋 Привет, {message.from_user.first_name}!\n\n"
        f"🎨 **Frontend готов к тестированию!**\n\n"
        f"📱 **Как открыть:**\n"
        f"1. Используйте Telegram Desktop\n"
        f"2. Нажмите кнопку ниже\n"
        f"3. Или установите ngrok:\n"
        f"   `ngrok http 5173`\n\n"
        f"🌐 Dev сервер: {FRONTEND_URL}\n"
        f"👤 Ваш Chat ID: `{message.chat.id}`"
    )
    
    client_bot.send_message(
        message.chat.id,
        info_text,
        reply_markup=markup,
        parse_mode='Markdown'
    )

print("🤖 Клиентский бот запущен!")
print(f"📱 Frontend: {FRONTEND_URL}")
print(f"\n💡 Для работы в Telegram используйте:")
print(f"   1. Telegram Desktop (поддерживает localhost)")
print(f"   2. Или установите ngrok: ngrok http 5173")
print(f"\n▶️ Бот готов к работе...")

client_bot.infinity_polling()

