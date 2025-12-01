"""
Интеграция MLM Revenue Share в партнерский бот
Добавьте эти функции в bot.py (партнерский бот)
"""

from telebot import types
from partner_revenue_share import PartnerRevenueShare
from supabase_manager import SupabaseManager
from currency_utils import format_currency
import logging

logger = logging.getLogger(__name__)


def add_revenue_share_commands(bot, sm: SupabaseManager):
    """Добавляет команды Revenue Share в партнерский бот"""
    
    revenue_share = PartnerRevenueShare(sm)
    
    @bot.message_handler(commands=['revenue_share', 'rs', 'revenue'])
    def handle_revenue_share(message):
        """Команда /revenue_share - показывает статус Revenue Share"""
        chat_id = message.chat.id
        partner_chat_id = str(chat_id)
        
        try:
            # Получаем сводку Revenue Share
            summary = revenue_share.get_partner_revenue_share_summary(partner_chat_id)
            
            if 'error' in summary:
                bot.send_message(
                    chat_id,
                    f"❌ Ошибка получения данных: {summary['error']}"
                )
                return
            
            # Формируем сообщение
            status_emoji = "✅" if summary['is_active'] else "⏳"
            status_text = "АКТИВЕН" if summary['is_active'] else "НЕ АКТИВЕН"
            
            message_text = f"""
💰 **REVENUE SHARE**

{status_emoji} **Статус:** {status_text}

📊 **ТЕКУЩИЕ ПОКАЗАТЕЛИ:**
├─ Личный доход: {format_currency(summary['personal_income'])}/мес
├─ Клиентская база: {summary['client_base_count']} клиентов
├─ Revenue Share за месяц: {format_currency(summary['revenue_share_monthly'])}
├─ Общий Revenue Share: {format_currency(summary['total_revenue_share_earned'])}
└─ Лимит (30%): {format_currency(summary['limit_30_percent'])}/мес

📈 **СООТНОШЕНИЕ:**
├─ От использования: {summary['usage_percent']}%
└─ От Revenue Share: {summary['revenue_share_percent']}%

💵 **ВЫПЛАТЫ:**
├─ Ожидают: {format_currency(summary['period_pending'])}
├─ Выплачено: {format_currency(summary['period_paid'])}
└─ Всего: {format_currency(summary['period_total'])}
"""
            
            if not summary['is_active']:
                message_text += f"""

⚠️ **УСЛОВИЯ АКТИВАЦИИ:**
├─ Личный доход: {format_currency(summary['personal_income'])} / {format_currency(500)} ✅/❌
├─ Клиентская база: {summary['client_base_count']} / 20 ✅/❌
└─ Использование продукта: {'✅' if summary['personal_income'] > 0 else '❌'}

Для активации Revenue Share необходимо выполнить все условия.
"""
            
            # Кнопки
            markup = types.InlineKeyboardMarkup(row_width=2)
            btn_details = types.InlineKeyboardButton("📊 Подробная статистика", 
                                                   url=f"https://your-domain.com/partner/analytics?partner_id={partner_chat_id}")
            btn_network = types.InlineKeyboardButton("🌐 Реферальная сеть", 
                                                    callback_data="revenue_network")
            btn_pv = types.InlineKeyboardButton("💎 PV уровень", 
                                              callback_data="revenue_pv")
            btn_back = types.InlineKeyboardButton("⬅️ Назад", 
                                                 callback_data="partner_main_menu")
            
            markup.add(btn_details)
            markup.add(btn_network, btn_pv)
            markup.add(btn_back)
            
            bot.send_message(
                chat_id,
                message_text,
                reply_markup=markup,
                parse_mode='Markdown'
            )
            
        except Exception as e:
            logger.error(f"Ошибка в handle_revenue_share: {e}")
            bot.send_message(
                chat_id,
                "❌ Ошибка получения данных Revenue Share. Попробуйте позже."
            )
    
    @bot.message_handler(commands=['pv', 'partner_value'])
    def handle_pv(message):
        """Команда /pv - показывает текущий PV и уровень"""
        chat_id = message.chat.id
        partner_chat_id = str(chat_id)
        
        try:
            # Получаем PV
            pv = revenue_share.get_partner_pv(partner_chat_id)
            
            if pv is None:
                bot.send_message(
                    chat_id,
                    "❌ Партнер не найден в системе"
                )
                return
            
            # Получаем данные партнера для определения уровня
            partner_data = sm.client.table('partners').select(
                'personal_income_monthly, industry_type'
            ).eq('chat_id', partner_chat_id).single().execute()
            
            if not partner_data.data:
                bot.send_message(
                    chat_id,
                    "❌ Ошибка получения данных партнера"
                )
                return
            
            personal_income = float(partner_data.data.get('personal_income_monthly', 0))
            industry_type = partner_data.data.get('industry_type', 'Не указана')
            
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
├─ Текущий: {format_currency(personal_income)}/мес
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
            btn_revenue = types.InlineKeyboardButton("💰 Revenue Share", 
                                                    callback_data="revenue_share_info")
            btn_back = types.InlineKeyboardButton("⬅️ Назад", 
                                                 callback_data="partner_main_menu")
            markup.add(btn_revenue)
            markup.add(btn_back)
            
            bot.send_message(
                chat_id,
                message_text,
                reply_markup=markup,
                parse_mode='Markdown'
            )
            
        except Exception as e:
            logger.error(f"Ошибка в handle_pv: {e}")
            bot.send_message(
                chat_id,
                "❌ Ошибка получения данных PV. Попробуйте позже."
            )
    
    @bot.message_handler(commands=['network', 'сеть'])
    def handle_network(message):
        """Команда /network - показывает реферальную сеть"""
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
            btn_invite = types.InlineKeyboardButton("➕ Пригласить партнера", 
                                                   callback_data="invite_partner")
            btn_revenue = types.InlineKeyboardButton("💰 Revenue Share", 
                                                    callback_data="revenue_share_info")
            btn_back = types.InlineKeyboardButton("⬅️ Назад", 
                                                 callback_data="partner_main_menu")
            markup.add(btn_invite)
            markup.add(btn_revenue)
            markup.add(btn_back)
            
            bot.send_message(
                chat_id,
                message_text,
                reply_markup=markup,
                parse_mode='Markdown'
            )
            
        except Exception as e:
            logger.error(f"Ошибка в handle_network: {e}")
            bot.send_message(
                chat_id,
                "❌ Ошибка получения данных сети. Попробуйте позже."
            )
    
    @bot.callback_query_handler(func=lambda call: call.data.startswith('revenue_'))
    def handle_revenue_callbacks(call):
        """Обработка callback для Revenue Share"""
        chat_id = call.message.chat.id
        
        if call.data == 'revenue_share_info':
            handle_revenue_share(types.Message(message_id=call.message.message_id, 
                                              chat=types.Chat(id=chat_id), 
                                              from_user=types.User(id=chat_id)))
        elif call.data == 'revenue_network':
            handle_network(types.Message(message_id=call.message.message_id, 
                                        chat=types.Chat(id=chat_id), 
                                        from_user=types.User(id=chat_id)))
        elif call.data == 'revenue_pv':
            handle_pv(types.Message(message_id=call.message.message_id, 
                                  chat=types.Chat(id=chat_id), 
                                  from_user=types.User(id=chat_id)))
        
        bot.answer_callback_query(call.id)
    
    logger.info("✅ Команды Revenue Share добавлены в партнерский бот")


def update_partner_stats_on_transaction(sm: SupabaseManager, partner_chat_id: str, transaction_amount: float):
    """Обновляет статистику партнера при транзакции"""
    try:
        from partner_revenue_share import PartnerRevenueShare
        revenue_share = PartnerRevenueShare(sm)
        
        # Получаем текущие данные партнера
        partner = sm.client.table('partners').select(
            'personal_income_monthly, client_base_count'
        ).eq('chat_id', partner_chat_id).single().execute()
        
        if not partner.data:
            return
        
        # Обновляем доход (упрощенная логика - можно улучшить)
        current_income = float(partner.data.get('personal_income_monthly', 0))
        # Предполагаем, что партнер получает определенный процент от транзакции
        # Это нужно настроить в зависимости от вашей бизнес-логики
        new_income = current_income + (transaction_amount * 0.1)  # Пример: 10% от транзакции
        
        # Получаем количество клиентов
        clients = sm.client.table('transactions').select(
            'client_chat_id', distinct=True
        ).eq('partner_chat_id', partner_chat_id).execute()
        
        client_count = len(clients.data) if clients.data else 0
        
        # Обновляем данные
        revenue_share.update_partner_income_and_clients(
            partner_chat_id=partner_chat_id,
            personal_income=new_income,
            client_count=client_count
        )
        
    except Exception as e:
        logger.error(f"Ошибка обновления статистики партнера: {e}")






