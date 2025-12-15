# client_handler.py (ФИНАЛЬНАЯ ВЕРСИЯ - КЛИЕНТСКИЙ ХАБ С NPS И РЕФЕРАЛАМИ)

import telebot
from telebot import types
import os
import sys
import re # <-- НОВЫЙ ИМПОРТ
import asyncio
import json
import datetime
import time
import io
import qrcode
import requests
import base64
import urllib.parse
from dotenv import load_dotenv
from logger_config import get_bot_logger, log_exception
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
        send_default_pii=True,  # Добавляет данные запросов (headers, IP) для отладки
        before_send=lambda event, hint: event if event.get('level') in ['error', 'fatal'] else None,
    )
    print("✅ Sentry инициализирован для client_bot")

sys.path.append(os.path.dirname(__file__))
from supabase_manager import SupabaseManager
# ОТКЛЮЧЕНО: GigaChat AI помощник
# from ai_helper import get_ai_support_answer
from rate_limiter import rate_limiter, check_rate_limit

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

# Используем переменную окружения для URL фронтенда
# Production URL: должен быть установлен через переменную окружения FRONTEND_URL
BASE_DOMAIN = os.environ.get('FRONTEND_URL')
if not BASE_DOMAIN:
    logger.warning("FRONTEND_URL не установлен в переменных окружения!")
    BASE_DOMAIN = 'https://your-frontend-domain.com'  # Замените на ваш реальный домен

# Регулярное выражение для парсинга реферальной ссылки
# Ожидаемый формат: /start partner_<ID> или /start ref_<CODE>
REFERRAL_PATTERN = re.compile(r'partner_(\d+)', re.IGNORECASE)
CLIENT_REFERRAL_PATTERN = re.compile(r'ref_([A-Z0-9]{6})', re.IGNORECASE)

# --- ГЛОБАЛЬНОЕ ХРАНИЛИЩЕ ДЛЯ NPS ---
# Ключ: chat_id клиента (str), Значение: chat_id партнера (str)
LAST_TRANSACTION_PARTNER = {}


# ------------------------------------
# ЛОГИКА NPS (БЕЗ ИЗМЕНЕНИЙ)
# ------------------------------------

def send_nps_request(chat_id: str, partner_chat_id: str):
    """Отправляет клиенту запрос на оценку NPS."""
    chat_id = str(chat_id)
    partner_chat_id = str(partner_chat_id)

    logger.info(f"[NPS] Отправка NPS запроса: client={chat_id}, partner={partner_chat_id}")
    
    LAST_TRANSACTION_PARTNER[chat_id] = partner_chat_id
    logger.debug(f"[NPS] Сохранён partner_chat_id в LAST_TRANSACTION_PARTNER для клиента {chat_id}")

    markup = types.InlineKeyboardMarkup(row_width=6)

    row1 = [types.InlineKeyboardButton(str(i), callback_data=f"nps_rate_{i}") for i in range(6)]
    row2 = [types.InlineKeyboardButton(str(i), callback_data=f"nps_rate_{i}") for i in range(6, 11)]

    markup.add(*row1)
    markup.add(*row2)

    try:
        client_bot.send_message(
            chat_id,
            "⭐ **Оцените, пожалуйста, работу мастера!**\n\n"
            "Насколько вероятно, что вы порекомендуете этого мастера другу или коллеге?\n"
            "(0 - крайне маловероятно, 10 - обязательно порекомендую)",
            reply_markup=markup,
            parse_mode='Markdown'
        )
        logger.info(f"[NPS] ✅ NPS запрос успешно отправлен клиенту {chat_id}")
    except Exception as e:
        logger.error(f"[NPS] ❌ Ошибка отправки NPS запроса клиенту {chat_id}: {e}", exc_info=True)


@client_bot.callback_query_handler(func=lambda call: call.data.startswith('nps_rate_'))
def callback_nps_rating(call):
    client_chat_id = str(call.message.chat.id)
    
    try:
        rating = int(call.data.split('_')[-1])
        logger.info(f"[NPS] Получен callback от клиента {client_chat_id}, оценка: {rating}")
        
        # Пытаемся получить partner_chat_id из словаря, если не найден - будет получен из БД в record_nps_rating
        partner_chat_id = LAST_TRANSACTION_PARTNER.pop(client_chat_id, None)
        
        if partner_chat_id:
            logger.info(f"[NPS] partner_chat_id найден в словаре: {partner_chat_id}")
        else:
            logger.info(f"[NPS] partner_chat_id не найден в словаре, будет поиск из БД")

        logger.info(f"[NPS] Запись оценки: client={client_chat_id}, partner={partner_chat_id or 'SYSTEM'}, rating={rating}")
        success = sm.record_nps_rating(client_chat_id, partner_chat_id or 'SYSTEM', rating, master_name='N/A')

        if success:
            logger.info(f"[NPS] ✅ Оценка успешно записана в БД для клиента {client_chat_id}")
            
            # Проверяем, был ли создан промоутер (при оценке 10)
            is_promoter = False
            if rating == 10:
                logger.info(f"[NPS] Проверка создания промоутера для клиента {client_chat_id}")
                promoter_info = sm.get_promoter_info(client_chat_id)
                if promoter_info:
                    is_promoter = True
                    promo_code = promoter_info.get('promo_code', '')
                    logger.info(f"[NPS] ✅ Промоутер найден для клиента {client_chat_id}, промо-код: {promo_code}")
                    
                    try:
                        client_bot.edit_message_text(
                            chat_id=client_chat_id,
                            message_id=call.message.message_id,
                            text=f"⭐⭐ **ОТЛИЧНО! Оценка: {rating}** ⭐⭐\n\n"
                                 "🎉 **Поздравляем! Вы стали промоутером!**\n\n"
                                 f"🎁 Ваш промо-код: `{promo_code}`\n\n"
                                 "📸 Теперь вы можете:\n"
                                 "• Создавать UGC контент для продвижения\n"
                                 "• Получать бонусы за публикации\n"
                                 "• Участвовать в конкурсах лидерборда\n"
                                 "• Выигрывать ценные призы!\n\n"
                                 "💬 Используйте /promoter для просмотра вашей статистики\n"
                                 "📝 Используйте /ugc для добавления контента",
                            parse_mode='Markdown'
                        )
                        logger.info(f"[NPS] ✅ Сообщение о промоутере отправлено клиенту {client_chat_id}")
                        
                        # Отправляем дополнительное уведомление о спецвозможностях
                        try:
                            import time
                            time.sleep(0.5)  # Небольшая задержка для лучшего UX
                            
                            markup = types.InlineKeyboardMarkup(row_width=1)
                            special_btn = types.InlineKeyboardButton(
                                "⭐ Открыть мои спецвозможности",
                                callback_data="show_special_features"
                            )
                            markup.add(special_btn)
                            
                            client_bot.send_message(
                                client_chat_id,
                                "⭐ **ВАМ ДОСТУПНЫ СПЕЦВОЗМОЖНОСТИ!** ⭐\n\n"
                                "🎯 **Что это дает вам:**\n\n"
                                "📊 **Статистика промоутера**\n"
                                "• Отслеживайте свой уровень и прогресс\n"
                                "• Смотрите количество публикаций\n"
                                "• Видите заработанные баллы\n\n"
                                "📸 **Создание UGC контента**\n"
                                "• Публикуйте посты с нашими материалами\n"
                                "• Получайте 100-200 баллов за каждую публикацию\n"
                                "• Участвуйте в конкурсах\n\n"
                                "📁 **Промо-материалы**\n"
                                "• Готовые тексты для постов\n"
                                "• Хештеги и шаблоны\n"
                                "• Инструкции по созданию контента\n\n"
                                "🏆 **Лидерборд**\n"
                                "• Соревнуйтесь с другими промоутерами\n"
                                "• Выигрывайте ценные призы\n"
                                "• Получайте бонусы за активность\n\n"
                                "📱 **QR-код промо-кода**\n"
                                "• Быстро делитесь своим промо-кодом\n"
                                "• Получайте бонусы за рефералов\n\n"
                                "💡 **Как использовать:**\n"
                                "• Нажмите кнопку ниже или используйте команду /special\n"
                                "• Все функции доступны в одном месте!",
                                reply_markup=markup,
                                parse_mode='Markdown'
                            )
                            logger.info(f"[NPS] ✅ Уведомление о спецвозможностях отправлено клиенту {client_chat_id}")
                        except Exception as e:
                            logger.error(f"[NPS] ❌ Ошибка отправки уведомления о спецвозможностях клиенту {client_chat_id}: {e}")
                    except Exception as e:
                        logger.error(f"[NPS] ❌ Ошибка отправки сообщения о промоутере клиенту {client_chat_id}: {e}")
                else:
                    logger.warning(f"[NPS] ⚠️ Промоутер не найден для клиента {client_chat_id} после оценки 10")
                    try:
                        client_bot.edit_message_text(
                            chat_id=client_chat_id,
                            message_id=call.message.message_id,
                            text=f"⭐ Спасибо за вашу оценку: **{rating}**!\n"
                                 "Ваше мнение помогает нам стать лучше.",
                            parse_mode='Markdown'
                        )
                    except Exception as e:
                        logger.error(f"[NPS] ❌ Ошибка отправки сообщения клиенту {client_chat_id}: {e}")
            else:
                logger.info(f"[NPS] Оценка {rating} (не 10), промоутер не создаётся")
                try:
                    client_bot.edit_message_text(
                        chat_id=client_chat_id,
                        message_id=call.message.message_id,
                        text=f"⭐ Спасибо за вашу оценку: **{rating}**!\n"
                             "Ваше мнение помогает нам стать лучше.",
                        parse_mode='Markdown'
                    )
                    logger.info(f"[NPS] ✅ Сообщение об оценке отправлено клиенту {client_chat_id}")
                except Exception as e:
                    logger.error(f"[NPS] ❌ Ошибка отправки сообщения клиенту {client_chat_id}: {e}")
        else:
            logger.error(f"[NPS] ❌ Не удалось записать NPS оценку для клиента {client_chat_id}")
            try:
                client_bot.edit_message_text(
                    chat_id=client_chat_id,
                    message_id=call.message.message_id,
                    text="❌ Извините, произошла ошибка при записи вашей оценки.",
                )
            except Exception as e:
                logger.error(f"[NPS] ❌ Ошибка отправки сообщения об ошибке клиенту {client_chat_id}: {e}")

        client_bot.answer_callback_query(call.id)
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка обработки NPS callback для клиента {client_chat_id}")
        try:
            client_bot.answer_callback_query(call.id, "Произошла ошибка. Попробуйте позже.")
        except:
            pass


# ------------------------------------
# QR-КОД ДЛЯ КЛИЕНТА
# ------------------------------------

def generate_qr_code(data: str) -> io.BytesIO:
    """Генерирует QR-код с данными и возвращает BytesIO объект."""
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


@client_bot.callback_query_handler(func=lambda call: call.data.startswith('view_conversation_'))
def handle_view_conversation(call):
    """Обработчик для просмотра переписки со специалистом."""
    chat_id = str(call.message.chat.id)
    partner_chat_id = call.data.replace('view_conversation_', '')
    
    try:
        # Получаем переписку из БД
        conversation = sm.get_conversation(chat_id, partner_chat_id, limit=20)
        
        if not conversation:
            client_bot.answer_callback_query(call.id, "Переписка пуста")
            client_bot.send_message(
                chat_id,
                "💬 **Переписка со специалистом**\n\n"
                "Пока нет сообщений. Ваше первое сообщение будет отправлено специалисту.",
                parse_mode='Markdown'
            )
            return
        
        # Получаем информацию о партнёре
        partner_data = sm.get_all_partners()
        partner_info = partner_data[partner_data['chat_id'] == partner_chat_id]
        partner_name = partner_info.iloc[0].get('name', 'Специалист') if not partner_info.empty else 'Специалист'
        partner_company = partner_info.iloc[0].get('company_name', '') if not partner_info.empty else ''
        
        # Формируем сообщение с перепиской
        messages_text = f"💬 **Переписка со специалистом**\n\n"
        if partner_company:
            messages_text += f"🏢 {partner_company}\n"
        messages_text += f"👤 {partner_name}\n\n"
        messages_text += "━━━━━━━━━━━━━━━━━━━━\n\n"
        
        # Показываем сообщения в хронологическом порядке
        for msg in reversed(conversation):
            sender_type = msg.get('sender_type', '')
            message_text = msg.get('message_text', '')
            message_type = msg.get('message_type', 'text')
            created_at = msg.get('created_at', '')
            
            # Форматируем время
            try:
                if created_at:
                    dt = datetime.datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    time_str = dt.strftime('%H:%M')
                else:
                    time_str = ''
            except:
                time_str = ''
            
            if sender_type == 'client':
                messages_text += f"👤 **Вы** ({time_str}):\n"
            else:
                messages_text += f"💼 **Специалист** ({time_str}):\n"
            
            if message_type == 'qr_code':
                messages_text += "📱 QR-код\n"
            elif message_type == 'image':
                messages_text += "📷 Изображение\n"
            elif message_text:
                messages_text += f"{message_text}\n"
            else:
                messages_text += "📎 Вложение\n"
            
            messages_text += "\n"
        
        # Добавляем кнопку для ответа (используем /start с параметром для отправки сообщения)
        markup = types.InlineKeyboardMarkup()
        reply_btn = types.InlineKeyboardButton(
            "✍️ Написать сообщение",
            url=f"https://t.me/{client_bot.get_me().username}?start=msg_{partner_chat_id}"
        )
        markup.add(reply_btn)
        
        client_bot.send_message(
            chat_id,
            messages_text,
            parse_mode='Markdown',
            reply_markup=markup
        )
        
        client_bot.answer_callback_query(call.id, "Переписка загружена")
        logger.info(f"Клиент {chat_id} просмотрел переписку со специалистом {partner_chat_id}")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка показа переписки для клиента {chat_id} со специалистом {partner_chat_id}")
        try:
            client_bot.answer_callback_query(call.id, "Ошибка загрузки переписки")
            client_bot.send_message(chat_id, "❌ Произошла ошибка при загрузке переписки. Попробуйте позже.")
        except:
            pass


@client_bot.callback_query_handler(func=lambda call: call.data == 'show_qr_code')
def handle_show_qr_code(call):
    """Обработчик для показа QR-кода клиента."""
    chat_id = str(call.message.chat.id)
    
    try:
        # Проверяем, зарегистрирован ли клиент
        client_exists = sm.client_exists(chat_id)
        
        if not client_exists:
            client_bot.answer_callback_query(
                call.id, 
                "Сначала зарегистрируйтесь через приложение",
                show_alert=True
            )
            client_bot.send_message(
                chat_id,
                "📱 **Для получения QR-кода нужно зарегистрироваться**\n\n"
                "Нажмите кнопку '🚀 Открыть приложение' для регистрации в программе лояльности.\n\n"
                "После регистрации вы сможете получить свой QR-код для быстрого начисления баллов.",
                parse_mode='Markdown'
            )
            return
        
        # Генерируем QR-код с chat_id клиента
        # Формат: CLIENT_ID:<chat_id>
        qr_data = f"CLIENT_ID:{chat_id}"
        qr_image = generate_qr_code(qr_data)
        
        client_bot.send_photo(
            chat_id,
            qr_image,
            caption="📱 **Ваш QR-код**\n\n"
                    "Покажите этот QR-код партнеру для быстрого начисления или списания баллов.\n\n"
                    f"Ваш ID: `{chat_id}`",
            parse_mode='Markdown'
        )
        
        logger.info(f"Клиент {chat_id} запросил QR-код")
        client_bot.answer_callback_query(call.id, "QR-код отправлен")
    
    except Exception as e:
        log_exception(logger, e, f"Ошибка генерации QR-кода для клиента {chat_id}")
        try:
            client_bot.answer_callback_query(call.id, "Ошибка при генерации QR-кода")
            client_bot.send_message(chat_id, "❌ Произошла ошибка при генерации QR-кода. Попробуйте позже.")
        except:
            pass


# ------------------------------------
# ГЛАВНЫЙ ОБРАБОТЧИК /START (ОБНОВЛЕНО)
# ------------------------------------

@client_bot.message_handler(commands=['start', 'help'])
def handle_new_user_start(message):
    chat_id = str(message.chat.id)
    text = message.text or ''
    
    # Проверяем, есть ли данные от sendData через start_param
    # sendData отправляет данные через start_param в формате JSON
    try:
        # Получаем start_param из текста (формат: /start <param>)
        parts = text.split(' ', 1)
        if len(parts) > 1:
            start_param = parts[1]
            
            # Проверяем, это запрос на контакт со специалистом через бота (новый формат)
            # НОВЫЙ ФОРМАТ: contact_<base64> - полностью обходит проблему кэширования
            if start_param.startswith('contact_'):
                # Извлекаем base64 данные
                data_part = start_param.replace('contact_', '')
                try:
                    # Добавляем padding для base64
                    padding = 4 - (len(data_part) % 4)
                    if padding != 4:
                        data_part += '=' * padding
                    qr_data_json = base64.b64decode(data_part).decode('utf-8')
                    qr_data = json.loads(qr_data_json)
                    
                    # Если это contact_specialist action, обрабатываем ниже
                    # Не возвращаемся здесь, продолжаем выполнение к обработке contact_specialist
                    if not qr_data or qr_data.get('action') != 'contact_specialist':
                        # Старый формат - просто приветствие
                        client_bot.send_message(
                            chat_id,
                            "👋 **Здравствуйте! Специалист на связи.**\n\n"
                            "Напишите ваш вопрос, и я постараюсь помочь! 💬",
                            parse_mode='Markdown'
                        )
                        return
                except Exception as e:
                    logger.error(f"Ошибка парсинга contact_ параметра: {e}")
                    client_bot.send_message(
                        chat_id,
                        "❌ Ошибка обработки запроса. Попробуйте позже.",
                        parse_mode='Markdown'
                    )
                    return
            else:
                # Старый формат - пытаемся распарсить JSON или base64 напрямую
                try:
                    qr_data = json.loads(start_param)
                except json.JSONDecodeError:
                    # Если не JSON, пробуем декодировать как base64
                    try:
                        # Добавляем padding для base64 если нужно
                        padding = 4 - (len(start_param) % 4)
                        if padding != 4:
                            start_param_padded = start_param + '=' * padding
                        else:
                            start_param_padded = start_param
                        qr_data_json = base64.b64decode(start_param_padded).decode('utf-8')
                        qr_data = json.loads(qr_data_json)
                    except:
                        # Если не удалось распарсить, проверяем старый формат
                        if start_param.startswith('send_qr_'):
                            data_part = start_param.replace('send_qr_', '')
                            # Добавляем padding для base64
                            padding = 4 - (len(data_part) % 4)
                            if padding != 4:
                                data_part += '=' * padding
                            qr_data_json = base64.b64decode(data_part).decode('utf-8')
                            qr_data = json.loads(qr_data_json)
                        else:
                            # Если не удалось распарсить, qr_data останется None
                            qr_data = None
            
            # Проверяем действие (только если qr_data не None)
            if qr_data and qr_data.get('action') == 'contact_specialist':
                partner_chat_id = qr_data.get('partner_chat_id')
                message_text = qr_data.get('message_text', '')
                client_chat_id = qr_data.get('client_chat_id', chat_id)
                service_title = qr_data.get('service_title', '')
                
                if not partner_chat_id:
                    client_bot.send_message(chat_id, "❌ Ошибка: не указан специалист", parse_mode='Markdown')
                    return
                
                # Проверяем, существует ли партнёр
                partner_exists = sm.partner_exists(partner_chat_id)
                if not partner_exists:
                    client_bot.send_message(chat_id, "❌ Специалист не найден в системе.", parse_mode='Markdown')
                    return

                # Сначала сохраняем сообщение в БД
                service_id_uuid = qr_data.get('service_id', None)
                # service_id может быть UUID (строка) или числом - приводим к строке
                if service_id_uuid:
                    service_id_uuid = str(service_id_uuid)
                
                message_id = sm.save_message(
                    client_chat_id=client_chat_id,
                    partner_chat_id=partner_chat_id,
                    sender_type='client',
                    message_text=message_text,
                    message_type='text',
                    service_id=service_id_uuid,
                    service_title=service_title
                )
                
                # Получаем информацию о клиенте для отображения партнёру
                client_info = sm.get_client_details_for_partner(int(client_chat_id)) if client_chat_id.isdigit() else None
                client_name = client_info.get('name', 'Не указано') if client_info else 'Неизвестный клиент'
                client_phone = client_info.get('phone', 'Не указан') if client_info else 'Не указан'
                
                # Отправляем сообщение партнёру через партнёрского бота
                try:
                    from bot import bot as partner_bot
                    
                    # Создаем inline-кнопку для ответа клиенту
                    markup = types.InlineKeyboardMarkup()
                    reply_btn = types.InlineKeyboardButton(
                        "💬 Ответить клиенту",
                        callback_data=f"reply_to_client_{client_chat_id}"
                    )
                    markup.add(reply_btn)
                    
                    # Формируем сообщение для партнёра с полной информацией
                    partner_message = (
                        f"📩 **Новое сообщение от клиента!**\n\n"
                        f"👤 **Имя:** {client_name}\n"
                        f"🆔 **Chat ID:** `{client_chat_id}`\n"
                        f"📱 **Телефон:** {client_phone}\n"
                    )
                    if service_title:
                        partner_message += f"📋 **Услуга:** {service_title}\n"
                    partner_message += f"\n💬 **Сообщение:**\n_{message_text}_\n\n"
                    partner_message += "Нажмите кнопку ниже, чтобы ответить клиенту.\n"
                    partner_message += "Или используйте раздел '💬 Мои сообщения' для просмотра всей переписки."
                    
                    # Пытаемся отправить партнёру
                    try:
                        partner_bot.send_message(
                            partner_chat_id,
                            partner_message,
                            parse_mode='Markdown',
                            reply_markup=markup
                        )
                        # Если сообщение отправлено, отмечаем как прочитанное
                        if message_id:
                            sm.mark_message_as_read(message_id)
                    except Exception as send_error:
                        # Если партнёр недоступен, сообщение уже сохранено в БД
                        logger.warning(f"Не удалось отправить сообщение партнёру {partner_chat_id}, но оно сохранено в БД: {send_error}")
                    
                    # Подтверждаем клиенту с кнопкой для просмотра переписки
                    markup = types.InlineKeyboardMarkup()
                    view_conversation_btn = types.InlineKeyboardButton(
                        "💬 Открыть переписку",
                        callback_data=f"view_conversation_{partner_chat_id}"
                    )
                    markup.add(view_conversation_btn)
                    
                    client_bot.send_message(
                        chat_id,
                        "✅ **Ваше сообщение отправлено специалисту!**\n\n"
                        "Он получит уведомление и ответит вам в ближайшее время. 💬\n\n"
                        "_Сообщение сохранено в истории переписки._\n\n"
                        "Нажмите кнопку ниже, чтобы открыть переписку:",
                        parse_mode='Markdown',
                        reply_markup=markup
                    )
                    
                    logger.info(f"Клиент {chat_id} отправил сообщение специалисту {partner_chat_id} (сохранено в БД: ID={message_id})")
                except Exception as e:
                    log_exception(logger, e, f"Ошибка отправки сообщения специалисту {partner_chat_id} от клиента {chat_id}")
                    # Сообщение уже сохранено в БД, даже если отправка не удалась
                    client_bot.send_message(
                        chat_id, 
                        "✅ **Ваше сообщение сохранено!**\n\n"
                        "Специалист получит его, как только станет доступен. 💬",
                        parse_mode='Markdown'
                    )
                return
            
            elif qr_data and qr_data.get('action') == 'send_qr_to_partner':
                partner_chat_id = qr_data.get('partner_chat_id')
                # Поддерживаем оба формата: qr_image (data URL) и qr_image_base64 (чистый base64)
                qr_image = qr_data.get('qr_image', '') or qr_data.get('qr_image_base64', '')
                client_chat_id = qr_data.get('client_chat_id', chat_id)
                service_title = qr_data.get('service_title', '')
                
                if not partner_chat_id:
                    client_bot.send_message(chat_id, "❌ Ошибка: не указан партнёр", parse_mode='Markdown')
                    return
                
                if not qr_image:
                    client_bot.send_message(chat_id, "❌ Ошибка: QR-код не найден", parse_mode='Markdown')
                    return
                
                # Сохраняем QR-код в истории переписки
                service_id_uuid = qr_data.get('service_id', None)
                # service_id может быть UUID (строка) или числом - приводим к строке
                if service_id_uuid:
                    service_id_uuid = str(service_id_uuid)
                
                # Сохраняем сообщение с QR-кодом (используем data URL как attachment_url)
                message_id = sm.save_message(
                    client_chat_id=client_chat_id,
                    partner_chat_id=partner_chat_id,
                    sender_type='client',
                    message_text=f"Отправлен QR-код для услуги: {service_title}" if service_title else "Отправлен QR-код",
                    message_type='qr_code',
                    attachment_url=qr_image,  # Сохраняем data URL целиком
                    attachment_type='qr_code',
                    service_id=service_id_uuid,
                    service_title=service_title
                )
                
                # Отправляем QR партнёру
                result = send_qr_to_partner(partner_chat_id, qr_image, client_chat_id, service_title)
                
                if result.get('success'):
                    # Если QR отправлен успешно, отмечаем сообщение как прочитанное
                    if message_id:
                        sm.mark_message_as_read(message_id)
                    
                    client_bot.send_message(
                        chat_id,
                        "✅ **QR-код успешно отправлен партнёру!**\n\n"
                        "Партнёр получит QR-код и сможет сканировать его для начисления баллов.\n\n"
                        "_QR-код сохранён в истории переписки._",
                        parse_mode='Markdown'
                    )
                else:
                    # QR сохранён в БД, даже если отправка не удалась
                    error_msg = result.get('error', 'Неизвестная ошибка')
                    client_bot.send_message(
                        chat_id,
                        f"✅ **QR-код сохранён!**\n\n"
                        f"Партнёр получит его, как только станет доступен.\n\n"
                        f"_QR-код сохранён в истории переписки._",
                        parse_mode='Markdown'
                    )
                    logger.info(f"QR-код сохранён в истории переписки (ID={message_id}), но не удалось отправить: {error_msg}")
                
                logger.info(f"Обработан sendData запрос от {chat_id} для партнёра {partner_chat_id}")
                return
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        # Это нормально, если start_param не наш формат - продолжаем обычную обработку
        pass
    except Exception as e:
        log_exception(logger, e, f"Ошибка обработки sendData от {chat_id}")
        # Продолжаем обычную обработку /start
    
    # Rate limiting: 5 команд в минуту
    allowed, error = check_rate_limit(chat_id, 'command')
    if not allowed:
        client_bot.send_message(chat_id, f"⏸️ {error}")
        logger.warning(f"Rate limit exceeded for {chat_id}: start command")
        return
    
    logger.info(f"Клиент {chat_id} запустил бота с текстом: {text}")

    # --- 1. ПАРСИНГ РЕФЕРАЛЬНОЙ ССЫЛКИ ---
    partner_id = None
    client_referral_code = None
    # Ищем совпадение в тексте сообщения, пропуская '/start '
    partner_match = REFERRAL_PATTERN.search(text)
    client_match = CLIENT_REFERRAL_PATTERN.search(text)
    
    if partner_match:
        partner_id = partner_match.group(1)
        logger.info(f"Обнаружен partner_id из реферальной ссылки: {partner_id}")
    elif client_match:
        client_referral_code = client_match.group(1).upper()
        logger.info(f"Обнаружен реферальный код клиента: {client_referral_code}")

    try:
        client_exists = sm.client_exists(chat_id)
    except Exception as e:
        log_exception(logger, e, f"Ошибка проверки существования клиента {chat_id}")
        # Даже при ошибке показываем меню, чтобы пользователь мог попробовать
        markup = types.InlineKeyboardMarkup(row_width=1)
        # UX-ФОКУСНОЕ РЕШЕНИЕ: Возвращаем Web App, но используем tg.openLink() во фронтенде
        import random
        cache_bust = int(time.time() * 1000)
        random_suffix = random.randint(100000, 999999)
        # АГРЕССИВНЫЙ CACHE BUSTING - добавляем версию и timestamp
        version = 'v13-netlify-deploy'
        web_app_url = f"{BASE_DOMAIN}?v={cache_bust}&nocache=1&_t={cache_bust}&_r={cache_bust}&_cache_bust={cache_bust}&_refresh={cache_bust}&_cb={cache_bust}&timestamp={cache_bust}&rand={random_suffix}&_v13={version}&_force={random_suffix}&_netlify=1&_nocache={cache_bust}"
        webapp_btn = types.InlineKeyboardButton(
            "🚀 Открыть приложение",
            web_app=types.WebAppInfo(url=web_app_url)  # Возвращаем Web App
        )
        qr_btn = types.InlineKeyboardButton(
            "📱 Показать QR-код",
            callback_data="show_qr_code"
        )
        markup.add(webapp_btn, qr_btn)
        client_bot.send_message(
            chat_id,
            "👋 **Добро пожаловать в LoyalityBot!**\n\n"
            "Произошла временная ошибка при доступе к системе. Попробуйте открыть приложение:",
            reply_markup=markup,
            parse_mode='Markdown'
        )
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
                # Показываем меню даже при ошибке регистрации
                client_exists = False
        except Exception as e:
            log_exception(logger, e, f"Критическая ошибка при регистрации клиента {chat_id} через ссылку")
            # Показываем меню даже при критической ошибке
            client_exists = False
    
    # --- 2.1. ЛОГИКА: РЕГИСТРАЦИЯ ПО РЕФЕРАЛЬНОЙ ССЫЛКЕ КЛИЕНТА ---
    if not client_exists and client_referral_code:
        try:
            # Регистрируем клиента по реферальной ссылке другого клиента
            result = sm.register_client_via_client_referral(chat_id, client_referral_code, phone=None, name=None)
            
            if result and not result[1]:  # Успешная регистрация
                bonus_amount = sm.WELCOME_BONUS_AMOUNT
                logger.info(f"Клиент {chat_id} успешно зарегистрирован по реферальной ссылке клиента {client_referral_code}")
                client_bot.send_message(
                    chat_id,
                    f"🎉 **Добро пожаловать!**\n\n"
                    f"Вы зарегистрировались по реферальной ссылке и получили **{bonus_amount}** приветственных баллов!\n\n"
                    f"💡 Приглашайте друзей и получайте бонусы за каждого нового пользователя!",
                    parse_mode='Markdown'
                )
                client_exists = True
            else:
                error_msg = result[1] if result else "Неизвестная ошибка"
                logger.error(f"Ошибка регистрации клиента {chat_id} по реферальной ссылке {client_referral_code}: {error_msg}")
                client_bot.send_message(
                    chat_id,
                    f"❌ Ошибка регистрации: {error_msg}\n\n"
                    f"Проверьте правильность реферальной ссылки.",
                    parse_mode='Markdown'
                )
                client_exists = False
        except Exception as e:
            log_exception(logger, e, f"Критическая ошибка при регистрации клиента {chat_id} через реферальную ссылку")
            client_exists = False

    # --- 3. ЛОГИКА: СУЩЕСТВУЮЩИЙ КЛИЕНТ (включая только что зарегистрированных) ---
    if client_exists:
        # --- ЛОГИКА: ОБНОВЛЕНИЕ ВРЕМЕННОГО ID (СУЩЕСТВУЮЩАЯ ЛОГИКА) ---
        try:
            client_data = sm.get_client_details_for_partner(chat_id)
            # Если chat_id начинается с VIA_PARTNER_, значит, клиент впервые нажал /start
            if client_data and client_data.get('chat_id', '').startswith('VIA_PARTNER_'):
                temp_id = client_data['chat_id']
                # Обновляем chat_id в таблицах. Поиск идет по temp_id.
                if sm.update_client_chat_id(old_id=temp_id, new_id=chat_id):
                    logger.info(f"CLIENT_HANDLER: Обновлен chat_id клиента с {temp_id} на {chat_id}")
        except Exception as e:
            log_exception(logger, e, f"Ошибка при обновлении chat_id для {chat_id}")

        # Всегда показываем меню для существующего клиента
        markup = types.InlineKeyboardMarkup(row_width=1)
        # UX-ФОКУСНОЕ РЕШЕНИЕ: Возвращаем Web App, но используем tg.openLink() во фронтенде
        import random
        cache_bust = int(time.time() * 1000)
        random_suffix = random.randint(100000, 999999)
        # АГРЕССИВНЫЙ CACHE BUSTING - добавляем версию и timestamp
        version = 'v13-netlify-deploy'
        web_app_url = f"{BASE_DOMAIN}?v={cache_bust}&nocache=1&_t={cache_bust}&_r={cache_bust}&_cache_bust={cache_bust}&_refresh={cache_bust}&_cb={cache_bust}&timestamp={cache_bust}&rand={random_suffix}&_v13={version}&_force={random_suffix}&_netlify=1&_nocache={cache_bust}"
        webapp_btn = types.InlineKeyboardButton(
            "🚀 Открыть приложение",
            web_app=types.WebAppInfo(url=web_app_url)  # Возвращаем Web App
        )
        qr_btn = types.InlineKeyboardButton(
            "📱 Показать QR-код",
            callback_data="show_qr_code"
        )
        markup.add(webapp_btn, qr_btn)
        
        # Проверяем, является ли промоутером, и добавляем кнопку "Мои спецвозможности"
        try:
            promoter_info = sm.get_promoter_info(chat_id)
            if promoter_info:
                special_btn = types.InlineKeyboardButton(
                    "⭐ Мои спецвозможности",
                    callback_data="show_special_features"
                )
                markup.add(special_btn)
        except Exception as e:
            logger.debug(f"Не удалось проверить статус промоутера для {chat_id}: {e}")

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
    markup = types.InlineKeyboardMarkup(row_width=1)
    # НОВОЕ РЕШЕНИЕ: Бот как посредник - полностью обходит проблему кэширования
    import random
    cache_bust = int(time.time() * 1000)
    random_suffix = random.randint(100000, 999999)
    # АГРЕССИВНЫЙ CACHE BUSTING - новая версия для бота-посредника
    version = 'v13-netlify-deploy'
    web_app_url = f"{BASE_DOMAIN}?v={cache_bust}&nocache=1&_t={cache_bust}&_r={cache_bust}&_cache_bust={cache_bust}&_refresh={cache_bust}&_cb={cache_bust}&timestamp={cache_bust}&rand={random_suffix}&_v13={version}&_force={random_suffix}&_netlify=1&_nocache={cache_bust}&_reload={cache_bust}&_clear_cache=1&_version={version}"
    webapp_btn = types.InlineKeyboardButton(
        "🚀 Открыть приложение",
        web_app=types.WebAppInfo(url=web_app_url)  # Возвращаем Web App
    )
    qr_btn = types.InlineKeyboardButton(
        "📱 Показать QR-код",
        callback_data="show_qr_code"
    )
    markup.add(webapp_btn, qr_btn)

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

@client_bot.message_handler(commands=['referral', 'рефералы', 'пригласить'])
def handle_referral_command(message):
    """Обработчик команды для реферальной программы."""
    chat_id = str(message.chat.id)
    
    # Rate limiting
    allowed, error = check_rate_limit(chat_id, 'command')
    if not allowed:
        client_bot.send_message(chat_id, f"⏸️ {error}")
        return
    
    try:
        # Получаем или создаём реферальный код
        referral_code = sm.get_or_create_referral_code(chat_id)
        if not referral_code:
            client_bot.send_message(chat_id, "❌ Ошибка получения реферального кода. Попробуйте позже.")
            return
        
        # Получаем статистику
        stats = sm.get_referral_stats(chat_id)
        
        # Формируем реферальную ссылку
        bot_username = client_bot.get_me().username
        referral_link = f"https://t.me/{bot_username}?start=ref_{referral_code}"
        
        # Формируем сообщение
        level_emoji = {
            'bronze': '🥉',
            'silver': '🥈',
            'gold': '🥇',
            'platinum': '💎'
        }
        level_name = {
            'bronze': 'Бронза',
            'silver': 'Серебро',
            'gold': 'Золото',
            'platinum': 'Платина'
        }
        
        level = stats.get('referral_level', 'bronze')
        emoji = level_emoji.get(level, '🥉')
        level_text = level_name.get(level, 'Бронза')
        
        message_text = (
            f"🎯 **Реферальная программа**\n\n"
            f"📊 **Ваша статистика:**\n"
            f"• Уровень: {emoji} {level_text}\n"
            f"• Всего приглашено: {stats.get('total_referrals', 0)}\n"
            f"• Активных рефералов: {stats.get('active_referrals', 0)}\n"
            f"• Заработано баллов: {stats.get('total_earnings', 0)} 💸\n\n"
            f"🔗 **Ваша реферальная ссылка:**\n"
            f"`{referral_link}`\n\n"
            f"💡 **Как это работает:**\n"
            f"• За регистрацию друга: +100 баллов\n"
            f"• За покупки друга: 8% от его баллов\n"
            f"• За внучатого реферала: 25 баллов + 4% с покупок\n"
            f"• За правнучатого: 10 баллов + 2% с покупок\n\n"
            f"🎁 **Достижения:**\n"
            f"• 5 рефералов: +200 баллов\n"
            f"• 10 рефералов: +500 баллов\n"
            f"• 25 рефералов: +1500 баллов\n"
            f"• 50 рефералов: +3000 баллов"
        )
        
        # Кнопки для копирования ссылки и QR-кода
        markup = types.InlineKeyboardMarkup(row_width=1)
        qr_btn = types.InlineKeyboardButton(
            "📱 QR-код реферальной ссылки",
            callback_data=f"referral_qr_{referral_code}"
        )
        copy_btn = types.InlineKeyboardButton(
            "📋 Копировать ссылку",
            callback_data=f"copy_referral_{referral_code}"
        )
        stats_btn = types.InlineKeyboardButton(
            "📊 Подробная статистика",
            callback_data="referral_stats_detail"
        )
        markup.add(qr_btn, copy_btn, stats_btn)
        
        client_bot.send_message(
            chat_id,
            message_text,
            reply_markup=markup,
            parse_mode='Markdown'
        )
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка при обработке команды referral для {chat_id}")
        client_bot.send_message(chat_id, "❌ Произошла ошибка при получении данных. Попробуйте позже.")

@client_bot.message_handler(commands=['promoter', 'промоутер'])
def handle_promoter_command(message):
    """Обработчик команды для промоутеров."""
    chat_id = str(message.chat.id)
    
    # Rate limiting
    allowed, error = check_rate_limit(chat_id, 'command')
    if not allowed:
        client_bot.send_message(chat_id, f"⏸️ {error}")
        return
    
    try:
        # Получаем информацию о промоутере
        promoter_info = sm.get_promoter_info(chat_id)
        
        if not promoter_info:
            client_bot.send_message(
                chat_id,
                "❌ Вы ещё не являетесь промоутером.\n\n"
                "⭐ Чтобы стать промоутером, поставьте оценку **10** при следующем визите в партнёрскую организацию!"
            )
            return
        
        # Получаем UGC контент
        all_content = sm.get_ugc_content_for_promoter(chat_id)
        approved_content = [c for c in all_content if c.get('status') == 'approved']
        pending_content = [c for c in all_content if c.get('status') == 'pending']
        
        # Уровни промоутера
        level_emoji = {
            'novice': '🌱',
            'active': '⭐',
            'pro': '🔥',
            'master': '👑'
        }
        level_name = {
            'novice': 'Новичок',
            'active': 'Активный',
            'pro': 'Профессионал',
            'master': 'Мастер'
        }
        
        level = promoter_info.get('promoter_level', 'novice')
        emoji = level_emoji.get(level, '🌱')
        level_text = level_name.get(level, 'Новичок')
        
        promo_code = promoter_info.get('promo_code', 'N/A')
        
        message_text = (
            f"🎯 **Статистика промоутера**\n\n"
            f"📊 **Уровень:** {emoji} {level_text}\n"
            f"🎁 **Промо-код:** `{promo_code}`\n\n"
            f"📸 **Публикации:**\n"
            f"• Всего: {promoter_info.get('total_publications', 0)}\n"
            f"• Одобрено: {len(approved_content)}\n"
            f"• На модерации: {len(pending_content)}\n\n"
            f"💸 **Заработано:** {promoter_info.get('total_earned_points', 0)} баллов\n\n"
            f"🏆 **Призы:**\n"
            f"• Выиграно: {promoter_info.get('prizes_won', 0)}\n"
            f"• Общая стоимость: {promoter_info.get('total_prize_value', 0)} 💰\n"
        )
        
        # Получаем позицию в лидерборде, если есть активный период
        active_period = sm.get_active_leaderboard_period()
        if active_period:
            rank_info = sm.get_leaderboard_rank_for_user(active_period['id'], chat_id)
            if rank_info:
                message_text += f"\n📈 **Лидерборд:**\n"
                message_text += f"• Текущая позиция: #{rank_info.get('final_rank', 'N/A')}\n"
                message_text += f"• Баллы: {rank_info.get('total_score', 0):.2f}\n"
        
        markup = types.InlineKeyboardMarkup(row_width=1)
        qr_btn = types.InlineKeyboardButton(
            "📱 QR-код промо-кода",
            callback_data=f"promoter_qr_{promo_code}"
        )
        ugc_btn = types.InlineKeyboardButton("📸 Добавить UGC контент", callback_data="add_ugc_content")
        materials_btn = types.InlineKeyboardButton("📁 Промо-материалы", callback_data="promo_materials")
        leaderboard_btn = types.InlineKeyboardButton("🏆 Лидерборд", callback_data="view_leaderboard")
        markup.add(qr_btn, ugc_btn, materials_btn, leaderboard_btn)
        
        client_bot.send_message(
            chat_id,
            message_text,
            reply_markup=markup,
            parse_mode='Markdown'
        )
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка при обработке команды promoter для {chat_id}")
        client_bot.send_message(chat_id, "❌ Произошла ошибка при получении данных. Попробуйте позже.")

@client_bot.message_handler(commands=['ugc'])
def handle_ugc_command(message):
    """Обработчик команды для добавления UGC контента."""
    chat_id = str(message.chat.id)
    
    # Rate limiting
    allowed, error = check_rate_limit(chat_id, 'command')
    if not allowed:
        client_bot.send_message(chat_id, f"⏸️ {error}")
        return
    
    try:
        # Проверяем, является ли промоутером
        promoter_info = sm.get_promoter_info(chat_id)
        if not promoter_info:
            client_bot.send_message(
                chat_id,
                "❌ Вы не являетесь промоутером.\n\n"
                "⭐ Чтобы стать промоутером, поставьте оценку **10** при следующем визите!"
            )
            return
        
        # Получаем промо-материалы
        materials = sm.get_promo_materials()
        
        message_text = (
            "📸 **Добавление UGC контента**\n\n"
            "📝 **Инструкция:**\n"
            "1. Создайте публикацию с нашими материалами\n"
            "2. Отправьте ссылку на публикацию в формате:\n"
            "`/ugc_add <ссылка> <платформа>`\n\n"
            "**Платформы:** instagram, telegram, vk, other\n\n"
            "**Пример:**\n"
            "`/ugc_add https://instagram.com/p/abc123 instagram`\n\n"
        )
        
        if materials:
            message_text += "📁 **Доступные материалы:**\n"
            for mat in materials[:5]:  # Показываем первые 5
                message_text += f"• {mat.get('title', 'Материал')}\n"
        
        client_bot.send_message(chat_id, message_text, parse_mode='Markdown')
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка при обработке команды ugc для {chat_id}")
        client_bot.send_message(chat_id, "❌ Произошла ошибка. Попробуйте позже.")

@client_bot.message_handler(commands=['special', 'спецвозможности', 'specials'])
def handle_special_features_command(message):
    """Обработчик команды для просмотра спецвозможностей промоутера."""
    chat_id = str(message.chat.id)
    
    # Rate limiting
    allowed, error = check_rate_limit(chat_id, 'command')
    if not allowed:
        client_bot.send_message(chat_id, f"⏸️ {error}")
        return
    
    try:
        # Проверяем, является ли промоутером
        promoter_info = sm.get_promoter_info(chat_id)
        
        if not promoter_info:
            client_bot.send_message(
                chat_id,
                "❌ **Спецвозможности доступны только промоутерам**\n\n"
                "⭐ Чтобы стать промоутером, поставьте оценку **10** при следующем визите в партнёрскую организацию!\n\n"
                "Промоутеры получают:\n"
                "• 🎁 Уникальный промо-код\n"
                "• 📸 Возможность создавать UGC контент\n"
                "• 💰 Бонусы за публикации\n"
                "• 🏆 Участие в конкурсах лидерборда\n"
                "• 🎁 Ценные призы!",
                parse_mode='Markdown'
            )
            return
        
        # Показываем меню спецвозможностей
        show_special_features_menu(chat_id)
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка при обработке команды special для {chat_id}")
        client_bot.send_message(chat_id, "❌ Произошла ошибка. Попробуйте позже.")


@client_bot.callback_query_handler(func=lambda call: call.data == 'show_special_features')
def callback_show_special_features(call):
    """Callback для кнопки 'Мои спецвозможности'."""
    chat_id = str(call.message.chat.id)
    
    try:
        client_bot.answer_callback_query(call.id)
        show_special_features_menu(chat_id)
    except Exception as e:
        log_exception(logger, e, f"Ошибка обработки callback show_special_features для {chat_id}")


def show_special_features_menu(chat_id: str):
    """Показывает меню спецвозможностей для промоутера."""
    try:
        promoter_info = sm.get_promoter_info(chat_id)
        
        if not promoter_info:
            client_bot.send_message(
                chat_id,
                "❌ Вы ещё не являетесь промоутером.\n\n"
                "⭐ Чтобы стать промоутером, поставьте оценку **10** при следующем визите!",
                parse_mode='Markdown'
            )
            return
        
        # Получаем статистику
        all_content = sm.get_ugc_content_for_promoter(chat_id)
        approved_content = [c for c in all_content if c.get('status') == 'approved']
        pending_content = [c for c in all_content if c.get('status') == 'pending']
        
        level_emoji = {
            'novice': '🌱',
            'active': '⭐',
            'pro': '🔥',
            'master': '👑'
        }
        level_name = {
            'novice': 'Новичок',
            'active': 'Активный',
            'pro': 'Профессионал',
            'master': 'Мастер'
        }
        
        level = promoter_info.get('promoter_level', 'novice')
        emoji = level_emoji.get(level, '🌱')
        level_text = level_name.get(level, 'Новичок')
        
        message_text = (
            f"⭐ **МОИ СПЕЦВОЗМОЖНОСТИ** ⭐\n\n"
            f"📊 **Ваш уровень:** {emoji} {level_text}\n"
            f"🎁 **Промо-код:** `{promoter_info.get('promo_code', 'N/A')}`\n\n"
            f"📸 **Публикации:**\n"
            f"• Одобрено: {len(approved_content)}\n"
            f"• На модерации: {len(pending_content)}\n"
            f"• Заработано: {promoter_info.get('total_earned_points', 0)} баллов\n\n"
            f"💡 **Выберите действие:**"
        )
        
        markup = types.InlineKeyboardMarkup(row_width=1)
        
        # Кнопка "Статистика промоутера" (вызывает /promoter)
        promoter_btn = types.InlineKeyboardButton(
            "🎯 Статистика промоутера",
            callback_data="special_promoter_stats"
        )
        
        # Кнопка "Добавить UGC контент" (вызывает /ugc)
        ugc_btn = types.InlineKeyboardButton(
            "📸 Добавить UGC контент",
            callback_data="special_add_ugc"
        )
        
        # Кнопка "Промо-материалы"
        materials_btn = types.InlineKeyboardButton(
            "📁 Промо-материалы",
            callback_data="promo_materials"
        )
        
        # Кнопка "Лидерборд"
        leaderboard_btn = types.InlineKeyboardButton(
            "🏆 Лидерборд",
            callback_data="view_leaderboard"
        )
        
        # Кнопка "QR-код промо-кода"
        qr_btn = types.InlineKeyboardButton(
            "📱 QR-код промо-кода",
            callback_data=f"promoter_qr_{promoter_info.get('promo_code', '')}"
        )
        
        # Кнопка "Конвертировать баллы" (если есть завершённые периоды)
        completed_periods = sm.get_completed_periods_for_user(chat_id)
        available_periods = [p for p in completed_periods if p.get('can_convert')]
        
        markup.add(promoter_btn, ugc_btn, materials_btn, leaderboard_btn, qr_btn)
        
        if available_periods:
            convert_btn = types.InlineKeyboardButton(
                f"💱 Конвертировать баллы ({len(available_periods)})",
                callback_data="special_convert_points"
            )
            markup.add(convert_btn)
        
        client_bot.send_message(
            chat_id,
            message_text,
            reply_markup=markup,
            parse_mode='Markdown'
        )
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка показа меню спецвозможностей для {chat_id}")
        client_bot.send_message(chat_id, "❌ Произошла ошибка. Попробуйте позже.")


@client_bot.callback_query_handler(func=lambda call: call.data == 'special_promoter_stats')
def callback_special_promoter_stats(call):
    """Callback для кнопки 'Статистика промоутера' из меню спецвозможностей."""
    chat_id = str(call.message.chat.id)
    
    try:
        client_bot.answer_callback_query(call.id)
        # Вызываем обработчик команды /promoter
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
                self.text = "/promoter"
        
        handle_promoter_command(TempMessage(chat_id))
    except Exception as e:
        log_exception(logger, e, f"Ошибка обработки callback special_promoter_stats для {chat_id}")


@client_bot.callback_query_handler(func=lambda call: call.data == 'special_add_ugc')
def callback_special_add_ugc(call):
    """Callback для кнопки 'Добавить UGC контент' из меню спецвозможностей."""
    chat_id = str(call.message.chat.id)
    
    try:
        client_bot.answer_callback_query(call.id)
        # Вызываем обработчик команды /ugc
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
                self.text = "/ugc"
        
        handle_ugc_command(TempMessage(chat_id))
    except Exception as e:
        log_exception(logger, e, f"Ошибка обработки callback special_add_ugc для {chat_id}")


@client_bot.callback_query_handler(func=lambda call: call.data == 'special_convert_points')
def callback_special_convert_points(call):
    """Callback для кнопки 'Конвертировать баллы' из меню спецвозможностей."""
    chat_id = str(call.message.chat.id)
    
    try:
        client_bot.answer_callback_query(call.id)
        # Вызываем обработчик команды /convert_points
        class TempMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id})()
                self.text = "/convert_points"
        
        handle_convert_points_command(TempMessage(chat_id))
    except Exception as e:
        log_exception(logger, e, f"Ошибка обработки callback special_convert_points для {chat_id}")


@client_bot.message_handler(commands=['leaderboard', 'лидерборд'])
def handle_leaderboard_command(message):
    """Обработчик команды для просмотра лидерборда."""
    chat_id = str(message.chat.id)
    
    # Rate limiting
    allowed, error = check_rate_limit(chat_id, 'command')
    if not allowed:
        client_bot.send_message(chat_id, f"⏸️ {error}")
        return
    
    try:
        # Получаем активный период
        active_period = sm.get_active_leaderboard_period()
        
        if not active_period:
            client_bot.send_message(
                chat_id,
                "⏳ Сейчас нет активного периода лидерборда.\n\n"
                "Следующий конкурс скоро начнётся!"
            )
            return
        
        # Получаем топ участников
        top_users = sm.get_leaderboard_top(active_period['id'], limit=10)
        
        # Получаем позицию пользователя
        user_rank = sm.get_leaderboard_rank_for_user(active_period['id'], chat_id)
        
        message_text = (
            f"🏆 **Лидерборд** 🏆\n\n"
            f"📅 **Период:** {active_period.get('period_name', 'Текущий месяц')}\n"
            f"📊 **Статус:** {'Активен' if active_period.get('status') == 'active' else 'Завершён'}\n\n"
            f"🥇 **ТОП-10:**\n\n"
        )
        
        medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
        
        for idx, user in enumerate(top_users[:10], start=1):
            rank_emoji = medals[idx - 1] if idx <= 10 else f"{idx}."
            name = user.get('users', {}).get('name', 'Аноним') if isinstance(user.get('users'), dict) else user.get('client_chat_id', 'N/A')
            score = float(user.get('total_score', 0))
            message_text += f"{rank_emoji} {name}: {score:.2f} баллов\n"
        
        if user_rank:
            user_final_rank = user_rank.get('final_rank', 'N/A')
            user_score = float(user_rank.get('total_score', 0))
            message_text += f"\n📈 **Ваша позиция:** #{user_final_rank}\n"
            message_text += f"💯 **Ваши баллы:** {user_score:.2f}\n"
        
        # Показываем призы
        prizes_config = active_period.get('prizes_config', {})
        if prizes_config:
            message_text += f"\n🎁 **Призы:**\n"
            if '1' in prizes_config:
                prize = prizes_config['1']
                message_text += f"🥇 1 место: {prize.get('name', 'Приз')}\n"
            if '2' in prizes_config:
                prize = prizes_config['2']
                message_text += f"🥈 2 место: {prize.get('name', 'Приз')}\n"
            if '3' in prizes_config:
                prize = prizes_config['3']
                message_text += f"🥉 3 место: {prize.get('name', 'Приз')}\n"
        
        client_bot.send_message(chat_id, message_text, parse_mode='Markdown')
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка при обработке команды leaderboard для {chat_id}")
        client_bot.send_message(chat_id, "❌ Произошла ошибка при получении данных. Попробуйте позже.")


@client_bot.message_handler(commands=['convert_points', 'конвертировать', 'convert'])
def handle_convert_points_command(message):
    """Обработчик команды для конвертации баллов лидерборда."""
    chat_id = str(message.chat.id)
    
    # Rate limiting
    allowed, error = check_rate_limit(chat_id, 'command')
    if not allowed:
        client_bot.send_message(chat_id, f"⏸️ {error}")
        return
    
    try:
        # Получаем завершённые периоды, где можно конвертировать баллы
        completed_periods = sm.get_completed_periods_for_user(chat_id)
        
        if not completed_periods:
            client_bot.send_message(
                chat_id,
                "❌ **Нет доступных периодов для конвертации**\n\n"
                "Конвертация доступна только для:\n"
                "• Завершённых периодов лидерборда\n"
                "• Участников, которые не получили призы\n"
                "• Периодов с включённой конвертацией",
                parse_mode='Markdown'
            )
            return
        
        # Фильтруем периоды, где можно конвертировать
        available_periods = [p for p in completed_periods if p.get('can_convert')]
        
        if not available_periods:
            # Показываем периоды, где уже конвертировано или есть приз
            converted_periods = [p for p in completed_periods if p.get('points_converted')]
            prize_periods = [p for p in completed_periods if p.get('has_prize')]
            
            message_text = "📊 **Ваши периоды лидерборда:**\n\n"
            
            if converted_periods:
                message_text += "✅ **Уже конвертировано:**\n"
                for period in converted_periods:
                    message_text += (
                        f"• {period['period_name']}: "
                        f"{period['points_converted_amount']:.2f} баллов "
                        f"(было {period['total_score']:.2f})\n"
                    )
                message_text += "\n"
            
            if prize_periods:
                message_text += "🎁 **Получены призы:**\n"
                for period in prize_periods:
                    message_text += f"• {period['period_name']}: {period['total_score']:.2f} баллов\n"
                message_text += "\n"
            
            if not converted_periods and not prize_periods:
                message_text += "Нет доступных периодов для конвертации."
            
            client_bot.send_message(chat_id, message_text, parse_mode='Markdown')
            return
        
        # Если только один период доступен, сразу конвертируем
        if len(available_periods) == 1:
            period = available_periods[0]
            success, result = sm.convert_leaderboard_points_to_loyalty(period['period_id'], chat_id)
            
            if success:
                loyalty_points = result.get('loyalty_points', 0)
                leaderboard_points = result.get('leaderboard_points', 0)
                conversion_rate = result.get('conversion_rate', 10.0)
                
                client_bot.send_message(
                    chat_id,
                    f"✅ **Баллы успешно конвертированы!**\n\n"
                    f"📊 **Период:** {period['period_name']}\n"
                    f"🎯 **Баллы лидерборда:** {leaderboard_points:.2f}\n"
                    f"💱 **Курс конвертации:** {conversion_rate}%\n"
                    f"💰 **Получено баллов:** {loyalty_points:.2f}\n\n"
                    f"Баллы добавлены на ваш счёт!",
                    parse_mode='Markdown'
                )
            else:
                error_msg = result.get('error', 'Неизвестная ошибка')
                client_bot.send_message(
                    chat_id,
                    f"❌ **Ошибка конвертации**\n\n{error_msg}",
                    parse_mode='Markdown'
                )
            return
        
        # Если несколько периодов, показываем список для выбора
        message_text = "📊 **Выберите период для конвертации:**\n\n"
        markup = types.InlineKeyboardMarkup(row_width=1)
        
        for period in available_periods:
            loyalty_points = period['total_score'] * (period['conversion_rate'] / 100.0)
            message_text += (
                f"• {period['period_name']}\n"
                f"  Баллы: {period['total_score']:.2f} → {loyalty_points:.2f} "
                f"(курс: {period['conversion_rate']}%)\n\n"
            )
            
            btn = types.InlineKeyboardButton(
                f"🔄 {period['period_name']} ({loyalty_points:.0f} баллов)",
                callback_data=f"convert_period_{period['period_id']}"
            )
            markup.add(btn)
        
        client_bot.send_message(chat_id, message_text, reply_markup=markup, parse_mode='Markdown')
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка при обработке команды convert_points для {chat_id}")
        client_bot.send_message(chat_id, "❌ Произошла ошибка. Попробуйте позже.")


@client_bot.callback_query_handler(func=lambda call: call.data.startswith('convert_period_'))
def callback_convert_period(call):
    """Callback для конвертации баллов конкретного периода."""
    chat_id = str(call.message.chat.id)
    
    try:
        client_bot.answer_callback_query(call.id)
        
        period_id = int(call.data.replace('convert_period_', ''))
        
        # Получаем информацию о периоде
        period_info = sm.client.from_('leaderboard_periods').select('period_name, points_conversion_rate').eq('id', period_id).limit(1).execute()
        
        if not period_info.data:
            client_bot.send_message(chat_id, "❌ Период не найден.")
            return
        
        period_name = period_info.data[0].get('period_name', 'Период')
        conversion_rate = float(period_info.data[0].get('points_conversion_rate', 10.0))
        
        # Конвертируем баллы
        success, result = sm.convert_leaderboard_points_to_loyalty(period_id, chat_id)
        
        if success:
            loyalty_points = result.get('loyalty_points', 0)
            leaderboard_points = result.get('leaderboard_points', 0)
            
            client_bot.edit_message_text(
                f"✅ **Баллы успешно конвертированы!**\n\n"
                f"📊 **Период:** {period_name}\n"
                f"🎯 **Баллы лидерборда:** {leaderboard_points:.2f}\n"
                f"💱 **Курс конвертации:** {conversion_rate}%\n"
                f"💰 **Получено баллов:** {loyalty_points:.2f}\n\n"
                f"Баллы добавлены на ваш счёт!",
                chat_id=chat_id,
                message_id=call.message.message_id,
                parse_mode='Markdown'
            )
        else:
            error_msg = result.get('error', 'Неизвестная ошибка')
            client_bot.edit_message_text(
                f"❌ **Ошибка конвертации**\n\n{error_msg}",
                chat_id=chat_id,
                message_id=call.message.message_id,
                parse_mode='Markdown'
            )
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка обработки callback convert_period для {chat_id}")
        client_bot.answer_callback_query(call.id, "Произошла ошибка", show_alert=True)

# ОТКЛЮЧЕНО: GigaChat AI помощник
# @client_bot.message_handler(commands=['ask', 'спросить'])
# def handle_ask_command(message):
#     """Обработчик команды /ask - запрос к AI помощнику"""
#     chat_id = str(message.chat.id)
#     
#     # Rate limiting: 5 команд в минуту
#     allowed, error = check_rate_limit(chat_id, 'command')
#     if not allowed:
#         client_bot.send_message(chat_id, f"⏸️ {error}")
#         logger.warning(f"Rate limit exceeded for {chat_id}: ask command")
#         return
#     
#     logger.info(f"Клиент {chat_id} использовал команду /ask")
#     
#     client_bot.send_message(
#         chat_id,
#         "🤖 **AI Помощник**\n\n"
#         "Задайте свой вопрос о программе лояльности, и я постараюсь помочь!\n\n"
#         "Например:\n"
#         "• Как накопить баллы?\n"
#         "• Где найти партнеров?\n"
#         "• Как обменять баллы?\n\n"
#         "Или начните вопрос с символа **?**",
#         parse_mode='Markdown'
#     )


# ОТКЛЮЧЕНО: GigaChat AI помощник - конфликтовал с другими обработчиками
# @client_bot.message_handler(func=lambda message: message.text and message.text.startswith('?'))
# def handle_ai_question(message):
#     """Обработчик вопросов, начинающихся с ?"""
#     chat_id = str(message.chat.id)
#     
#     # Rate limiting: 10 сообщений в минуту
#     allowed, error = check_rate_limit(chat_id, 'message')
#     if not allowed:
#         client_bot.send_message(chat_id, f"⏸️ {error}")
#         logger.warning(f"Rate limit exceeded for {chat_id}: AI question")
#         return
#     
#     question = message.text[1:].strip()  # Убираем "?" из начала
#     
#     if not question:
#         client_bot.send_message(chat_id, "Пожалуйста, укажите ваш вопрос после символа ?")
#         return
#     
#     logger.info(f"AI вопрос от клиента {chat_id}: {question}")
#     
#     # Показываем, что бот "думает"
#     thinking_msg = client_bot.send_message(chat_id, "🤔 Думаю...")
#     
#     try:
#         # Получаем ответ от AI (синхронная обертка для async функции)
#         loop = asyncio.new_event_loop()
#         asyncio.set_event_loop(loop)
#         answer = loop.run_until_complete(get_ai_support_answer(question))
#         loop.close()
#         
#         # Удаляем сообщение "Думаю..."
#         try:
#             client_bot.delete_message(chat_id, thinking_msg.message_id)
#         except:
#             pass
#         
#         # Отправляем ответ
#         client_bot.send_message(
#             chat_id,
#             f"🤖 **AI Помощник:**\n\n{answer}\n\n"
#             f"_Если нужна дополнительная помощь, напишите 'поддержка'_",
#             parse_mode='Markdown'
#         )
#         
#         logger.info(f"AI ответ отправлен клиенту {chat_id}")
#         
#     except Exception as e:
#         log_exception(logger, e, f"Ошибка получения AI ответа для клиента {chat_id}")
#         
#         try:
#             client_bot.delete_message(chat_id, thinking_msg.message_id)
#         except:
#             pass
#         
#         client_bot.send_message(
#             chat_id,
#             "😔 Извините, сейчас я не могу ответить на ваш вопрос.\n\n"
#             "Попробуйте позже или напишите 'поддержка' для связи с оператором."
#         )


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
    
    # Rate limiting: 1 экспорт в час
    allowed, error = check_rate_limit(chat_id, 'export_data')
    if not allowed:
        client_bot.send_message(chat_id, f"⏸️ {error}")
        logger.warning(f"Rate limit exceeded for {chat_id}: export_data")
        return
    
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
    
    # Rate limiting: 1 попытка удаления в день
    allowed, error = check_rate_limit(chat_id, 'delete_account')
    if not allowed:
        client_bot.send_message(chat_id, f"⏸️ {error}")
        logger.warning(f"Rate limit exceeded for {chat_id}: delete_account")
        return
    
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


@client_bot.message_handler(commands=['ugc_add'])
def handle_ugc_add_command(message):
    """Обработчик команды для добавления UGC контента."""
    chat_id = str(message.chat.id)
    
    # Rate limiting
    allowed, error = check_rate_limit(chat_id, 'command')
    if not allowed:
        client_bot.send_message(chat_id, f"⏸️ {error}")
        return
    
    try:
        # Проверяем, является ли промоутером
        promoter_info = sm.get_promoter_info(chat_id)
        if not promoter_info:
            client_bot.send_message(
                chat_id,
                "❌ Вы не являетесь промоутером.\n\n"
                "⭐ Чтобы стать промоутером, поставьте оценку **10** при следующем визите!"
            )
            return
        
        # Парсим команду: /ugc_add <ссылка> <платформа>
        text = message.text.strip()
        parts = text.split(None, 2)
        
        if len(parts) < 3:
            client_bot.send_message(
                chat_id,
                "❌ Неверный формат команды.\n\n"
                "**Использование:**\n"
                "`/ugc_add <ссылка> <платформа>`\n\n"
                "**Платформы:** instagram, telegram, vk, other\n\n"
                "**Пример:**\n"
                "`/ugc_add https://instagram.com/p/abc123 instagram`"
            )
            return
        
        content_url = parts[1]
        platform = parts[2].lower()
        
        # Проверяем платформу
        valid_platforms = ['instagram', 'telegram', 'vk', 'other']
        if platform not in valid_platforms:
            client_bot.send_message(
                chat_id,
                f"❌ Неверная платформа: {platform}\n\n"
                f"**Доступные платформы:** {', '.join(valid_platforms)}"
            )
            return
        
        # Добавляем UGC контент
        promo_code = promoter_info.get('promo_code')
        success, ugc_id = sm.add_ugc_content(chat_id, content_url, platform, promo_code)
        
        if success:
            client_bot.send_message(
                chat_id,
                f"✅ **UGC контент добавлен!**\n\n"
                f"📸 Ссылка: {content_url}\n"
                f"📱 Платформа: {platform}\n"
                f"🎁 Промо-код: `{promo_code}`\n\n"
                f"⏳ Ваш контент отправлен на модерацию. После одобрения вы получите бонусные баллы!"
            )
            logger.info(f"UGC контент добавлен промоутером {chat_id}, ID: {ugc_id}")
        else:
            client_bot.send_message(
                chat_id,
                "❌ Ошибка при добавлении контента. Попробуйте позже."
            )
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка при обработке команды ugc_add для {chat_id}")
        client_bot.send_message(chat_id, "❌ Произошла ошибка. Попробуйте позже.")

@client_bot.callback_query_handler(func=lambda call: call.data == 'add_ugc_content')
def callback_add_ugc_content(call):
    """Callback для кнопки 'Добавить UGC контент'."""
    chat_id = str(call.message.chat.id)
    
    try:
        client_bot.answer_callback_query(call.id)
        client_bot.send_message(
            chat_id,
            "📸 **Добавление UGC контента**\n\n"
            "📝 **Инструкция:**\n"
            "1. Создайте публикацию с нашими материалами\n"
            "2. Отправьте ссылку на публикацию в формате:\n"
            "`/ugc_add <ссылка> <платформа>`\n\n"
            "**Платформы:** instagram, telegram, vk, other\n\n"
            "**Пример:**\n"
            "`/ugc_add https://instagram.com/p/abc123 instagram`",
            parse_mode='Markdown'
        )
    except Exception as e:
        log_exception(logger, e, f"Ошибка обработки callback add_ugc_content для {chat_id}")

@client_bot.callback_query_handler(func=lambda call: call.data == 'promo_materials')
def callback_promo_materials(call):
    """Callback для кнопки 'Промо-материалы'."""
    chat_id = str(call.message.chat.id)
    
    try:
        client_bot.answer_callback_query(call.id)
        
        # Получаем промо-материалы
        materials = sm.get_promo_materials()
        
        if not materials:
            client_bot.send_message(
                chat_id,
                "📁 Промо-материалы скоро появятся!\n\n"
                "Следите за обновлениями."
            )
            return
        
        message_text = "📁 **Промо-материалы**\n\n"
        
        for mat in materials[:10]:  # Показываем первые 10
            title = mat.get('title', 'Материал')
            description = mat.get('description', '')
            material_type = mat.get('material_type', '')
            file_url = mat.get('file_url', '')
            
            message_text += f"📎 **{title}**\n"
            if description:
                message_text += f"   {description}\n"
            message_text += f"   Тип: {material_type}\n"
            if file_url:
                message_text += f"   📥 [Скачать]({file_url})\n"
            message_text += "\n"
        
        client_bot.send_message(chat_id, message_text, parse_mode='Markdown', disable_web_page_preview=True)
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка обработки callback promo_materials для {chat_id}")

@client_bot.callback_query_handler(func=lambda call: call.data == 'view_leaderboard')
def callback_view_leaderboard(call):
    """Callback для кнопки 'Лидерборд'."""
    chat_id = str(call.message.chat.id)
    
    try:
        client_bot.answer_callback_query(call.id)
        
        # Получаем активный период
        active_period = sm.get_active_leaderboard_period()
        
        if not active_period:
            client_bot.send_message(
                chat_id,
                "⏳ Сейчас нет активного периода лидерборда.\n\n"
                "Следующий конкурс скоро начнётся!"
            )
            return
        
        # Получаем топ участников
        top_users = sm.get_leaderboard_top(active_period['id'], limit=10)
        
        # Получаем позицию пользователя
        user_rank = sm.get_leaderboard_rank_for_user(active_period['id'], chat_id)
        
        message_text = (
            f"🏆 **Лидерборд** 🏆\n\n"
            f"📅 **Период:** {active_period.get('period_name', 'Текущий месяц')}\n"
            f"📊 **Статус:** {'Активен' if active_period.get('status') == 'active' else 'Завершён'}\n\n"
            f"🥇 **ТОП-10:**\n\n"
        )
        
        medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
        
        for idx, user in enumerate(top_users[:10], start=1):
            rank_emoji = medals[idx - 1] if idx <= 10 else f"{idx}."
            name = user.get('users', {}).get('name', 'Аноним') if isinstance(user.get('users'), dict) else user.get('client_chat_id', 'N/A')
            score = float(user.get('total_score', 0))
            message_text += f"{rank_emoji} {name}: {score:.2f} баллов\n"
        
        if user_rank:
            user_final_rank = user_rank.get('final_rank', 'N/A')
            user_score = float(user_rank.get('total_score', 0))
            message_text += f"\n📈 **Ваша позиция:** #{user_final_rank}\n"
            message_text += f"💯 **Ваши баллы:** {user_score:.2f}\n"
        
        # Показываем призы
        prizes_config = active_period.get('prizes_config', {})
        if prizes_config:
            message_text += f"\n🎁 **Призы:**\n"
            if '1' in prizes_config:
                prize = prizes_config['1']
                message_text += f"🥇 1 место: {prize.get('name', 'Приз')}\n"
            if '2' in prizes_config:
                prize = prizes_config['2']
                message_text += f"🥈 2 место: {prize.get('name', 'Приз')}\n"
            if '3' in prizes_config:
                prize = prizes_config['3']
                message_text += f"🥉 3 место: {prize.get('name', 'Приз')}\n"
        
        client_bot.send_message(chat_id, message_text, parse_mode='Markdown')
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка обработки callback view_leaderboard для {chat_id}")


@client_bot.callback_query_handler(func=lambda call: call.data.startswith('referral_qr_'))
def handle_referral_qr(call):
    """Генерирует QR-код для реферальной ссылки."""
    chat_id = str(call.message.chat.id)
    
    try:
        referral_code = call.data.replace('referral_qr_', '')
        bot_username = client_bot.get_me().username
        referral_link = f"https://t.me/{bot_username}?start=ref_{referral_code}"
        
        # Генерируем QR-код с реферальной ссылкой
        qr_image = generate_qr_code(referral_link)
        
        client_bot.send_photo(
            chat_id,
            qr_image,
            caption=(
                f"📱 **QR-код реферальной ссылки**\n\n"
                f"🔗 Ссылка: `{referral_link}`\n\n"
                f"💡 **Как использовать:**\n"
                f"• Поделитесь QR-кодом с друзьями\n"
                f"• Они отсканируют и присоединятся по вашей ссылке\n"
                f"• Вы получите бонусы за их регистрацию и покупки!"
            ),
            parse_mode='Markdown'
        )
        
        client_bot.answer_callback_query(call.id, "QR-код отправлен")
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка генерации QR-кода реферальной ссылки для {chat_id}")
        client_bot.answer_callback_query(call.id, "Ошибка при генерации QR-кода")


@client_bot.callback_query_handler(func=lambda call: call.data.startswith('promoter_qr_'))
def handle_promoter_qr(call):
    """Генерирует QR-код для промо-кода промоутера."""
    chat_id = str(call.message.chat.id)
    
    try:
        promo_code = call.data.replace('promoter_qr_', '')
        
        # Формируем данные для QR-кода (промо-код)
        qr_data = f"PROMO:{promo_code}"
        
        # Генерируем QR-код
        qr_image = generate_qr_code(qr_data)
        
        client_bot.send_photo(
            chat_id,
            qr_image,
            caption=(
                f"📱 **QR-код промо-кода**\n\n"
                f"🎁 Промо-код: `{promo_code}`\n\n"
                f"💡 **Как использовать:**\n"
                f"• Добавьте QR-код в свой UGC контент\n"
                f"• Друзья сканируют и присоединяются по вашему коду\n"
                f"• Вы получаете бонусы за их активность!"
            ),
            parse_mode='Markdown'
        )
        
        client_bot.answer_callback_query(call.id, "QR-код отправлен")
        
    except Exception as e:
        log_exception(logger, e, f"Ошибка генерации QR-кода промо-кода для {chat_id}")
        client_bot.answer_callback_query(call.id, "Ошибка при генерации QR-кода")


# ------------------------------------
# ОТПРАВКА QR КОДА ПАРТНЕРУ
# ------------------------------------

def send_qr_to_partner(partner_chat_id: str, qr_image_data: str, client_chat_id: str, service_title: str = "") -> dict:
    """Отправка QR-кода партнёру через партнёрского бота"""
    token = os.getenv('TOKEN_PARTNER')
    
    if not token:
        logger.warning("TOKEN_PARTNER не настроен")
        return {"success": False, "error": "Telegram бот не настроен"}
    
    # Нормализуем partner_chat_id (убираем пробелы, приводим к строке)
    partner_chat_id = str(partner_chat_id).strip()
    
    logger.info(f"Попытка отправить QR партнёру {partner_chat_id} от клиента {client_chat_id}")
    
    try:
        # Сначала проверяем, может ли бот отправить сообщение партнёру через getChat
        try:
            check_url = f"https://api.telegram.org/bot{token}/getChat"
            check_response = requests.post(check_url, data={'chat_id': partner_chat_id}, timeout=5)
            check_json = check_response.json()
            
            if not check_response.ok:
                error_desc = check_json.get('description', 'Неизвестная ошибка')
                if 'chat not found' in error_desc.lower() or 'user not found' in error_desc.lower():
                    logger.error(f"Партнёр {partner_chat_id} не найден. Партнёр должен запустить партнёрского бота командой /start")
                    return {
                        "success": False, 
                        "error": f"Партнёр не найден. Партнёр должен сначала запустить партнёрского бота командой /start (Chat ID: {partner_chat_id})"
                    }
                elif check_response.status_code == 403:
                    logger.error(f"Партнёр {partner_chat_id} заблокировал бота или не разрешил отправку сообщений")
                    return {
                        "success": False,
                        "error": f"Партнёр заблокировал бота или не разрешил отправку сообщений. Попросите партнёра запустить партнёрского бота командой /start"
                    }
        except Exception as check_error:
            logger.warning(f"Не удалось проверить доступность партнёра {partner_chat_id}: {check_error}. Продолжаем отправку...")
        
        # Декодируем base64 изображение
        # Поддерживаем два формата:
        # 1. data:image/png;base64,<base64_data>
        # 2. <base64_data> (чистый base64)
        if ',' in qr_image_data:
            # Формат data URL
            qr_image_bytes = base64.b64decode(qr_image_data.split(',')[1])
        else:
            # Чистый base64
            qr_image_bytes = base64.b64decode(qr_image_data)
        
        # Отправляем фото через Telegram API
        url = f"https://api.telegram.org/bot{token}/sendPhoto"
        
        # Формируем caption с информацией о клиенте
        caption = (
            f"📱 **QR-код от клиента**\n\n"
            f"Клиент ID: `{client_chat_id}`\n"
        )
        if service_title:
            caption += f"Услуга: {service_title}\n"
        caption += (
            f"\nСканируйте QR-код для начисления баллов клиенту.\n"
            f"Или используйте команду: `➕ Начислить баллы`"
        )
        
        files = {
            'photo': ('qr-code.png', qr_image_bytes, 'image/png')
        }
        
        payload = {
            'chat_id': str(partner_chat_id),
            'caption': caption,
            'parse_mode': 'Markdown'
        }
        
        response = requests.post(url, files=files, data=payload, timeout=10)
        
        # Проверяем ответ API
        response_json = response.json()
        if not response.ok:
            error_description = response_json.get('description', 'Неизвестная ошибка')
            error_code = response_json.get('error_code', response.status_code)
            
            # Обрабатываем разные типы ошибок
            if error_code == 403:
                error_msg = "Партнёр не разрешил боту отправлять сообщения. Попросите партнёра запустить партнёрского бота командой /start"
            elif error_code == 400:
                if 'chat not found' in error_description.lower() or 'user not found' in error_description.lower():
                    error_msg = f"Партнёр не найден. Убедитесь, что партнёр запустил партнёрского бота командой /start. Chat ID: {partner_chat_id}"
                else:
                    error_msg = f"Неверный запрос: {error_description}"
            else:
                error_msg = f"Ошибка API: {error_description} (код: {error_code})"
            
            logger.error(f"Ошибка отправки QR партнёру {partner_chat_id} от клиента {client_chat_id}: {error_msg} (ответ API: {response_json})")
            return {"success": False, "error": error_msg}
        
        response.raise_for_status()
        
        logger.info(f"QR-код успешно отправлен партнёру {partner_chat_id} от клиента {client_chat_id}")
        return {"success": True}
        
    except requests.exceptions.HTTPError as e:
        # Если raise_for_status() вызвал исключение
        error_description = 'Неизвестная ошибка'
        try:
            response_json = e.response.json()
            error_description = response_json.get('description', str(e))
        except:
            error_description = str(e)
        
        error_msg = f"HTTP ошибка {e.response.status_code}: {error_description}"
        if e.response.status_code == 403:
            error_msg = "Партнёр не разрешил боту отправлять сообщения. Попросите партнёра запустить партнёрского бота командой /start"
        elif e.response.status_code == 400:
            if 'chat not found' in error_description.lower() or 'user not found' in error_description.lower():
                error_msg = f"Партнёр не найден. Убедитесь, что партнёр запустил партнёрского бота командой /start"
            else:
                error_msg = f"Неверный chat_id партнёра: {error_description}"
        
        logger.error(f"Ошибка отправки QR партнёру {partner_chat_id}: {error_msg}")
        return {"success": False, "error": error_msg}
    except Exception as e:
        error_msg = f"Ошибка отправки QR: {str(e)}"
        logger.error(f"Ошибка отправки QR партнёру {partner_chat_id}: {error_msg}")
        return {"success": False, "error": error_msg}


@client_bot.message_handler(func=lambda message: True)
def handle_all_messages(message):
    chat_id = str(message.chat.id)
    
    # Rate limiting: 10 сообщений в минуту
    allowed, error = check_rate_limit(chat_id, 'message')
    if not allowed:
        # Не отправляем сообщение об ошибке, чтобы не создавать flood
        logger.warning(f"Rate limit exceeded for {chat_id}: general message")
        return
    
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