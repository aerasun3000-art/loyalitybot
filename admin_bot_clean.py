import os
import asyncio
from dotenv import load_dotenv
import requests
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
import logging
import sentry_sdk

# Предполагается, что SupabaseManager находится в отдельном файле (например, supabase_manager.py)
from supabase_manager import SupabaseManager
from dashboard_urls import get_admin_dashboard_url, get_onepager_url
from partner_revenue_share import PartnerRevenueShare

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
    print("✅ Sentry инициализирован для admin_bot")

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/admin_bot.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('admin_bot')

# --- Константы и Инициализация ---
ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID") # ID администратора для доступа к админ-панели
BOT_TOKEN = os.environ.get("ADMIN_BOT_TOKEN") # Токен для Админ-бота
TOKEN_PARTNER = os.environ.get("TOKEN_PARTNER") # Токен партнерского бота (для уведомлений)

if not BOT_TOKEN or not ADMIN_CHAT_ID:
    logger.critical("Не найдены переменные окружения ADMIN_BOT_TOKEN или ADMIN_CHAT_ID")
    raise RuntimeError("Не найдены переменные окружения ADMIN_BOT_TOKEN или ADMIN_CHAT_ID.")

logger.info("Инициализация админ-бота...")

# Инициализация
storage = MemoryStorage()
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=storage)

try:
    db_manager = SupabaseManager()
    logger.info("SupabaseManager успешно инициализирован")
except Exception as e:
    logger.exception(f"Ошибка инициализации SupabaseManager: {e}")
    raise

# Инициализация MLM Revenue Share системы
try:
    revenue_share = PartnerRevenueShare(db_manager)
    logger.info("PartnerRevenueShare успешно инициализирован")
except Exception as e:
    logger.warning(f"Ошибка инициализации PartnerRevenueShare: {e}")
    revenue_share = None
# Множество для трекинга уже уведомлённых заявок партнёров
_notified_pending_partner_ids: set[str] = set()
# Множество для трекинга уже уведомлённых услуг
_notified_pending_service_ids: set[int] = set()

# --- FSM States для создания и редактирования новостей ---
class NewsCreation(StatesGroup):
    waiting_for_title = State()
    waiting_for_content = State()
    waiting_for_preview = State()
    waiting_for_image = State()

class NewsEditing(StatesGroup):
    selecting_news = State()
    selecting_field = State()
    waiting_for_new_value = State()

# Хелпер: список ID администраторов
def _get_admin_ids() -> list[int]:
    return [int(i.strip()) for i in str(ADMIN_CHAT_ID).split(',') if i.strip()]
# --- Уведомления партнерам через партнерского бота ---
def send_partner_notification(partner_chat_id: str, text: str) -> None:
    if not TOKEN_PARTNER:
        return
    try:
        url = f"https://api.telegram.org/bot{TOKEN_PARTNER}/sendMessage"
        payload = {"chat_id": str(partner_chat_id), "text": text, "parse_mode": "Markdown"}
        requests.post(url, data=payload, timeout=5)
    except Exception:
        # не падаем в админке из-за уведомления
        pass


# --- Хелперы для проверки администратора ---
def is_admin(chat_id: int) -> bool:
    """Проверяет, является ли пользователь администратором."""
    # Обрабатываем множественные ID, если они заданы через запятую
    admin_ids = [int(i.strip()) for i in str(ADMIN_CHAT_ID).split(',')]
    return chat_id in admin_ids


# --- Обработчики команд ---

@dp.message(Command("start"))
@dp.message(Command("admin"))
async def handle_start_admin(message: types.Message):
    """Начало работы и проверка доступа к админ-панели."""
    if not is_admin(message.chat.id):
        await message.answer("У вас нет прав администратора для доступа к этой панели.")
        return

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        # Outreach и быстрые действия
        # Партнёры и услуги
        [
            InlineKeyboardButton(text="🤝 Заявки Партнеров", callback_data="admin_partners"),
            InlineKeyboardButton(text="🛠 Услуги Партнёров", callback_data="admin_manage_services"),
        ],
        [
            InlineKeyboardButton(text="✨ Модерация Услуг", callback_data="admin_services"),
            InlineKeyboardButton(text="📰 Управление Новостями", callback_data="admin_news"),
        ],
        # Контент и промо
        [
            InlineKeyboardButton(text="📸 Модерация UGC", callback_data="admin_ugc"),
            InlineKeyboardButton(text="🎯 Промоутеры", callback_data="admin_promoters"),
        ],
        # Аналитика и MLM
        [
            InlineKeyboardButton(text="📊 Общая статистика", callback_data="admin_stats"),
            InlineKeyboardButton(text="🏆 Лидерборд", callback_data="admin_leaderboard"),
            InlineKeyboardButton(text="💎 MLM Revenue Share", callback_data="admin_mlm"),
        ],
        # Специальные разделы
        [
            InlineKeyboardButton(text="📈 Дашборд Админа", callback_data="admin_dashboard"),
            InlineKeyboardButton(text="📄 Одностраничники", callback_data="admin_onepagers"),
            InlineKeyboardButton(text="🎨 Смена Фона", callback_data="admin_background"),
        ],
    ])
    
    await message.answer(
        "👋 **Админ-панель**\n\nВыберите раздел для управления системой лояльности:",
        reply_markup=keyboard
    )


# --- Callback-Обработчики ---

@dp.callback_query(F.data == "admin_partners")
async def show_pending_partners(callback_query: types.CallbackQuery):
    """Показывает список заявок партнеров в статусе 'Pending'."""
    await callback_query.answer("Загрузка заявок...")
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⏳ Заявки на модерацию", callback_data="admin_partners_pending")],
        [InlineKeyboardButton(text="🗑 Удалить партнера", callback_data="admin_partners_delete")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
    ])
    
    await callback_query.message.edit_text(
        "🤝 **Управление Партнерами**\n\nВыберите действие:",
        reply_markup=keyboard
    )


@dp.callback_query(F.data == "admin_partners_pending")
async def show_pending_partners_list(callback_query: types.CallbackQuery):
    """Показывает список заявок партнеров в статусе 'Pending'."""
    await callback_query.answer("Загрузка заявок...")
    
    partners_df = db_manager.get_all_partners()
    pending_partners = partners_df[partners_df['status'].str.lower() == 'pending']
    
    if pending_partners.empty:
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_partners")]
        ])
        await callback_query.message.edit_text("✅ Новых заявок на партнерство нет.", reply_markup=keyboard)
        return

    # Отправляем сообщение для каждой заявки
    for index, partner in pending_partners.iterrows():
        partner_chat_id = partner['chat_id']
        message_text = (
            f"**Новая заявка на Партнерство (ID: {partner_chat_id})**\n"
            f"👤 Имя: {partner['name']}\n"
            f"📞 Телефон: {partner['phone']}\n"
            f"🏢 Компания: {partner['company_name']}\n"
            f"📅 Дата: {partner['created_at'][:10]}"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="🟢 Одобрить", callback_data=f"partner_approve_{partner_chat_id}"),
                InlineKeyboardButton(text="🔴 Отклонить", callback_data=f"partner_reject_{partner_chat_id}")
            ]
        ])
        
        await bot.send_message(
            chat_id=callback_query.message.chat.id, 
            text=message_text, 
            reply_markup=keyboard
        )

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_partners")]
    ])
    await callback_query.message.edit_text(
        f"⏳ Загружено {len(pending_partners)} заявок на модерацию.",
        reply_markup=keyboard
    )


@dp.callback_query(F.data == "admin_partners_delete")
async def show_partners_for_deletion(callback_query: types.CallbackQuery):
    """Показывает список всех партнеров для удаления."""
    await callback_query.answer("Загрузка партнеров...")
    
    partners_df = db_manager.get_all_partners()
    
    if partners_df.empty:
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_partners")]
        ])
        await callback_query.message.edit_text("📭 Партнеров нет.", reply_markup=keyboard)
        return
    
    # Создаем кнопки для каждого партнера
    buttons = []
    for index, partner in partners_df.head(50).iterrows():  # Ограничиваем 50 партнерами
        partner_chat_id = partner['chat_id']
        name = partner.get('name', 'Без имени')
        company = partner.get('company_name', 'Без компании')
        status = partner.get('status', 'Unknown')
        status_emoji = {'Approved': '✅', 'Pending': '⏳', 'Rejected': '❌'}.get(status, '❓')
        
        buttons.append([
            InlineKeyboardButton(
                text=f"{status_emoji} {name} ({company[:30]})",
                callback_data=f"partner_delete_select_{partner_chat_id}"
            )
        ])
    
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="admin_partners")])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=buttons)
    
    await callback_query.message.edit_text(
        "🗑 **Удаление партнера**\n\nВыберите партнера для удаления:",
        reply_markup=keyboard
    )


@dp.callback_query(F.data.startswith("partner_delete_select_"))
async def confirm_partner_deletion(callback_query: types.CallbackQuery):
    """Подтверждает удаление партнера."""
    partner_chat_id = callback_query.data.replace("partner_delete_select_", "")
    
    # Получаем информацию о партнере
    partners_df = db_manager.get_all_partners()
    partner_info = partners_df[partners_df['chat_id'] == partner_chat_id]
    
    if partner_info.empty:
        await callback_query.answer("Партнер не найден.", show_alert=True)
        return
    
    partner = partner_info.iloc[0]
    name = partner.get('name', 'Без имени')
    company = partner.get('company_name', 'Без компании')
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Да, удалить", callback_data=f"partner_delete_confirm_{partner_chat_id}"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="admin_partners_delete")
        ]
    ])
    
    await callback_query.message.edit_text(
        f"⚠️ **Подтверждение удаления**\n\n"
        f"Вы уверены, что хотите удалить партнера?\n\n"
        f"**ID:** {partner_chat_id}\n"
        f"**Имя:** {name}\n"
        f"**Компания:** {company}\n\n"
        f"⚠️ Это действие удалит:\n"
        f"• Профиль партнера\n"
        f"• Все услуги партнера\n"
        f"• Все акции партнера\n"
        f"• Заявку партнера\n\n"
        f"**Это действие нельзя отменить!**",
        reply_markup=keyboard
    )


@dp.callback_query(F.data.startswith("partner_delete_confirm_"))
async def delete_partner_confirmed(callback_query: types.CallbackQuery):
    """Удаляет партнера после подтверждения."""
    partner_chat_id = callback_query.data.replace("partner_delete_confirm_", "")
    
    success = db_manager.delete_partner(partner_chat_id)
    
    if success:
        await callback_query.answer("✅ Партнер удален")
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_partners")]
        ])
        await callback_query.message.edit_text(
            f"✅ Партнер ID {partner_chat_id} успешно удален из базы данных.\n\n"
            f"Удалены все связанные данные (услуги, акции, заявки).",
            reply_markup=keyboard
        )
        logger.info(f"Admin {callback_query.from_user.id} deleted partner {partner_chat_id}")
    else:
        await callback_query.answer("❌ Ошибка удаления", show_alert=True)
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_partners")]
        ])
        await callback_query.message.edit_text(
            f"❌ Ошибка при удалении партнера ID {partner_chat_id}. Проверьте логи.",
            reply_markup=keyboard
        )


@dp.callback_query(F.data.startswith("partner_approve_") | F.data.startswith("partner_reject_"))
async def handle_partner_approval(callback_query: types.CallbackQuery):
    """Обрабатывает одобрение или отклонение заявки партнера."""
    try:
        parts = callback_query.data.split('_')
        action = parts[1]
        partner_id = parts[2]
        
        logger.info(f"Processing partner {action} for partner_id: {partner_id} (type: {type(partner_id)})")
        
        new_status = 'Approved' if action == 'approve' else 'Rejected'
        success = db_manager.update_partner_status(partner_id, new_status)
        
        logger.info(f"Update result for partner_id {partner_id}: success={success}, new_status={new_status}")
        
        if success:
            result_text = "🟢 Одобрена" if new_status == 'Approved' else "🔴 Отклонена"
            
            # Обновляем исходное сообщение, чтобы показать, что оно обработано
            if callback_query.message.text:
                 processed_text = callback_query.message.text.split('\n')[0]
                 await callback_query.message.edit_text(f"{processed_text}\n\n**СТАТУС: {result_text}**")
            else:
                await callback_query.message.edit_text(f"Заявка ID {partner_id}: {result_text}")
            
            # Уведомление Партнера (имитация)
            # Отправляем уведомление в партнерский бот
            if new_status == 'Approved':
                send_partner_notification(partner_id, "🎉 **Поздравляем!** Ваш аккаунт партнера одобрен. Нажмите /start в партнерском боте.")
            else:
                send_partner_notification(partner_id, "❌ Ваша заявка Партнера была отклонена. Свяжитесь с администратором.")
            
        else:
            logger.error(f"Failed to update partner status for partner_id: {partner_id}")
            await callback_query.answer("Ошибка при обновлении статуса в БД. Проверьте логи.", show_alert=True)
            
    except Exception as e:
        logger.exception(f"Error in handle_partner_approval: {e}")
        await callback_query.answer("Произошла ошибка при обработке запроса.", show_alert=True)
        
    await callback_query.answer()


# --- Фоновая задача: авто-уведомление администраторов о новых заявках партнёров ---
async def _notify_admins_about_partner(partner_row) -> None:
    partner_chat_id = partner_row['chat_id']
    message_text = (
        f"**Новая заявка на Партнерство (ID: {partner_chat_id})**\n"
        f"👤 Имя: {partner_row.get('name', '—')}\n"
        f"📞 Телефон: {partner_row.get('phone', '—')}\n"
        f"🏢 Компания: {partner_row.get('company_name', '—')}\n"
        f"📅 Дата: {partner_row.get('created_at', '')[:10]}"
    )

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🟢 Одобрить", callback_data=f"partner_approve_{partner_chat_id}"),
            InlineKeyboardButton(text="🔴 Отклонить", callback_data=f"partner_reject_{partner_chat_id}")
        ]
    ])

    for admin_id in _get_admin_ids():
        try:
            await bot.send_message(chat_id=admin_id, text=message_text, reply_markup=keyboard)
        except Exception:
            pass


async def watch_new_partner_applications(poll_interval_sec: int = 30) -> None:
    """Периодически опрашивает БД и отправляет уведомления админам о новых Pending-заявках."""
    global _notified_pending_partner_ids
    while True:
        try:
            partners_df = db_manager.get_all_partners()
            if not partners_df.empty:
                pending_partners = partners_df[partners_df['status'].str.lower() == 'pending']
                for _, partner in pending_partners.iterrows():
                    pid = str(partner['chat_id'])
                    if pid not in _notified_pending_partner_ids:
                        await _notify_admins_about_partner(partner)
                        _notified_pending_partner_ids.add(pid)
        except Exception:
            # Тихо продолжаем цикл, чтобы не останавливать бота
            pass
        await asyncio.sleep(poll_interval_sec)


async def _notify_admins_about_service(service_row) -> None:
    """Отправляет уведомление всем админам о новой услуге на модерации."""
    service_id = service_row['id']
    message_text = (
        f"**🆕 Новая Услуга на Модерации (ID: {service_id})**\n"
        f"🤝 Партнер ID: {service_row.get('partner_chat_id', '—')}\n"
        f"💎 Название: {service_row.get('title', '—')}\n"
        f"💵 Стоимость: {service_row.get('price_points', 0)} баллов\n"
        f"📝 Описание: {service_row.get('description', '—')[:50]}..."
    )

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🟢 Одобрить", callback_data=f"service_approve_{service_id}"),
            InlineKeyboardButton(text="🔴 Отклонить", callback_data=f"service_reject_{service_id}")
        ]
    ])

    for admin_id in _get_admin_ids():
        try:
            await bot.send_message(chat_id=admin_id, text=message_text, reply_markup=keyboard)
            logger.info(f"Уведомление о новой услуге {service_id} отправлено админу {admin_id}")
        except Exception as e:
            logger.error(f"Ошибка отправки уведомления админу {admin_id}: {e}")


async def watch_new_service_submissions(poll_interval_sec: int = 30) -> None:
    """Периодически опрашивает БД и отправляет уведомления админам о новых услугах на модерации."""
    global _notified_pending_service_ids
    while True:
        try:
            services_df = db_manager.get_pending_services_for_admin()
            if not services_df.empty:
                for _, service in services_df.iterrows():
                    sid = int(service['id'])
                    if sid not in _notified_pending_service_ids:
                        await _notify_admins_about_service(service)
                        _notified_pending_service_ids.add(sid)
                        logger.info(f"Новая услуга {sid} добавлена в список уведомлённых")
        except Exception as e:
            # Тихо продолжаем цикл
            logger.debug(f"Ошибка в watch_new_service_submissions: {e}")
        await asyncio.sleep(poll_interval_sec)


@dp.callback_query(F.data == "admin_services")
async def show_pending_services(callback_query: types.CallbackQuery):
    """Показывает список услуг на модерации (Pending)."""
    await callback_query.answer("Загрузка услуг...")

    # Используем новый метод из SupabaseManager
    services_df = db_manager.get_pending_services_for_admin()
    
    if services_df.empty:
        await callback_query.message.edit_text("✅ Новых услуг на модерации нет.")
        return

    # Отправляем сообщение для каждой услуги
    for index, service in services_df.iterrows():
        service_id = service['id']
        message_text = (
            f"**Новая Услуга на Модерации (ID: {service_id})**\n"
            f"🤝 Партнер ID: {service['partner_chat_id']}\n"
            f"💎 Название: {service['title']}\n"
            f"💵 Стоимость (бонусы): {service['price_points']} баллов\n"
            f"📝 Описание: {service['description'][:50]}..."
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="🟢 Одобрить", callback_data=f"service_approve_{service_id}"),
                InlineKeyboardButton(text="🔴 Отклонить", callback_data=f"service_reject_{service_id}")
            ]
        ])
        
        await bot.send_message(
            chat_id=callback_query.message.chat.id, 
            text=message_text, 
            reply_markup=keyboard
        )

    await callback_query.message.edit_text(
        f"⏳ Загружено {len(services_df)} услуг на модерацию."
    )


@dp.callback_query(F.data.startswith("service_"))
async def handle_service_approval(callback_query: types.CallbackQuery):
    """Обрабатывает одобрение или отклонение услуги."""
    parts = callback_query.data.split('_')
    action = parts[1]
    service_id = parts[2]
    
    new_status = 'Approved' if action == 'approve' else 'Rejected'
    # Используем новый метод из SupabaseManager
    success = db_manager.update_service_approval_status(service_id, new_status)
    
    if success:
        result_text = "🟢 Одобрена" if new_status == 'Approved' else "🔴 Отклонена"
        
        # Обновляем исходное сообщение
        if callback_query.message.text:
             processed_text = callback_query.message.text.split('\n')[0]
             await callback_query.message.edit_text(f"{processed_text}\n\n**СТАТУС: {result_text}**")
        else:
            await callback_query.message.edit_text(f"Услуга ID {service_id}: {result_text}")
            
    else:
        await callback_query.answer("Ошибка при обновлении статуса услуги в БД.")
        
    await callback_query.answer()


# --- Управление услугами текущих партнёров ---

class ServiceManage(StatesGroup):
    selecting_partner = State()
    selecting_category = State()
    selecting_city = State()
    selecting_district = State()
    choosing_services_action = State()
    adding_title = State()
    adding_description = State()
    adding_price = State()
    adding_category = State()
    choosing_service_for_edit = State()
    choosing_field_to_edit = State()
    waiting_new_field_value = State()
    choosing_service_for_delete = State()


@dp.callback_query(F.data == "admin_manage_services")
async def open_manage_services(callback_query: types.CallbackQuery, state: FSMContext):
    if not is_admin(callback_query.message.chat.id):
        await callback_query.answer("Нет доступа", show_alert=True)
        return
    await state.set_state(ServiceManage.selecting_partner)
    await callback_query.message.edit_text(
        "🛠 Управление услугами партнёров\n\nВведите partner_chat_id партнёра:" 
    )


@dp.message(ServiceManage.selecting_partner)
async def receive_partner_id(message: types.Message, state: FSMContext):
    partner_id = message.text.strip()
    await state.update_data(partner_chat_id=partner_id)
    # Главное меню действий для выбранного партнёра
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🗂 Редактировать категорию", callback_data="svc_edit_category")],
        [InlineKeyboardButton(text="📍 Редактировать локацию", callback_data="svc_edit_location")],
        [InlineKeyboardButton(text="🧾 Управлять услугами", callback_data="svc_manage_services")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
    ])
    await message.answer(
        f"Партнёр выбран: {partner_id}. Выберите действие:",
        reply_markup=keyboard
    )


@dp.callback_query(F.data == "svc_edit_category")
async def choose_category(callback_query: types.CallbackQuery, state: FSMContext):
    cats = db_manager.get_service_categories_list()
    # Кнопки по 2 в ряд
    rows = []
    row = []
    for i, c in enumerate(cats, 1):
        row.append(InlineKeyboardButton(text=c, callback_data=f"svc_set_cat_{c}"))
        if i % 2 == 0:
            rows.append(row); row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton(text="◀️ Назад", callback_data="admin_manage_services")])
    await callback_query.message.edit_text("Выберите категорию (business_type) для партнёра:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@dp.callback_query(F.data.startswith("svc_set_cat_"))
async def set_partner_category(callback_query: types.CallbackQuery, state: FSMContext):
    category = callback_query.data.replace("svc_set_cat_", "")
    data = await state.get_data()
    partner_id = data.get('partner_chat_id')
    ok = db_manager.set_partner_business_type(partner_id, category)
    if ok:
        await callback_query.answer("✅ Категория обновлена")
    else:
        await callback_query.answer("❌ Ошибка обновления", show_alert=True)
    await open_manage_services(callback_query, state)


@dp.callback_query(F.data == "svc_edit_location")
async def choose_city(callback_query: types.CallbackQuery, state: FSMContext):
    cities = db_manager.get_distinct_cities()
    if not cities:
        await callback_query.answer("Нет доступных городов", show_alert=True)
        return
    rows = [[InlineKeyboardButton(text=city, callback_data=f"svc_city_{city}")] for city in cities[:50]]
    rows.append([InlineKeyboardButton(text="◀️ Назад", callback_data="admin_manage_services")])
    await callback_query.message.edit_text("Выберите город:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@dp.callback_query(F.data.startswith("svc_city_"))
async def choose_district(callback_query: types.CallbackQuery, state: FSMContext):
    city = callback_query.data.replace("svc_city_", "")
    await state.update_data(city=city)
    districts = db_manager.get_distinct_districts_for_city(city)
    if not districts:
        districts = ["All", "Все"]
    rows = [[InlineKeyboardButton(text=d, callback_data=f"svc_district_{d}")] for d in districts[:50]]
    rows.append([InlineKeyboardButton(text="◀️ Назад", callback_data="svc_edit_location")])
    await callback_query.message.edit_text(f"Город: {city}. Выберите район:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@dp.callback_query(F.data.startswith("svc_district_"))
async def set_partner_location(callback_query: types.CallbackQuery, state: FSMContext):
    district = callback_query.data.replace("svc_district_", "")
    data = await state.get_data()
    partner_id = data.get('partner_chat_id')
    city = data.get('city')
    ok = db_manager.set_partner_location(partner_id, city, district)
    if ok:
        await callback_query.answer("✅ Локация обновлена")
    else:
        await callback_query.answer("❌ Ошибка обновления", show_alert=True)
    await open_manage_services(callback_query, state)


@dp.callback_query(F.data == "svc_manage_services")
async def services_menu(callback_query: types.CallbackQuery, state: FSMContext):
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Добавить услугу", callback_data="svc_add")],
        [InlineKeyboardButton(text="✏️ Редактировать услугу", callback_data="svc_edit")],
        [InlineKeyboardButton(text="🗑 Удалить услугу", callback_data="svc_delete")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_manage_services")]
    ])
    await callback_query.message.edit_text("Выберите действие с услугами:", reply_markup=keyboard)


# Добавление услуги
@dp.callback_query(F.data == "svc_add")
async def svc_add_start(callback_query: types.CallbackQuery, state: FSMContext):
    await state.set_state(ServiceManage.adding_title)
    await callback_query.message.edit_text("Введите название услуги (title):")


@dp.message(ServiceManage.adding_title)
async def svc_add_title(message: types.Message, state: FSMContext):
    await state.update_data(new_title=message.text.strip())
    await state.set_state(ServiceManage.adding_description)
    await message.answer("Введите описание услуги (description):")


@dp.message(ServiceManage.adding_description)
async def svc_add_description(message: types.Message, state: FSMContext):
    await state.update_data(new_description=message.text.strip())
    await state.set_state(ServiceManage.adding_price)
    await message.answer("Введите цену в баллах (целое число):")


@dp.message(ServiceManage.adding_price)
async def svc_add_price(message: types.Message, state: FSMContext):
    try:
        price = int(message.text.strip())
    except Exception:
        await message.answer("Нужно целое число. Введите цену ещё раз:")
        return
    await state.update_data(new_price=price)
    # Выбор категории услуги
    cats = db_manager.get_service_categories_list()
    rows = [[InlineKeyboardButton(text=c, callback_data=f"svc_add_cat_{c}")] for c in cats]
    await state.set_state(ServiceManage.adding_category)
    await message.answer("Выберите категорию услуги:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@dp.callback_query(F.data.startswith("svc_add_cat_"), ServiceManage.adding_category)
async def svc_add_finish(callback_query: types.CallbackQuery, state: FSMContext):
    category = callback_query.data.replace("svc_add_cat_", "")
    data = await state.get_data()
    service_data = {
        'partner_chat_id': str(data.get('partner_chat_id')),
        'title': data.get('new_title'),
        'description': data.get('new_description'),
        'price_points': data.get('new_price'),
        'category': category,
        'approval_status': 'Approved',
        'is_active': True,
    }
    ok = db_manager.add_service(service_data)
    await state.clear()
    if ok:
        await callback_query.message.edit_text("✅ Услуга добавлена")
    else:
        await callback_query.message.edit_text("❌ Ошибка добавления услуги")


# Удаление услуги
@dp.callback_query(F.data == "svc_delete")
async def svc_delete_pick(callback_query: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    partner_id = data.get('partner_chat_id')
    services = db_manager.get_partner_services(partner_id)
    if not services:
        await callback_query.message.edit_text("Нет услуг у партнёра")
        return
    rows = []
    for s in services[:50]:
        title = s.get('title', 'Без названия')
        sid = s.get('id')
        rows.append([InlineKeyboardButton(text=f"🗑 {title} ({sid})", callback_data=f"svc_del_{sid}")])
    rows.append([InlineKeyboardButton(text="◀️ Назад", callback_data="svc_manage_services")])
    await callback_query.message.edit_text("Выберите услугу для удаления:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@dp.callback_query(F.data.startswith("svc_del_"))
async def svc_delete_confirm(callback_query: types.CallbackQuery, state: FSMContext):
    sid = callback_query.data.replace("svc_del_", "")
    data = await state.get_data()
    partner_id = data.get('partner_chat_id')
    ok = db_manager.delete_service(sid, partner_id)
    if ok:
        await callback_query.answer("✅ Удалено")
    else:
        await callback_query.answer("❌ Ошибка удаления", show_alert=True)
    await services_menu(callback_query, state)


# Редактирование услуги
@dp.callback_query(F.data == "svc_edit")
async def svc_edit_pick(callback_query: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    partner_id = data.get('partner_chat_id')
    services = db_manager.get_partner_services(partner_id)
    if not services:
        await callback_query.message.edit_text("Нет услуг у партнёра")
        return
    rows = []
    for s in services[:50]:
        title = s.get('title', 'Без названия')
        sid = s.get('id')
        rows.append([InlineKeyboardButton(text=f"✏️ {title} ({sid})", callback_data=f"svc_edit_{sid}")])
    rows.append([InlineKeyboardButton(text="◀️ Назад", callback_data="svc_manage_services")])
    await callback_query.message.edit_text("Выберите услугу для редактирования:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@dp.callback_query(F.data.startswith("svc_edit_") & (~F.data.endswith("services")))
async def svc_edit_fields(callback_query: types.CallbackQuery, state: FSMContext):
    sid = callback_query.data.replace("svc_edit_", "")
    await state.update_data(edit_service_id=sid)
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Название", callback_data="svc_field_title")],
        [InlineKeyboardButton(text="Описание", callback_data="svc_field_description")],
        [InlineKeyboardButton(text="Цена (баллы)", callback_data="svc_field_price")],
        [InlineKeyboardButton(text="Категория", callback_data="svc_field_category")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="svc_manage_services")]
    ])
    await callback_query.message.edit_text("Выберите поле для редактирования:", reply_markup=keyboard)


@dp.callback_query(F.data.startswith("svc_field_"))
async def svc_choose_field(callback_query: types.CallbackQuery, state: FSMContext):
    field = callback_query.data.replace("svc_field_", "")
    await state.update_data(edit_field=field)
    if field == 'category':
        cats = db_manager.get_service_categories_list()
        rows = [[InlineKeyboardButton(text=c, callback_data=f"svc_set_service_cat_{c}")] for c in cats]
        await callback_query.message.edit_text("Выберите категорию:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))
        return
    await state.set_state(ServiceManage.waiting_new_field_value)
    await callback_query.message.edit_text("Введите новое значение:")


@dp.callback_query(F.data.startswith("svc_set_service_cat_"))
async def svc_set_service_category(callback_query: types.CallbackQuery, state: FSMContext):
    category = callback_query.data.replace("svc_set_service_cat_", "")
    data = await state.get_data()
    sid = data.get('edit_service_id')
    partner_id = data.get('partner_chat_id')
    ok = db_manager.update_service_category(sid, partner_id, category)
    if ok:
        await callback_query.answer("✅ Обновлено")
    else:
        await callback_query.answer("❌ Ошибка", show_alert=True)
    await services_menu(callback_query, state)


@dp.message(ServiceManage.waiting_new_field_value)
async def svc_apply_field_edit(message: types.Message, state: FSMContext):
    data = await state.get_data()
    sid = data.get('edit_service_id')
    partner_id = data.get('partner_chat_id')
    field = data.get('edit_field')
    title = description = None
    price_points = None
    if field == 'title':
        title = message.text.strip()
    elif field == 'description':
        description = message.text.strip()
    elif field == 'price':
        try:
            price_points = int(message.text.strip())
        except Exception:
            await message.answer("Нужно целое число. Введите цену ещё раз:")
            return
    ok = db_manager.update_service(sid, partner_id, title=title, description=description, price_points=price_points)
    await state.clear()
    if ok:
        await message.answer("✅ Услуга обновлена")
    else:
        await message.answer("❌ Ошибка обновления услуги")


# --- Управление Новостями ---

@dp.callback_query(F.data == "admin_news")
async def show_news_management(callback_query: types.CallbackQuery):
    """Показывает меню управления новостями."""
    await callback_query.answer("Загрузка меню новостей...")
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Создать новость", callback_data="news_create")],
        [InlineKeyboardButton(text="📋 Список всех новостей", callback_data="news_list")],
        [InlineKeyboardButton(text="✏️ Редактировать новость", callback_data="news_edit")],
        [InlineKeyboardButton(text="🗑 Удалить новость", callback_data="news_delete")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
    ])
    
    await callback_query.message.edit_text(
        "📰 **Управление Новостями**\n\nВыберите действие:",
        reply_markup=keyboard
    )


@dp.callback_query(F.data == "back_to_main")
async def back_to_main_menu(callback_query: types.CallbackQuery):
    """Возврат в главное меню."""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        # Outreach и быстрые действия
        # Партнёры и услуги
        [
            InlineKeyboardButton(text="🤝 Заявки Партнеров", callback_data="admin_partners"),
            InlineKeyboardButton(text="🛠 Услуги Партнёров", callback_data="admin_manage_services"),
        ],
        [
            InlineKeyboardButton(text="✨ Модерация Услуг", callback_data="admin_services"),
            InlineKeyboardButton(text="📰 Управление Новостями", callback_data="admin_news"),
        ],
        # Контент и промо
        [
            InlineKeyboardButton(text="📸 Модерация UGC", callback_data="admin_ugc"),
            InlineKeyboardButton(text="🎯 Промоутеры", callback_data="admin_promoters"),
        ],
        # Аналитика и MLM
        [
            InlineKeyboardButton(text="📊 Общая статистика", callback_data="admin_stats"),
            InlineKeyboardButton(text="🏆 Лидерборд", callback_data="admin_leaderboard"),
            InlineKeyboardButton(text="💎 MLM Revenue Share", callback_data="admin_mlm"),
        ],
        # Специальные разделы
        [
            InlineKeyboardButton(text="📈 Дашборд Админа", callback_data="admin_dashboard"),
            InlineKeyboardButton(text="📄 Одностраничники", callback_data="admin_onepagers"),
            InlineKeyboardButton(text="🎨 Смена Фона", callback_data="admin_background"),
        ],
    ])
    
    await callback_query.message.edit_text(
        "👋 **Админ-панель**\n\nВыберите раздел для управления системой лояльности:",
        reply_markup=keyboard
    )
    await callback_query.answer()


@dp.callback_query(F.data == "news_create")
async def start_news_creation(callback_query: types.CallbackQuery, state: FSMContext):
    """Начинает процесс создания новости."""
    await callback_query.answer()
    await state.set_state(NewsCreation.waiting_for_title)
    await callback_query.message.answer(
        "📝 **Создание новости**\n\n"
        "Шаг 1/4: Введите заголовок новости:\n\n"
        "Отправьте /cancel для отмены."
    )


@dp.message(NewsCreation.waiting_for_title)
async def process_news_title(message: types.Message, state: FSMContext):
    """Обрабатывает заголовок новости."""
    if message.text == '/cancel':
        await state.clear()
        await message.answer("❌ Создание новости отменено.")
        return
    
    await state.update_data(title=message.text)
    await state.set_state(NewsCreation.waiting_for_content)
    await message.answer(
        f"✅ Заголовок сохранен: **{message.text}**\n\n"
        "Шаг 2/4: Введите полный текст новости:\n\n"
        "Отправьте /cancel для отмены."
    )


@dp.message(NewsCreation.waiting_for_content)
async def process_news_content(message: types.Message, state: FSMContext):
    """Обрабатывает содержание новости."""
    if message.text == '/cancel':
        await state.clear()
        await message.answer("❌ Создание новости отменено.")
        return
    
    await state.update_data(content=message.text)
    await state.set_state(NewsCreation.waiting_for_preview)
    
    preview = message.text[:200] + "..." if len(message.text) > 200 else message.text
    await message.answer(
        f"✅ Текст новости сохранен!\n\n"
        f"Шаг 3/4: Введите краткое описание (превью) для списка новостей.\n\n"
        f"Автоматическое превью: _{preview}_\n\n"
        f"Отправьте /skip чтобы использовать автоматическое превью, или /cancel для отмены."
    )


@dp.message(NewsCreation.waiting_for_preview)
async def process_news_preview(message: types.Message, state: FSMContext):
    """Обрабатывает превью новости."""
    print(f"[PROCESS_NEWS_PREVIEW] Handler called! text={message.text}", flush=True)
    
    if message.text == '/cancel':
        await state.clear()
        await message.answer("❌ Создание новости отменено.")
        return
    
    if message.text != '/skip':
        await state.update_data(preview_text=message.text)
    
    current_state = await state.get_state()
    print(f"[PROCESS_NEWS_PREVIEW] Current state before set_state: {current_state}", flush=True)
    await state.set_state(NewsCreation.waiting_for_image)
    new_state = await state.get_state()
    print(f"[PROCESS_NEWS_PREVIEW] New state after set_state: {new_state}", flush=True)
    await message.answer(
        "✅ Превью сохранено!\n\n"
        "Шаг 4/4: Отправьте URL изображения для новости.\n\n"
        "Отправьте /skip чтобы создать новость без изображения, или /cancel для отмены."
    )


@dp.message(NewsCreation.waiting_for_image)
async def process_news_image(message: types.Message, state: FSMContext):
    """Обрабатывает изображение новости и создает ее."""
    import sys
    sys.stdout.flush()
    print(f"[PROCESS_NEWS_IMAGE] Handler called! text={message.text}, photo={message.photo is not None}, caption={message.caption}", flush=True)
    sys.stdout.flush()
    
    if message.text and message.text == '/cancel':
        await state.clear()
        await message.answer("❌ Создание новости отменено.")
        return
    
    data = await state.get_data()
    
    # #region agent log
    try:
        import json as _json
        _payload = {
            "sessionId": "debug-session",
            "runId": "pre-fix",
            "hypothesisId": "H1-H5",
            "location": "admin_bot.py:process_news_image:entry",
            "message": "Entered process_news_image",
            "data": {
                "has_text": message.text is not None,
                "text_value": message.text[:100] if message.text else None,
                "has_photo": message.photo is not None and len(message.photo) > 0,
                "has_caption": message.caption is not None,
                "caption_value": message.caption[:100] if message.caption else None,
            },
            "timestamp": __import__("time").time(),
        }
        _log_msg = f"[DEBUG] {_json.dumps(_payload, ensure_ascii=False)}"
        logging.info(_log_msg)
        print(_log_msg, flush=True)  # Гарантированный вывод в stdout
        try:
            with open("/Users/ghbi/Downloads/loyalitybot/.cursor/debug.log", "a", encoding="utf-8") as _f:
                _f.write(_json.dumps(_payload, ensure_ascii=False) + "\n")
        except Exception:
            pass
    except Exception:
        pass
    # #endregion agent log
    
    # Обрабатываем изображение: принимаем URL из текста или подписи к фото
    if message.text and message.text != '/skip':
        data['image_url'] = message.text
    elif message.caption:
        # Если отправлено фото с подписью, используем подпись как URL
        data['image_url'] = message.caption
    elif message.photo:
        # Если отправлено фото без подписи, сообщаем об ошибке
        await message.answer(
            "❌ Для изображения новости нужен URL (ссылка на изображение).\n\n"
            "Пожалуйста, отправьте URL изображения текстом или фото с подписью (URL), или /skip для пропуска."
        )
        return
    
    # Добавляем ID автора
    data['author_chat_id'] = str(message.chat.id)

    # Пытаемся заранее сгенерировать английские переводы (мягкий режим: не падаем при ошибке)
    try:
        title = data.get('title', '')
        content = data.get('content', '')
        preview_source = data.get('preview_text') or (content[:200] if content else '')

        # #region agent log
        try:
            import json as _json
            _payload = {
                "sessionId": "debug-session",
                "runId": "pre-fix",
                "hypothesisId": "H1-H3",
                "location": "admin_bot.py:process_news_image:before_translate",
                "message": "Before AI translate in process_news_image",
                "data": {
                    "has_title": bool(title),
                    "content_len": len(content) if isinstance(content, str) else None,
                    "has_preview_text": bool(data.get("preview_text")),
                    "has_image_url": bool(data.get("image_url")),
                    "author_chat_id": str(data.get("author_chat_id", "")),
                },
                "timestamp": __import__("time").time(),
            }
            _log_msg = f"[DEBUG] {_json.dumps(_payload, ensure_ascii=False)}"
            logging.info(_log_msg)
            print(_log_msg, flush=True)  # Гарантированный вывод в stdout
            try:
                with open("/Users/ghbi/Downloads/loyalitybot/.cursor/debug.log", "a", encoding="utf-8") as _f:
                    _f.write(_json.dumps(_payload, ensure_ascii=False) + "\n")
            except Exception:
                pass
        except Exception:
            pass
        # #endregion agent log

        # Переводим поля параллельно, чтобы сократить общее время ожидания
        title_task = asyncio.create_task(translate_text_ai(title, target_lang='en', source_lang='ru')) if title else None
        preview_task = asyncio.create_task(translate_text_ai(preview_source, target_lang='en', source_lang='ru')) if preview_source else None
        content_task = asyncio.create_task(translate_text_ai(content, target_lang='en', source_lang='ru')) if content else None

        if title_task:
            data['title_en'] = await title_task
        if preview_task:
            data['preview_text_en'] = await preview_task
        if content_task:
            data['content_en'] = await content_task
    except Exception as e:
        logging.error(f"Error auto-translating news to English: {e}")
    
    # Создаем новость в БД
    # #region agent log
    try:
        import json as _json
        _payload = {
            "sessionId": "debug-session",
            "runId": "pre-fix",
            "hypothesisId": "H1-H4",
            "location": "admin_bot.py:process_news_image:before_create_news",
            "message": "Before db_manager.create_news call",
            "data": {
                "has_title": bool(data.get("title")),
                "has_content": bool(data.get("content")),
                "has_title_en": bool(data.get("title_en")),
                "has_preview_text_en": bool(data.get("preview_text_en")),
                "has_content_en": bool(data.get("content_en")),
                "image_url": data.get("image_url")[:100] if data.get("image_url") else None,
                "keys": sorted(list(data.keys())),
            },
            "timestamp": __import__("time").time(),
        }
        _log_msg = f"[DEBUG] {_json.dumps(_payload, ensure_ascii=False)}"
        logging.info(_log_msg)
        print(_log_msg, flush=True)  # Гарантированный вывод в stdout
        try:
            with open("/Users/ghbi/Downloads/loyalitybot/.cursor/debug.log", "a", encoding="utf-8") as _f:
                _f.write(_json.dumps(_payload, ensure_ascii=False) + "\n")
        except Exception:
            pass
    except Exception:
        pass
    # #endregion agent log

    try:
        success, news_id = db_manager.create_news(data)
    except Exception as e:
        _error_msg = f"Exception in create_news call: {e}"
        logging.error(_error_msg, exc_info=True)
        print(f"[ERROR] {_error_msg}", flush=True)
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}", flush=True)
        await message.answer(
            f"❌ Ошибка при создании новости: {str(e)[:200]}\n\n"
            "Проверьте логи или попробуйте снова."
        )
        await state.clear()
        return
    
    # #region agent log
    try:
        import json as _json
        _payload = {
            "sessionId": "debug-session",
            "runId": "pre-fix",
            "hypothesisId": "H1-H5",
            "location": "admin_bot.py:process_news_image:after_create_news",
            "message": "After db_manager.create_news call",
            "data": {
                "success": success,
                "news_id": news_id,
            },
            "timestamp": __import__("time").time(),
        }
        _log_msg = f"[DEBUG] {_json.dumps(_payload, ensure_ascii=False)}"
        logging.info(_log_msg)
        print(_log_msg, flush=True)  # Гарантированный вывод в stdout
        try:
            with open("/Users/ghbi/Downloads/loyalitybot/.cursor/debug.log", "a", encoding="utf-8") as _f:
                _f.write(_json.dumps(_payload, ensure_ascii=False) + "\n")
        except Exception:
            pass
    except Exception:
        pass
    # #endregion agent log
    
    if success:
        await message.answer(
            f"✅ **Новость успешно создана!**\n\n"
            f"🆔 ID новости: {news_id}\n"
            f"📰 Заголовок: {data['title']}\n\n"
            f"Новость опубликована и видна пользователям в приложении."
        )
    else:
        _error_msg = f"create_news returned success=False, news_id={news_id}"
        logging.error(_error_msg)
        print(f"[ERROR] {_error_msg}", flush=True)
        await message.answer(
            "❌ Ошибка при создании новости. Проверьте логи или попробуйте снова."
        )
    
    await state.clear()


@dp.callback_query(F.data == "news_list")
async def show_news_list(callback_query: types.CallbackQuery):
    """Показывает список всех новостей."""
    await callback_query.answer("Загрузка новостей...")
    
    news_df = db_manager.get_all_news(published_only=False)
    
    if news_df.empty:
        await callback_query.message.edit_text(
            "📭 Новостей пока нет.\n\n"
            "Используйте кнопку 'Создать новость' для добавления первой новости.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_news")]
            ])
        )
        return
    
    message_text = "📋 **Список всех новостей:**\n\n"
    
    for index, news in news_df.iterrows():
        status_icon = "✅" if news['is_published'] else "📝"
        views = news.get('views_count', 0)
        created = news['created_at'][:10] if 'created_at' in news else 'N/A'
        
        message_text += (
            f"{status_icon} **ID {news['id']}**: {news['title']}\n"
            f"   👁 Просмотров: {views} | 📅 {created}\n\n"
        )
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_news")]
    ])
    
    await callback_query.message.edit_text(message_text, reply_markup=keyboard)


@dp.callback_query(F.data == "news_edit")
async def start_news_editing(callback_query: types.CallbackQuery, state: FSMContext):
    """Начинает процесс редактирования новости."""
    await callback_query.answer()
    
    news_df = db_manager.get_all_news(published_only=False)
    
    if news_df.empty:
        await callback_query.message.answer(
            "📭 Новостей для редактирования нет."
        )
        return
    
    message_text = "✏️ **Редактирование новости**\n\nВведите ID новости для редактирования:\n\n"
    
    for index, news in news_df.iterrows():
        message_text += f"**{news['id']}**: {news['title']}\n"
    
    await state.set_state(NewsEditing.selecting_news)
    await callback_query.message.answer(message_text)


@dp.message(NewsEditing.selecting_news)
async def select_news_for_editing(message: types.Message, state: FSMContext):
    """Выбирает новость для редактирования."""
    try:
        news_id = int(message.text)
    except ValueError:
        await message.answer("❌ Неверный формат ID. Введите число.")
        return
    
    news = db_manager.get_news_by_id(news_id)
    
    if not news:
        await message.answer("❌ Новость с таким ID не найдена.")
        return
    
    await state.update_data(news_id=news_id, news=news)
    await state.set_state(NewsEditing.selecting_field)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📝 Заголовок", callback_data="edit_title")],
        [InlineKeyboardButton(text="📄 Текст", callback_data="edit_content")],
        [InlineKeyboardButton(text="📋 Превью", callback_data="edit_preview")],
        [InlineKeyboardButton(text="🖼 Изображение", callback_data="edit_image")],
        [InlineKeyboardButton(text="👁 Опубликовано", callback_data="edit_published")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel_edit")]
    ])
    
    status = "✅ Опубликована" if news['is_published'] else "📝 Черновик"
    
    await message.answer(
        f"📰 **Редактирование новости ID {news_id}**\n\n"
        f"**Заголовок:** {news['title']}\n"
        f"**Статус:** {status}\n"
        f"**Просмотров:** {news.get('views_count', 0)}\n\n"
        f"Выберите поле для редактирования:",
        reply_markup=keyboard
    )


@dp.callback_query(F.data.startswith("edit_"), NewsEditing.selecting_field)
async def process_field_selection(callback_query: types.CallbackQuery, state: FSMContext):
    """Обрабатывает выбор поля для редактирования."""
    field = callback_query.data.replace("edit_", "")
    
    if field == "published":
        data = await state.get_data()
        news_id = data['news_id']
        current_status = data['news']['is_published']
        new_status = not current_status
        
        success = db_manager.update_news(news_id, {'is_published': new_status})
        
        if success:
            status_text = "опубликована" if new_status else "снята с публикации"
            await callback_query.answer(f"✅ Новость {status_text}")
            await callback_query.message.edit_text(
                f"✅ Новость ID {news_id} успешно {status_text}!"
            )
        else:
            await callback_query.answer("❌ Ошибка обновления")
        
        await state.clear()
        return
    
    await state.update_data(editing_field=field)
    await state.set_state(NewsEditing.waiting_for_new_value)
    
    field_names = {
        'title': 'заголовок',
        'content': 'текст новости',
        'preview': 'превью',
        'image': 'URL изображения'
    }
    
    await callback_query.message.answer(
        f"✏️ Введите новое значение для поля **{field_names.get(field, field)}**:"
    )


@dp.message(NewsEditing.waiting_for_new_value)
async def save_edited_field(message: types.Message, state: FSMContext):
    """Сохраняет отредактированное поле."""
    data = await state.get_data()
    news_id = data['news_id']
    field = data['editing_field']
    new_value = message.text
    
    field_mapping = {
        'title': 'title',
        'content': 'content',
        'preview': 'preview_text',
        'image': 'image_url'
    }
    
    db_field = field_mapping.get(field)
    updates = {db_field: new_value}

    # При изменении русских полей мягко обновляем английские переводы,
    # чтобы фронтенд использовал их без повторных обращений к ИИ.
    try:
        if field == 'title':
            updates['title_en'] = await translate_text_ai(new_value, target_lang='en', source_lang='ru')
        elif field == 'content':
            updates['content_en'] = await translate_text_ai(new_value, target_lang='en', source_lang='ru')
        elif field == 'preview':
            updates['preview_text_en'] = await translate_text_ai(new_value, target_lang='en', source_lang='ru')
    except Exception as e:
        logging.error(f"Error auto-translating updated news field '{field}' to English: {e}")
    
    success = db_manager.update_news(news_id, updates)
    
    if success:
        await message.answer(
            f"✅ Новость ID {news_id} успешно обновлена!\n\n"
            f"Поле '{field}' изменено."
        )
    else:
        await message.answer("❌ Ошибка при обновлении новости.")
    
    await state.clear()


@dp.callback_query(F.data == "cancel_edit")
async def cancel_editing(callback_query: types.CallbackQuery, state: FSMContext):
    """Отменяет редактирование."""
    await state.clear()
    await callback_query.message.edit_text("❌ Редактирование отменено.")


@dp.callback_query(F.data == "news_delete")
async def start_news_deletion(callback_query: types.CallbackQuery):
    """Начинает процесс удаления новости."""
    await callback_query.answer()
    
    news_df = db_manager.get_all_news(published_only=False)
    
    if news_df.empty:
        await callback_query.message.answer("📭 Новостей для удаления нет.")
        return
    
    # Создаем кнопки для каждой новости
    buttons = []
    for index, news in news_df.iterrows():
        buttons.append([
            InlineKeyboardButton(
                text=f"🗑 {news['id']}: {news['title'][:40]}...",
                callback_data=f"delete_news_{news['id']}"
            )
        ])
    
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="admin_news")])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=buttons)
    
    await callback_query.message.edit_text(
        "🗑 **Удаление новости**\n\nВыберите новость для удаления:",
        reply_markup=keyboard
    )


@dp.callback_query(F.data.startswith("delete_news_"))
async def confirm_news_deletion(callback_query: types.CallbackQuery):
    """Подтверждает удаление новости."""
    news_id = int(callback_query.data.replace("delete_news_", ""))
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Да, удалить", callback_data=f"confirm_delete_{news_id}"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="admin_news")
        ]
    ])
    
    await callback_query.message.edit_text(
        f"⚠️ **Подтверждение удаления**\n\n"
        f"Вы уверены, что хотите удалить новость ID {news_id}?\n"
        f"Это действие нельзя отменить!",
        reply_markup=keyboard
    )


@dp.callback_query(F.data.startswith("confirm_delete_"))
async def delete_news_confirmed(callback_query: types.CallbackQuery):
    """Удаляет новость после подтверждения."""
    news_id = int(callback_query.data.replace("confirm_delete_", ""))
    
    success = db_manager.delete_news(news_id)
    
    if success:
        await callback_query.answer("✅ Новость удалена")
        await callback_query.message.edit_text(
            f"✅ Новость ID {news_id} успешно удалена из базы данных."
        )
    else:
        await callback_query.answer("❌ Ошибка удаления")
        await callback_query.message.edit_text(
            f"❌ Ошибка при удалении новости ID {news_id}. Проверьте логи."
        )


# --- Дашборд Админа ---

@dp.callback_query(F.data == "admin_dashboard")
async def show_admin_dashboard(callback_query: types.CallbackQuery):
    """Показывает ссылку на расширенный дашборд администратора."""
    await callback_query.answer("Загрузка дашборда...")
    
    try:
        dashboard_url = get_admin_dashboard_url()
        
        message_text = (
            "📈 **Дашборд Администратора**\n\n"
            "Расширенный дашборд с метриками по всей системе:\n\n"
            f"🔗 {dashboard_url}\n\n"
            "📊 **Доступные метрики:**\n\n"
            "🌐 **Общие метрики системы:**\n"
            "• Общий оборот по всем партнёрам\n"
            "• Количество активных партнёров\n"
            "• Общее количество клиентов\n"
            "• Транзакции по системе\n"
            "• Средний NPS по платформе\n\n"
            "👥 **Метрики по партнёрам:**\n"
            "• Детальная статистика каждого партнёра\n"
            "• Сравнительный анализ партнёров\n"
            "• Топ партнёров по обороту\n"
            "• Рейтинг по удержанию клиентов\n\n"
            "📈 **Аналитика:**\n"
            "• Тренды роста системы\n"
            "• Прогнозы развития\n"
            "• Когортный анализ\n"
            "• Графики и визуализация"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
        ])
        
        await callback_query.message.edit_text(message_text, reply_markup=keyboard)
        logger.info(f"Админ {callback_query.message.chat.id} открыл дашборд")
        
    except Exception as e:
        logger.error(f"Ошибка показа дашборда админу: {e}")
        await callback_query.message.edit_text(
            "❌ Ошибка при загрузке дашборда. Проверьте логи.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
            ])
        )


# --- Смена фона ---

@dp.callback_query(F.data == "admin_background")
async def show_background_menu(callback_query: types.CallbackQuery):
    """Показывает меню выбора фона."""
    await callback_query.answer("Загрузка меню...")
    
    # Получаем текущий фон
    current_bg = db_manager.get_background_image()
    
    # Доступные фоны
    backgrounds = [
        ("🌸 Сакура (по умолчанию)", "/bg/sakura.jpg"),
        ("🌺 Белый цветок", "/bg/1whiteflower.jpg"),
        ("🎨 Фон 2", "/bg/fon2_files/02e59953309fdb690b5421c190a7524f.jpg"),
        ("🎨 Фон 3", "/bg/fon3_files/e6e8a21b0775730d94fac0aeeeb0b03f.jpg"),
        ("🎨 Фон 6", "/bg/fon6_files/2c793e92fdcc7213bbd46848a72f59aa.jpg"),
    ]
    
    keyboard_buttons = []
    for name, path in backgrounds:
        is_current = "✅ " if path == current_bg else ""
        # Кодируем путь для callback_data (заменяем / на | чтобы избежать проблем)
        encoded_path = path.replace('/', '|')
        keyboard_buttons.append([InlineKeyboardButton(
            text=f"{is_current}{name}",
            callback_data=f"bg_set_{encoded_path}"
        )])
    
    keyboard_buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    
    await callback_query.message.edit_text(
        f"🎨 **Смена Фона**\n\n"
        f"Текущий фон: `{current_bg}`\n\n"
        f"Выберите новый фон для главной страницы:",
        reply_markup=keyboard
    )


@dp.callback_query(F.data.startswith("bg_set_"))
async def set_background(callback_query: types.CallbackQuery):
    """Устанавливает выбранный фон."""
    # Восстанавливаем путь из callback_data
    encoded_path = callback_query.data.replace("bg_set_", "")
    bg_path = encoded_path.replace("|", "/")
    
    success = db_manager.set_app_setting(
        'background_image',
        bg_path,
        updated_by=str(callback_query.from_user.id)
    )
    
    if success:
        await callback_query.answer(f"✅ Фон изменен на: {bg_path}", show_alert=True)
        # Возвращаемся в меню выбора фона
        await show_background_menu(callback_query)
    else:
        await callback_query.answer("❌ Ошибка при сохранении фона", show_alert=True)


# --- Одностраничники ---

@dp.callback_query(F.data == "admin_onepagers")
async def show_onepagers_menu(callback_query: types.CallbackQuery):
    """Показывает меню одностраничников для разных аудиторий."""
    await callback_query.answer("Загрузка меню...")
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🤝 Для Партнёров", callback_data="onepager_partner")],
        [InlineKeyboardButton(text="👤 Для Клиентов", callback_data="onepager_client")],
        [InlineKeyboardButton(text="💼 Для Инвесторов", callback_data="onepager_investor")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
    ])
    
    await callback_query.message.edit_text(
        "📄 **Одностраничники**\n\n"
        "Выберите аудиторию для просмотра одностраничника:\n\n"
        "🤝 **Партнёры** - презентация для бизнеса\n"
        "👤 **Клиенты** - информация для пользователей\n"
        "💼 **Инвесторы** - питч для инвесторов",
        reply_markup=keyboard
    )


@dp.callback_query(F.data.startswith("onepager_"))
async def show_onepager(callback_query: types.CallbackQuery):
    """Показывает конкретный одностраничник."""
    onepager_type = callback_query.data.replace("onepager_", "")
    
    await callback_query.answer("Загрузка...")
    
    try:
        onepager_url = get_onepager_url(onepager_type)
        
        type_names = {
            'partner': '🤝 Партнёров',
            'client': '👤 Клиентов',
            'investor': '💼 Инвесторов'
        }
        
        type_descriptions = {
            'partner': (
                "**Содержание:**\n"
                "• Преимущества программы лояльности\n"
                "• Как это работает для бизнеса\n"
                "• Статистика и кейсы\n"
                "• Условия партнёрства\n"
                "• Как начать работу"
            ),
            'client': (
                "**Содержание:**\n"
                "• Что такое программа лояльности\n"
                "• Как накапливать баллы\n"
                "• Что можно получить за баллы\n"
                "• FAQ для пользователей\n"
                "• Партнёры программы"
            ),
            'investor': (
                "**Содержание:**\n"
                "• Описание проекта и модели\n"
                "• Рыночный потенциал\n"
                "• Текущие метрики и рост\n"
                "• Финансовые показатели\n"
                "• Оценка и инвестиционное предложение"
            )
        }
        
        message_text = (
            f"📄 **Одностраничник для {type_names.get(onepager_type, 'аудитории')}**\n\n"
            f"🔗 {onepager_url}\n\n"
            f"{type_descriptions.get(onepager_type, '')}"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад к списку", callback_data="admin_onepagers")]
        ])
        
        await callback_query.message.edit_text(message_text, reply_markup=keyboard)
        logger.info(f"Админ {callback_query.message.chat.id} открыл одностраничник {onepager_type}")
        
    except Exception as e:
        logger.error(f"Ошибка показа одностраничника {onepager_type}: {e}")
        await callback_query.message.edit_text(
            "❌ Ошибка при загрузке одностраничника.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_onepagers")]
            ])
        )


# --- Множество для трекинга уже уведомлённого UGC контента ---
_notified_pending_ugc_ids: set[int] = set()

# --- ПРОМОУТЕРЫ, UGC И ЛИДЕРБОРД ---

@dp.callback_query(F.data == "admin_ugc")
async def show_pending_ugc(callback_query: types.CallbackQuery):
    """Показывает список UGC контента на модерации."""
    await callback_query.answer("Загрузка UGC контента...")
    
    try:
        # Получаем весь UGC контент на модерации
        ugc_list = db_manager.get_all_pending_ugc_content()
        
        if not ugc_list:
            await callback_query.message.edit_text("✅ UGC контента на модерации нет.")
            return
        
        # Отправляем сообщение для каждого UGC контента
        for ugc in ugc_list[:20]:  # Ограничиваем 20 элементами
            ugc_id = ugc['id']
            promoter_id = ugc['promoter_chat_id']
            content_url = ugc['content_url']
            platform = ugc['platform']
            submitted_at = ugc.get('submitted_at', '')[:10] if ugc.get('submitted_at') else 'N/A'
            
            # Получаем информацию о промоутере
            promoter_info = db_manager.get_promoter_info(promoter_id)
            promo_code = promoter_info.get('promo_code', 'N/A') if promoter_info else 'N/A'
            
            message_text = (
                f"**📸 UGC Контент на Модерации (ID: {ugc_id})**\n\n"
                f"🎯 Промоутер: {promoter_id}\n"
                f"🎁 Промо-код: `{promo_code}`\n"
                f"📱 Платформа: {platform}\n"
                f"🔗 Ссылка: {content_url}\n"
                f"📅 Дата: {submitted_at}"
            )
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [
                    InlineKeyboardButton(text="✅ Одобрить", callback_data=f"ugc_approve_{ugc_id}"),
                    InlineKeyboardButton(text="❌ Отклонить", callback_data=f"ugc_reject_{ugc_id}")
                ],
                [InlineKeyboardButton(text="📊 Статистика промоутера", callback_data=f"promoter_info_{promoter_id}")]
            ])
            
            await bot.send_message(
                chat_id=callback_query.message.chat.id,
                text=message_text,
                reply_markup=keyboard
            )
        
        await callback_query.message.edit_text(
            f"⏳ Загружено {len(ugc_list)} UGC контентов на модерацию."
        )
        
    except Exception as e:
        logger.error(f"Ошибка при загрузке UGC контента: {e}")
        await callback_query.message.edit_text("❌ Ошибка при загрузке UGC контента.")


@dp.callback_query(F.data.startswith("ugc_approve_"))
async def approve_ugc_content(callback_query: types.CallbackQuery):
    """Одобряет UGC контент."""
    try:
        ugc_id = int(callback_query.data.replace("ugc_approve_", ""))
        
        success = db_manager.approve_ugc_content(ugc_id, reward_points=100)
        
        if success:
            # Получаем информацию о контенте для уведомления
            ugc_info = db_manager.client.from_('ugc_content').select('promoter_chat_id, content_url').eq('id', ugc_id).limit(1).execute()
            if ugc_info.data:
                promoter_id = ugc_info.data[0]['promoter_chat_id']
                
                await callback_query.message.edit_text(
                    f"✅ **UGC контент одобрен!**\n\n"
                    f"ID: {ugc_id}\n"
                    f"Промоутеру начислено 100 баллов."
                )
                
                # Уведомляем промоутера (через клиентский бот)
                send_partner_notification(
                    promoter_id,
                    f"✅ Ваш UGC контент одобрен!\n\n"
                    f"📸 Ссылка: {ugc_info.data[0].get('content_url', 'N/A')}\n"
                    f"💰 Начислено: 100 баллов\n\n"
                    f"Спасибо за качественный контент!"
                )
        else:
            await callback_query.answer("❌ Ошибка при одобрении контента.", show_alert=True)
        
    except Exception as e:
        logger.error(f"Ошибка при одобрении UGC: {e}")
        await callback_query.answer("Произошла ошибка.", show_alert=True)
    
    await callback_query.answer()


@dp.callback_query(F.data.startswith("ugc_reject_"))
async def reject_ugc_content(callback_query: types.CallbackQuery):
    """Отклоняет UGC контент."""
    try:
        ugc_id = int(callback_query.data.replace("ugc_reject_", ""))
        
        # Обновляем статус контента
        db_manager.client.from_('ugc_content').update({
            'status': 'rejected',
            'moderator_notes': 'Отклонено администратором'
        }).eq('id', ugc_id).execute()
        
        # Получаем информацию о контенте для уведомления
        ugc_info = db_manager.client.from_('ugc_content').select('promoter_chat_id').eq('id', ugc_id).limit(1).execute()
        if ugc_info.data:
            promoter_id = ugc_info.data[0]['promoter_chat_id']
            
            await callback_query.message.edit_text(f"❌ **UGC контент отклонён.**\n\nID: {ugc_id}")
            
            # Уведомляем промоутера
            send_partner_notification(
                promoter_id,
                f"❌ Ваш UGC контент был отклонён.\n\n"
                f"Пожалуйста, проверьте требования к контенту и попробуйте снова."
            )
        
    except Exception as e:
        logger.error(f"Ошибка при отклонении UGC: {e}")
        await callback_query.answer("Произошла ошибка.", show_alert=True)
    
    await callback_query.answer()


@dp.callback_query(F.data == "admin_promoters")
async def show_promoters(callback_query: types.CallbackQuery):
    """Показывает список промоутеров."""
    await callback_query.answer("Загрузка промоутеров...")
    
    try:
        # Получаем статистику промоутеров
        promoters_result = db_manager.client.from_('promoters').select('*').order('total_earned_points', desc=True).limit(50).execute()
        
        if not promoters_result.data:
            await callback_query.message.edit_text("📊 Промоутеров пока нет.")
            return
        
        message_text = "🎯 **Топ промоутеров:**\n\n"
        
        for idx, promoter in enumerate(promoters_result.data[:20], start=1):
            chat_id = promoter['client_chat_id']
            level = promoter.get('promoter_level', 'novice')
            approved = promoter.get('approved_publications', 0)
            points = promoter.get('total_earned_points', 0)
            promo_code = promoter.get('promo_code', 'N/A')
            
            level_emoji = {'novice': '🌱', 'active': '⭐', 'pro': '🔥', 'master': '👑'}.get(level, '🌱')
            
            message_text += (
                f"{idx}. {level_emoji} {chat_id}\n"
                f"   Код: `{promo_code}` | Одобрено: {approved} | Баллов: {points}\n\n"
            )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
        ])
        
        await callback_query.message.edit_text(message_text, reply_markup=keyboard)
        
    except Exception as e:
        logger.error(f"Ошибка при загрузке промоутеров: {e}")
        await callback_query.message.edit_text("❌ Ошибка при загрузке данных.")


@dp.callback_query(F.data.startswith("promoter_info_"))
async def show_promoter_info(callback_query: types.CallbackQuery):
    """Показывает подробную информацию о промоутере."""
    try:
        promoter_id = callback_query.data.replace("promoter_info_", "")
        
        promoter_info = db_manager.get_promoter_info(promoter_id)
        if not promoter_info:
            await callback_query.answer("Промоутер не найден.", show_alert=True)
            return
        
        ugc_content = db_manager.get_ugc_content_for_promoter(promoter_id)
        approved = len([c for c in ugc_content if c.get('status') == 'approved'])
        pending = len([c for c in ugc_content if c.get('status') == 'pending'])
        
        level = promoter_info.get('promoter_level', 'novice')
        level_emoji = {'novice': '🌱', 'active': '⭐', 'pro': '🔥', 'master': '👑'}.get(level, '🌱')
        
        message_text = (
            f"🎯 **Информация о промоутере**\n\n"
            f"👤 ID: {promoter_id}\n"
            f"📊 Уровень: {level_emoji} {level}\n"
            f"🎁 Промо-код: `{promoter_info.get('promo_code', 'N/A')}`\n"
            f"📸 Публикаций:\n"
            f"   • Всего: {promoter_info.get('total_publications', 0)}\n"
            f"   • Одобрено: {approved}\n"
            f"   • На модерации: {pending}\n"
            f"💸 Заработано: {promoter_info.get('total_earned_points', 0)} баллов\n"
            f"🏆 Призов выиграно: {promoter_info.get('prizes_won', 0)}\n"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_ugc")]
        ])
        
        await callback_query.message.edit_text(message_text, reply_markup=keyboard)
        
    except Exception as e:
        logger.error(f"Ошибка при загрузке информации о промоутере: {e}")
        await callback_query.answer("Произошла ошибка.", show_alert=True)
    
    await callback_query.answer()


@dp.callback_query(F.data == "admin_leaderboard")
async def show_leaderboard_menu(callback_query: types.CallbackQuery):
    """Показывает меню управления лидербордом."""
    await callback_query.answer("Загрузка...")
    
    try:
        # Получаем активный период
        active_period = db_manager.get_active_leaderboard_period()
        
        message_text = "🏆 **Управление Лидербордом**\n\n"
        
        if active_period:
            top_users = db_manager.get_leaderboard_top(active_period['id'], limit=10)
            
            message_text += (
                f"📅 **Активный период:** {active_period.get('period_name', 'Текущий')}\n"
                f"📊 Статус: {active_period.get('status', 'active')}\n"
                f"📈 Участников в топе: {len(top_users)}\n\n"
                f"🥇 **ТОП-5:**\n"
            )
            
            medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
            for idx, user in enumerate(top_users[:5], start=1):
                rank_emoji = medals[idx - 1] if idx <= 5 else f"{idx}."
                name = user.get('users', {}).get('name', 'Аноним') if isinstance(user.get('users'), dict) else user.get('client_chat_id', 'N/A')
                score = float(user.get('total_score', 0))
                message_text += f"{rank_emoji} {name}: {score:.2f} баллов\n"
        else:
            message_text += "⏳ Активного периода нет.\n\nСоздайте новый период для начала конкурса."
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📊 Полный лидерборд", callback_data="leaderboard_full")],
            [InlineKeyboardButton(text="➕ Создать период", callback_data="leaderboard_create")],
            [InlineKeyboardButton(text="🎁 Распределить призы", callback_data="leaderboard_distribute_prizes")],
            [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
        ])
        
        await callback_query.message.edit_text(message_text, reply_markup=keyboard)
        
    except Exception as e:
        logger.error(f"Ошибка при загрузке лидерборда: {e}")
        await callback_query.message.edit_text("❌ Ошибка при загрузке данных.")


@dp.callback_query(F.data == "leaderboard_full")
async def show_full_leaderboard(callback_query: types.CallbackQuery):
    """Показывает полный лидерборд."""
    await callback_query.answer("Загрузка...")
    
    try:
        active_period = db_manager.get_active_leaderboard_period()
        if not active_period:
            await callback_query.answer("Нет активного периода.", show_alert=True)
            return
        
        top_users = db_manager.get_leaderboard_top(active_period['id'], limit=100)
        
        message_text = f"🏆 **Лидерборд: {active_period.get('period_name', 'Текущий период')}**\n\n"
        
        medals = ['🥇', '🥈', '🥉']
        for idx, user in enumerate(top_users[:30], start=1):  # Показываем топ-30
            if idx <= 3:
                rank_emoji = medals[idx - 1]
            else:
                rank_emoji = f"{idx}."
            
            name = user.get('users', {}).get('name', 'Аноним') if isinstance(user.get('users'), dict) else user.get('client_chat_id', 'N/A')
            score = float(user.get('total_score', 0))
            referral = float(user.get('referral_points', 0))
            ugc = float(user.get('ugc_points', 0))
            
            message_text += (
                f"{rank_emoji} **{name}**\n"
                f"   💯 Всего: {score:.2f} | 📊 Рефералы: {referral:.2f} | 📸 UGC: {ugc:.2f}\n\n"
            )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_leaderboard")]
        ])
        
        await callback_query.message.edit_text(message_text, reply_markup=keyboard)
        
    except Exception as e:
        logger.error(f"Ошибка при загрузке полного лидерборда: {e}")
        await callback_query.answer("Произошла ошибка.", show_alert=True)
    
    await callback_query.answer()


@dp.callback_query(F.data == "leaderboard_create")
async def create_leaderboard_period(callback_query: types.CallbackQuery):
    """Создаёт новый период лидерборда."""
    await callback_query.answer("Создание периода...")
    
    try:
        # Создаём месячный период для текущего месяца
        import datetime
        period_id = db_manager.create_leaderboard_period('monthly', datetime.date.today())
        
        if period_id:
            await callback_query.message.edit_text(
                f"✅ **Период лидерборда создан!**\n\n"
                f"ID: {period_id}\n"
                f"Тип: Месячный\n"
                f"Период: {datetime.date.today().strftime('%B %Y')}"
            )
        else:
            await callback_query.answer("❌ Ошибка при создании периода.", show_alert=True)
        
    except Exception as e:
        logger.error(f"Ошибка при создании периода: {e}")
        await callback_query.answer("Произошла ошибка.", show_alert=True)
    
    await callback_query.answer()


@dp.callback_query(F.data == "leaderboard_distribute_prizes")
async def distribute_prizes(callback_query: types.CallbackQuery):
    """Распределяет призы по завершении периода."""
    await callback_query.answer("Распределение призов...")
    
    try:
        active_period = db_manager.get_active_leaderboard_period()
        
        if not active_period:
            await callback_query.answer("Нет активного периода.", show_alert=True)
            return
        
        # Проверяем, завершён ли период
        if active_period.get('status') != 'completed':
            await callback_query.answer(
                "Период ещё не завершён. Завершите период перед распределением призов.",
                show_alert=True
            )
            return
        
        success = db_manager.distribute_prizes(active_period['id'])
        
        if success:
            await callback_query.message.edit_text(
                f"✅ **Призы распределены!**\n\n"
                f"Период: {active_period.get('period_name', 'N/A')}\n"
                f"Призы назначены топ-10 участникам."
            )
        else:
            await callback_query.answer("❌ Ошибка при распределении призов.", show_alert=True)
        
    except Exception as e:
        logger.error(f"Ошибка при распределении призов: {e}")
        await callback_query.answer("Произошла ошибка.", show_alert=True)
    
    await callback_query.answer()


async def _notify_admins_about_ugc(ugc_row) -> None:
    """Отправляет уведомление всем админам о новом UGC контенте."""
    ugc_id = ugc_row['id']
    promoter_id = ugc_row['promoter_chat_id']
    content_url = ugc_row['content_url']
    platform = ugc_row['platform']
    
    promoter_info = db_manager.get_promoter_info(promoter_id)
    promo_code = promoter_info.get('promo_code', 'N/A') if promoter_info else 'N/A'
    
    message_text = (
        f"**📸 Новый UGC Контент на Модерации (ID: {ugc_id})**\n"
        f"🎯 Промоутер: {promoter_id}\n"
        f"🎁 Промо-код: `{promo_code}`\n"
        f"📱 Платформа: {platform}\n"
        f"🔗 Ссылка: {content_url}"
    )
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Одобрить", callback_data=f"ugc_approve_{ugc_id}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"ugc_reject_{ugc_id}")
        ]
    ])
    
    for admin_id in _get_admin_ids():
        try:
            await bot.send_message(chat_id=admin_id, text=message_text, reply_markup=keyboard)
            logger.info(f"Уведомление о новом UGC {ugc_id} отправлено админу {admin_id}")
        except Exception as e:
            logger.error(f"Ошибка отправки уведомления админу {admin_id}: {e}")


async def watch_new_ugc_submissions(poll_interval_sec: int = 30) -> None:
    """Периодически опрашивает БД и отправляет уведомления админам о новом UGC контенте."""
    global _notified_pending_ugc_ids
    while True:
        try:
            # Получаем весь UGC контент на модерации
            ugc_list = db_manager.get_all_pending_ugc_content()
            
            for ugc in ugc_list:
                ugc_id = ugc['id']
                if ugc_id not in _notified_pending_ugc_ids:
                    await _notify_admins_about_ugc(ugc)
                    _notified_pending_ugc_ids.add(ugc_id)
                            
        except Exception as e:
            logger.error(f"Ошибка в watch_new_ugc_submissions: {e}")
        
        await asyncio.sleep(poll_interval_sec)


# --- MLM Revenue Share Управление ---

@dp.callback_query(F.data == "admin_mlm")
async def show_mlm_menu(callback_query: types.CallbackQuery):
    """Показывает меню управления MLM системой"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    await callback_query.answer("Загрузка MLM меню...")
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📊 MLM Статистика", callback_data="mlm_stats")],
        [InlineKeyboardButton(text="💎 Установить PV", callback_data="mlm_set_pv")],
        [InlineKeyboardButton(text="✅ Одобрить выплаты", callback_data="mlm_approve_payments")],
        [InlineKeyboardButton(text="🌐 Структура сети", callback_data="mlm_network")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
    ])
    
    await callback_query.message.edit_text(
        "💎 **MLM REVENUE SHARE УПРАВЛЕНИЕ**\n\n"
        "Выберите действие:",
        reply_markup=keyboard
    )


@dp.message(Command("mlm_stats"))
async def handle_mlm_stats_command(message: types.Message):
    """Команда /mlm_stats - показывает статистику MLM системы"""
    if not is_admin(message.chat.id):
        await message.answer("У вас нет прав администратора")
        return
    
    if revenue_share is None:
        await message.answer("❌ Revenue Share система временно недоступна.")
        return
    
    await show_mlm_statistics(message)


@dp.callback_query(F.data == "mlm_stats")
async def show_mlm_statistics(callback_query: types.CallbackQuery = None, message: types.Message = None):
    """Показывает статистику MLM системы"""
    target = callback_query.message if callback_query else message
    chat_id = callback_query.from_user.id if callback_query else message.chat.id
    
    try:
        # Получаем статистику
        partners = db_manager.client.table('partners').select(
            'chat_id, name, partner_type, personal_income_monthly, '
            'client_base_count, is_revenue_share_active, pv_percent, revenue_share_monthly'
        ).neq('partner_type', 'regular').execute()
        
        if not partners.data:
            text = "📊 **MLM СТАТИСТИКА**\n\nПартнеров в системе пока нет."
            await target.edit_text(text) if callback_query else await target.answer(text)
            return
        
        # Подсчитываем статистику
        total_partners = len(partners.data)
        active_revenue_share = sum(1 for p in partners.data if p.get('is_revenue_share_active'))
        total_revenue_share = sum(float(p.get('revenue_share_monthly', 0)) for p in partners.data)
        avg_pv = sum(float(p.get('pv_percent', 10)) for p in partners.data) / total_partners if total_partners > 0 else 0
        
        # Распределение по уровням PV
        pv_levels = {
            'novice': sum(1 for p in partners.data if float(p.get('pv_percent', 10)) == 3),
            'active': sum(1 for p in partners.data if float(p.get('pv_percent', 10)) == 5),
            'growing': sum(1 for p in partners.data if float(p.get('pv_percent', 10)) == 7),
            'premium': sum(1 for p in partners.data if float(p.get('pv_percent', 10)) == 10)
        }
        
        # Получаем размер сети
        network = db_manager.client.table('partner_network').select('id').execute()
        network_size = len(network.data) if network.data else 0
        
        text = f"""
📊 **MLM СТАТИСТИКА**

👥 **ПАРТНЕРЫ:**
├─ Всего партнеров: {total_partners}
├─ Активных Revenue Share: {active_revenue_share}
├─ Размер сети: {network_size} связей
└─ Средний PV: {avg_pv:.1f}%

💰 **REVENUE SHARE:**
├─ Общая сумма выплат: ${total_revenue_share:,.2f}/мес
└─ Средняя выплата: ${total_revenue_share/active_revenue_share:,.2f}/мес (если активных > 0)

📈 **РАСПРЕДЕЛЕНИЕ ПО УРОВНЯМ PV:**
├─ Новичок (3%): {pv_levels['novice']}
├─ Активный (5%): {pv_levels['active']}
├─ Растущий (7%): {pv_levels['growing']}
└─ Премиум (10%): {pv_levels['premium']}
"""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_mlm")]
        ])
        
        if callback_query:
            await callback_query.message.edit_text(text, reply_markup=keyboard)
            await callback_query.answer()
        else:
            await target.answer(text, reply_markup=keyboard)
            
    except Exception as e:
        logger.error(f"Ошибка получения MLM статистики: {e}")
        error_text = "❌ Ошибка получения статистики MLM системы"
        if callback_query:
            await callback_query.message.edit_text(error_text)
            await callback_query.answer(error_text)
        else:
            await target.answer(error_text)


@dp.message(Command("set_pv"))
async def handle_set_pv_command(message: types.Message):
    """Команда /set_pv <partner_id> <pv_percent> - устанавливает PV для партнера"""
    if not is_admin(message.chat.id):
        await message.answer("У вас нет прав администратора")
        return
    
    if revenue_share is None:
        await message.answer("❌ Revenue Share система временно недоступна.")
        return
    
    try:
        parts = message.text.split()
        if len(parts) < 3:
            await message.answer(
                "❌ Неверный формат команды.\n\n"
                "Использование: `/set_pv <partner_chat_id> <pv_percent>`\n"
                "Пример: `/set_pv 123456789 8.5`",
                parse_mode="Markdown"
            )
            return
        
        partner_chat_id = parts[1]
        pv_percent = float(parts[2])
        
        if not (0 <= pv_percent <= 100):
            await message.answer("❌ PV должен быть от 0 до 100%")
            return
        
        # Устанавливаем PV
        success = revenue_share.set_partner_pv(
            partner_chat_id=partner_chat_id,
            pv_percent=pv_percent
        )
        
        if success:
            await message.answer(
                f"✅ PV установлен для партнера `{partner_chat_id}`: {pv_percent}%",
                parse_mode="Markdown"
            )
        else:
            await message.answer("❌ Ошибка установки PV")
            
    except ValueError:
        await message.answer("❌ Неверный формат PV. Используйте число (например: 8.5)")
    except Exception as e:
        logger.error(f"Ошибка установки PV: {e}")
        await message.answer(f"❌ Ошибка: {e}")


@dp.callback_query(F.data == "mlm_set_pv")
async def show_set_pv_menu(callback_query: types.CallbackQuery):
    """Показывает меню установки PV"""
    await callback_query.answer("Используйте команду /set_pv <partner_id> <pv>")
    await callback_query.message.edit_text(
        "💎 **УСТАНОВКА PV**\n\n"
        "Используйте команду:\n"
        "`/set_pv <partner_chat_id> <pv_percent>`\n\n"
        "Пример:\n"
        "`/set_pv 123456789 8.5`\n\n"
        "Для установки PV для всей отрасли используйте:\n"
        "`/set_pv_industry <industry_type> <pv_percent>`",
        parse_mode="Markdown"
    )


@dp.callback_query(F.data == "mlm_approve_payments")
async def approve_revenue_share_payments(callback_query: types.CallbackQuery):
    """Одобряет все pending выплаты Revenue Share"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    await callback_query.answer("Одобрение выплат...")
    
    try:
        from datetime import date, timedelta
        
        # Получаем pending выплаты за текущий месяц
        today = date.today()
        period_start = today.replace(day=1)
        period_end = today
        
        payments = db_manager.client.table('partner_revenue_share').select(
            'id, partner_chat_id, final_amount'
        ).eq('status', 'pending').gte(
            'period_start', period_start.isoformat()
        ).lte('period_end', period_end.isoformat()).execute()
        
        if not payments.data:
            await callback_query.message.edit_text(
                "✅ Нет pending выплат для одобрения за текущий месяц."
            )
            return
        
        approved_count = 0
        total_amount = 0.0
        
        for payment in payments.data:
            try:
                db_manager.client.table('partner_revenue_share').update({
                    'status': 'approved'
                }).eq('id', payment['id']).execute()
                
                approved_count += 1
                total_amount += float(payment.get('final_amount', 0))
            except Exception as e:
                logger.error(f"Ошибка одобрения выплаты {payment['id']}: {e}")
        
        text = f"""
✅ **ВЫПЛАТЫ ОДОБРЕНЫ**

📊 **РЕЗУЛЬТАТЫ:**
├─ Одобрено выплат: {approved_count}
└─ Общая сумма: ${total_amount:,.2f}

💡 Выплаты переведены в статус 'approved'.
Для фактической выплаты нужно обновить статус на 'paid'.
"""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_mlm")]
        ])
        
        await callback_query.message.edit_text(text, reply_markup=keyboard)
        
    except Exception as e:
        logger.error(f"Ошибка одобрения выплат: {e}")
        await callback_query.message.edit_text(f"❌ Ошибка: {e}")


@dp.callback_query(F.data == "mlm_network")
async def show_mlm_network(callback_query: types.CallbackQuery):
    """Показывает структуру MLM сети"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    await callback_query.answer("Загрузка структуры сети...")
    
    try:
        # Получаем статистику сети
        network = db_manager.client.table('partner_network').select(
            'referrer_chat_id, referred_chat_id, level'
        ).execute()
        
        if not network.data:
            await callback_query.message.edit_text(
                "🌐 **РЕФЕРАЛЬНАЯ СЕТЬ**\n\n"
                "В системе пока нет связей между партнерами."
            )
            return
        
        # Группируем по уровням
        level_1 = [n for n in network.data if n.get('level') == 1]
        level_2 = [n for n in network.data if n.get('level') == 2]
        level_3 = [n for n in network.data if n.get('level') == 3]
        
        # Подсчитываем уникальных партнеров
        unique_referrers = len(set(n.get('referrer_chat_id') for n in network.data))
        unique_referred = len(set(n.get('referred_chat_id') for n in network.data))
        
        text = f"""
🌐 **РЕФЕРАЛЬНАЯ СЕТЬ**

📊 **СТАТИСТИКА:**
├─ Уровень 1: {len(level_1)} связей
├─ Уровень 2: {len(level_2)} связей
├─ Уровень 3: {len(level_3)} связей
├─ Всего связей: {len(network.data)}
├─ Уникальных рефереров: {unique_referrers}
└─ Уникальных приглашенных: {unique_referred}

💡 Используйте команду `/mlm_partner <partner_id>` для просмотра сети конкретного партнера.
"""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="admin_mlm")]
        ])
        
        await callback_query.message.edit_text(text, reply_markup=keyboard)
        
    except Exception as e:
        logger.error(f"Ошибка получения структуры сети: {e}")
        await callback_query.message.edit_text(f"❌ Ошибка: {e}")


@dp.message(Command("mlm_partner"))
async def handle_mlm_partner_command(message: types.Message):
    """Команда /mlm_partner <partner_id> - показывает сеть конкретного партнера"""
    if not is_admin(message.chat.id):
        await message.answer("У вас нет прав администратора")
        return
    
    try:
        parts = message.text.split()
        if len(parts) < 2:
            await message.answer(
                "❌ Неверный формат команды.\n\n"
                "Использование: `/mlm_partner <partner_chat_id>`\n"
                "Пример: `/mlm_partner 123456789`",
                parse_mode="Markdown"
            )
            return
        
        partner_chat_id = parts[1]
        
        # Получаем сеть партнера
        network = db_manager.client.table('partner_network').select(
            'referred_chat_id, level, is_active'
        ).eq('referrer_chat_id', partner_chat_id).execute()
        
        if not network.data:
            await message.answer(
                f"🌐 **СЕТЬ ПАРТНЕРА {partner_chat_id}**\n\n"
                "У этого партнера пока нет партнеров в сети."
            )
            return
        
        # Группируем по уровням
        level_1 = [n for n in network.data if n.get('level') == 1]
        level_2 = [n for n in network.data if n.get('level') == 2]
        level_3 = [n for n in network.data if n.get('level') == 3]
        
        text = f"""
🌐 **СЕТЬ ПАРТНЕРА {partner_chat_id}**

📊 **СТАТИСТИКА:**
├─ Уровень 1: {len(level_1)} партнеров
├─ Уровень 2: {len(level_2)} партнеров
├─ Уровень 3: {len(level_3)} партнеров
└─ Всего: {len(network.data)} партнеров
"""
        
        await message.answer(text, parse_mode="Markdown")
        
    except Exception as e:
        logger.error(f"Ошибка получения сети партнера: {e}")
        await message.answer(f"❌ Ошибка: {e}")


# --- Instagram Outreach Handlers ---

# Инициализация Instagram Outreach Manager
try:
        db_manager,
        default_link=get_onepager_url('partner') if hasattr(get_onepager_url, '__call__') else None
    )
except Exception as e:
    logger.warning(f"Ошибка инициализации InstagramOutreachManager: {e}")

# FSM States для outreach
class OutreachAdd(StatesGroup):
    waiting_for_instagram = State()
    waiting_for_name = State()
    waiting_for_district = State()
    waiting_for_business_type = State()

class OutreachUpdate(StatesGroup):
    waiting_for_instagram = State()
    waiting_for_status = State()

class CallScheduling(StatesGroup):
    waiting_for_time = State()
    waiting_for_duration = State()
    waiting_for_meeting_link = State()


class TemplateEditing(StatesGroup):
    """FSM для редактирования текстов шаблонов ответов."""
    waiting_for_new_text = State()

@dp.callback_query(F.data == "admin_outreach")
async def show_outreach_menu(callback_query: types.CallbackQuery):
    """Главное меню Instagram Outreach"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    if not outreach_manager:
        await callback_query.answer("Instagram Outreach Manager не инициализирован", show_alert=True)
        return
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
    ])
    
    await callback_query.message.edit_text(
        "📱 **Instagram Outreach**\n\nУправление процессом поиска партнеров через Instagram:",
        reply_markup=keyboard
    )
    await callback_query.answer()

@dp.callback_query(F.data == "outreach_add")
async def start_add_outreach_contact(callback_query: types.CallbackQuery, state: FSMContext):
    """Начало процесса добавления нового контакта"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    await state.set_state(OutreachAdd.waiting_for_instagram)
    await callback_query.message.edit_text(
        "➕ **Добавить новый контакт в Outreach**\n\n"
        "Введите Instagram handle (без @):\n"
        "Например: `nailart_brooklyn`"
    )
    await callback_query.answer()

@dp.message(OutreachAdd.waiting_for_instagram)
async def process_outreach_instagram(message: types.Message, state: FSMContext):
    """Обработка Instagram handle"""
    instagram_handle = message.text.strip().lstrip('@')
    
    if not instagram_handle:
        await message.answer("Пожалуйста, введите корректный Instagram handle")
        return
    
    await state.update_data(instagram_handle=instagram_handle)
    await state.set_state(OutreachAdd.waiting_for_name)
    await message.answer(
        f"Instagram handle: `{instagram_handle}`\n\n"
        "Введите имя партнера (или нажмите /skip для пропуска):"
    )

# Списки для выбора
DISTRICTS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']

BUSINESS_TYPE_EMOJIS = {
    'nail_care': '💅',
    'brow_design': '👁️',
    'hair_salon': '💇‍♀️',
    'hair_removal': '⚡',
    'facial_aesthetics': '✨',
    'lash_services': '👀',
    'massage_therapy': '💆‍♀️',
    'makeup_pmu': '💄',
    'body_wellness': '🌸',
    'nutrition_coaching': '🍎',
    'mindfulness_coaching': '🧠',
    'image_consulting': '👗'
}

BUSINESS_TYPE_NAMES = {
    'nail_care': 'Ногтевой сервис',
    'brow_design': 'Коррекция бровей',
    'hair_salon': 'Парикмахерские услуги',
    'hair_removal': 'Депиляция',
    'facial_aesthetics': 'Косметология',
    'lash_services': 'Наращивание ресниц',
    'massage_therapy': 'Массаж',
    'makeup_pmu': 'Визаж и перманент',
    'body_wellness': 'Телесная терапия',
    'nutrition_coaching': 'Нутрициология',
    'mindfulness_coaching': 'Ментальное здоровье',
    'image_consulting': 'Стиль'
}

@dp.message(Command("skip"), OutreachAdd.waiting_for_name)
async def skip_outreach_name(message: types.Message, state: FSMContext):
    """Пропустить ввод имени"""
    await state.update_data(name=None)
    await state.set_state(OutreachAdd.waiting_for_district)
    
    # Создаем кнопки для выбора района
    keyboard_rows = []
    for district in DISTRICTS:
        keyboard_rows.append([InlineKeyboardButton(
            text=f"📍 {district}",
            callback_data=f"outreach_select_district_{district}"
        )])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_rows)
    
    await message.answer(
        "Имя пропущено.\n\n"
        "📍 Выберите район:",
        reply_markup=keyboard
    )

@dp.message(OutreachAdd.waiting_for_name)
async def process_outreach_name(message: types.Message, state: FSMContext):
    """Обработка имени"""
    await state.update_data(name=message.text.strip())
    await state.set_state(OutreachAdd.waiting_for_district)
    
    # Создаем кнопки для выбора района
    keyboard_rows = []
    for district in DISTRICTS:
        keyboard_rows.append([InlineKeyboardButton(
            text=f"📍 {district}",
            callback_data=f"outreach_select_district_{district}"
        )])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_rows)
    
    await message.answer(
        f"Имя: {message.text.strip()}\n\n"
        "📍 Выберите район:",
        reply_markup=keyboard
    )

@dp.callback_query(F.data.startswith("outreach_select_district_"))
async def process_outreach_district_selection(callback_query: types.CallbackQuery, state: FSMContext):
    """Обработка выбора района через кнопку"""
    district = callback_query.data.replace("outreach_select_district_", "")
    await state.update_data(district=district)
    await state.set_state(OutreachAdd.waiting_for_business_type)
    
    # Получаем список категорий услуг
    business_types = db_manager.get_service_categories_list() if db_manager else []
    
    # Создаем кнопки для выбора вида услуг
    keyboard_rows = []
    for business_type in business_types:
        emoji = BUSINESS_TYPE_EMOJIS.get(business_type, '💼')
        name = BUSINESS_TYPE_NAMES.get(business_type, business_type)
        keyboard_rows.append([InlineKeyboardButton(
            text=f"{emoji} {name}",
            callback_data=f"outreach_select_business_type_{business_type}"
        )])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_rows)
    
    await callback_query.message.edit_text(
        f"📍 Район: {district}\n\n"
        "💼 Выберите вид услуг:",
        reply_markup=keyboard
    )
    await callback_query.answer()

@dp.callback_query(F.data.startswith("outreach_select_business_type_"))
async def process_outreach_business_type_selection(callback_query: types.CallbackQuery, state: FSMContext):
    """Обработка выбора вида услуг и сохранение контакта"""
    business_type = callback_query.data.replace("outreach_select_business_type_", "")
    data = await state.get_data()
    
    try:
        contact = outreach_manager.add_to_outreach(
            instagram_handle=data['instagram_handle'],
            name=data.get('name'),
            district=data.get('district'),
            business_type=business_type,
            created_by=str(callback_query.from_user.id)
        )
        
        business_type_name = BUSINESS_TYPE_NAMES.get(business_type, business_type)
        
        await callback_query.message.edit_text(
            f"✅ **Контакт добавлен!**\n\n"
            f"📱 Instagram: `{contact['instagram_handle']}`\n"
            f"👤 Имя: {contact.get('name', 'не указано')}\n"
            f"📍 Район: {contact.get('district', 'не указано')}\n"
            f"💼 Тип бизнеса: {business_type_name}\n"
            f"📊 Статус: {contact.get('outreach_status', 'NOT_CONTACTED')}\n\n"
            f"Используйте /outreach_message {contact['instagram_handle']} для генерации сообщения"
        )
        
        await state.clear()
        await callback_query.answer("Контакт успешно добавлен!")
        
    except ValueError as e:
        await callback_query.message.edit_text(f"❌ Ошибка: {str(e)}")
        await callback_query.answer("Ошибка при добавлении контакта", show_alert=True)
    except Exception as e:
        logger.exception(f"Error adding outreach contact: {e}")
        await callback_query.message.edit_text(f"❌ Произошла ошибка при добавлении контакта: {str(e)}")
        await callback_query.answer("Ошибка при добавлении контакта", show_alert=True)

@dp.callback_query(F.data == "outreach_queue")
async def show_outreach_queue(callback_query: types.CallbackQuery):
    """Показывает очередь контактов для outreach"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    if not outreach_manager:
        await callback_query.answer("Instagram Outreach Manager не инициализирован", show_alert=True)
        return
    
    queue = outreach_manager.get_queue(limit=10)
    
    if not queue:
        await callback_query.message.edit_text(
            "📋 **Очередь контактов**\n\n"
            "Очередь пуста. Все контакты обработаны или нет новых контактов для outreach."
        )
        await callback_query.answer()
        return
    
    text = "📋 **Очередь контактов для Outreach**\n\n"
    
    keyboard_rows = []
    for i, contact in enumerate(queue[:10], 1):
        priority_emoji = {
            'URGENT': '🔴',
            'HIGH': '🟠',
            'MEDIUM': '🟡',
            'LOW': '🟢'
        }.get(contact.get('priority', 'MEDIUM'), '⚪')
        
        handle = contact['instagram_handle']
        text += f"{i}. {priority_emoji} `{handle}`"
        if contact.get('name'):
            text += f" - {contact['name']}"
        if contact.get('district'):
            text += f" ({contact['district']})"
        text += "\n"
        
        # Добавляем кнопку для просмотра контакта
        keyboard_rows.append([InlineKeyboardButton(
            text=f"👁️ {handle}",
            callback_data=f"show_contact_{handle}"
        )])
    
    text += "\nНажмите на контакт для просмотра деталей и быстрых действий"
    
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_rows)
    
    await callback_query.message.edit_text(text, reply_markup=keyboard)
    await callback_query.answer()

@dp.message(Command("outreach_message"))
async def generate_outreach_message(message: types.Message):
    """Генерирует персональное сообщение для контакта"""
    if not is_admin(message.from_user.id):
        await message.answer("У вас нет прав администратора")
        return
    
    if not outreach_manager:
        await message.answer("Instagram Outreach Manager не инициализирован")
        return
    
    args = message.text.split()[1:] if len(message.text.split()) > 1 else []
    
    if not args:
        await message.answer(
            "Использование: /outreach_message @instagram_handle [template_name]\n\n"
            "Доступные шаблоны:\n"
            "- first_contact_short (по умолчанию)\n"
            "- first_contact_detailed\n"
            "- follow_up_1\n"
            "- follow_up_2"
        )
        return
    
    instagram_handle = args[0].lstrip('@')
    template_name = args[1] if len(args) > 1 else 'first_contact_short'
    
    try:
        logger.info(f"Generating message for {instagram_handle} with template {template_name}")
        preview = outreach_manager.generate_message(instagram_handle, template_name)
        
        if not preview:
            await message.answer(f"❌ Не удалось сгенерировать сообщение для `{instagram_handle}`")
            return
        
        if 'error' in preview:
            await message.answer(f"❌ {preview['error']}")
            return
        
        text = f"📝 **Сообщение для `{instagram_handle}`**\n\n"
        text += f"Шаблон: {preview['template_display_name']}\n"
        text += f"Длина: {preview['character_count']} символов, {preview['word_count']} слов\n\n"
        text += "```\n"
        text += preview['message']
        text += "\n```"
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
        ])
        
        await message.answer(text, reply_markup=keyboard, parse_mode='Markdown')
        
    except ValueError as e:
        error_msg = str(e)
        logger.warning(f"ValueError generating message: {error_msg}")
        await message.answer(f"❌ {error_msg}")
    except Exception as e:
        error_msg = str(e)
        logger.exception(f"Error generating message: {error_msg}")
        await message.answer(f"❌ Произошла ошибка при генерации сообщения:\n`{error_msg}`\n\nУбедитесь, что:\n1. Контакт добавлен в систему\n2. Таблица instagram_outreach создана в Supabase", parse_mode='Markdown')

@dp.callback_query(F.data.startswith("outreach_mark_sent_"))
async def mark_outreach_sent(callback_query: types.CallbackQuery):
    """Отмечает контакт как отправленный"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    instagram_handle = callback_query.data.replace("outreach_mark_sent_", "")
    
    if not outreach_manager:
        await callback_query.answer("Instagram Outreach Manager не инициализирован", show_alert=True)
        return
    
    success = outreach_manager.update_status(instagram_handle, outreach_manager.STATUS_SENT)
    
    if success:
        await callback_query.answer("✅ Статус обновлен: SENT")
        await callback_query.message.edit_text(
            callback_query.message.text + "\n\n✅ **Статус обновлен: SENT**"
        )
    else:
        await callback_query.answer("❌ Ошибка обновления статуса", show_alert=True)

@dp.callback_query(F.data == "outreach_stats")
async def show_outreach_stats(callback_query: types.CallbackQuery):
    """Показывает статистику outreach"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    if not outreach_manager:
        await callback_query.answer("Instagram Outreach Manager не инициализирован", show_alert=True)
        return
    
    stats = outreach_manager.get_stats()
    
    if not stats:
        await callback_query.message.edit_text("❌ Не удалось получить статистику")
        await callback_query.answer()
        return
    
    text = "📊 **Статистика Instagram Outreach**\n\n"
    text += f"Всего контактов: {stats.get('total', 0)}\n"
    text += f"Всего сообщений отправлено: {stats.get('total_messages_sent', 0)}\n"
    text += f"Среднее сообщений на контакт: {stats.get('avg_messages_sent', 0)}\n"
    text += f"Среднее время ответа: {stats.get('avg_response_time_hours', 0)} часов\n\n"
    text += "**По статусам:**\n"
    
    status_names = {
        'NOT_CONTACTED': 'Не обработаны',
        'QUEUED': 'В очереди',
        'SENT': 'Отправлено',
        'REPLIED': 'Ответили',
        'INTERESTED': 'Заинтересованы',
        'CALL_SCHEDULED': 'Созвон запланирован',
        'CLOSED': 'Закрыто'
    }
    
    by_status = stats.get('by_status', {})
    for status, count in sorted(by_status.items()):
        status_display = status_names.get(status, status)
        text += f"• {status_display}: {count}\n"
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
    ])
    
    await callback_query.message.edit_text(text, reply_markup=keyboard)
    await callback_query.answer()

@dp.callback_query(F.data == "outreach_ab_results")
async def show_ab_test_results(callback_query: types.CallbackQuery):
    """Показывает результаты A/B тестирования"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    if not outreach_manager:
        await callback_query.answer("Instagram Outreach Manager не инициализирован", show_alert=True)
        return
    
    try:
        from ab_test_manager import ABTestManager
        
        ab_manager = ABTestManager(db_manager)
        results = ab_manager.get_ab_test_results('first_contact', min_samples=5)
        
        if not results or not results.get('variants'):
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
            ])
            
            await callback_query.message.edit_text(
                "🧪 **A/B Тестирование**\n\n"
                "Пока недостаточно данных для анализа.\n"
                f"Всего отправлено: {results.get('total_samples', 0)} сообщений\n\n"
                "Для статистически значимых результатов нужно:\n"
                "• Минимум 5 сообщений каждого варианта\n"
                "• Рекомендуется 20+ сообщений каждого варианта",
                reply_markup=keyboard
            )
            await callback_query.answer()
            return
        
        text = "🧪 **Результаты A/B Тестирования**\n\n"
        text += f"Группа шаблонов: `first_contact`\n"
        text += f"Всего сообщений: {results.get('total_samples', 0)}\n\n"
        text += "─" * 30 + "\n\n"
        
        variants = results['variants']
        for variant in sorted(variants.keys()):
            stats = variants[variant]
            
            # Определяем эмодзи для варианта
            variant_emoji = '📌' if variant == results.get('winner') else '📝'
            
            text += f"{variant_emoji} **Вариант {variant}**\n"
            text += f"Отправлено: {stats['sent']}\n"
            text += f"Открыто: {stats.get('opened', 0)} ({stats.get('open_rate', 0):.1f}%)\n"
            text += f"Ответов: {stats.get('replied', 0)} ({stats.get('reply_rate', 0):.1f}%)\n"
            text += f"Заинтересовались: {stats.get('interested', 0)} ({stats.get('interest_rate', 0):.1f}%)\n"
            text += f"Закрыто сделок: {stats.get('closed', 0)} ({stats.get('conversion_rate', 0):.1f}%)\n"
            
            if stats.get('avg_response_time'):
                text += f"Среднее время ответа: {stats['avg_response_time']:.1f} ч\n"
            
            text += "\n"
        
        if results.get('winner'):
            text += "─" * 30 + "\n"
            text += f"🏆 **Победитель: Вариант {results['winner']}**\n"
            text += f"Конверсия: {results.get('winner_conversion_rate', 0):.1f}%\n\n"
            text += "💡 Рекомендуется использовать этот вариант для новых контактов."
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
        ])
        
        await callback_query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')
        await callback_query.answer()
        
    except Exception as e:
        logger.exception(f"Error showing AB test results: {e}")
        await callback_query.message.edit_text(
            f"❌ Ошибка при получении результатов A/B тестирования:\n`{str(e)}`",
            parse_mode='Markdown'
        )
        await callback_query.answer()

# --- Quick Actions & Response Templates ---

@dp.callback_query(F.data == "outreach_search")
async def search_outreach_contact(callback_query: types.CallbackQuery, state: FSMContext):
    """Поиск контакта по Instagram handle"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    await state.set_state(OutreachUpdate.waiting_for_instagram)
    await callback_query.message.edit_text(
        "🔍 **Поиск контакта**\n\n"
        "Введите Instagram handle (без @):\n"
        "Например: `nailart_brooklyn`"
    )
    await callback_query.answer()

@dp.message(OutreachUpdate.waiting_for_instagram)
async def show_contact_details(message: types.Message, state: FSMContext):
    """Показывает детали контакта с быстрыми действиями"""
    if not is_admin(message.from_user.id):
        await message.answer("У вас нет прав администратора")
        return
    
    instagram_handle = message.text.strip().lstrip('@')
    
    if not outreach_manager:
        await message.answer("Instagram Outreach Manager не инициализирован")
        await state.clear()
        return
    
    contact = outreach_manager.get_by_instagram_handle(instagram_handle)
    
    if not contact:
        await message.answer(
            f"❌ Контакт `{instagram_handle}` не найден.\n\n"
            "Попробуйте еще раз или добавьте контакт через меню.",
            parse_mode='Markdown'
        )
        await state.clear()
        return
    
    # Формируем информацию о контакте
    status_names = {
        'NOT_CONTACTED': 'Не обработаны',
        'QUEUED': 'В очереди',
        'SENT': 'Отправлено',
        'REPLIED': 'Ответили',
        'INTERESTED': 'Заинтересованы',
        'CALL_SCHEDULED': 'Созвон запланирован',
        'FOLLOW_UP_1': 'Follow-up 1',
        'FOLLOW_UP_2': 'Follow-up 2',
        'NOT_INTERESTED': 'Не заинтересованы',
        'GHOSTED': 'Исчезли',
        'CLOSED': 'Закрыто'
    }
    
    text = f"👤 **Контакт: @{contact['instagram_handle']}**\n\n"
    text += f"📛 Имя: {contact.get('name', 'не указано')}\n"
    text += f"📍 Район: {contact.get('district', 'не указано')}\n"
    text += f"💼 Тип бизнеса: {contact.get('business_type', 'не указано')}\n"
    text += f"📊 Статус: {status_names.get(contact.get('outreach_status'), contact.get('outreach_status', 'UNKNOWN'))}\n"
    text += f"⭐ Приоритет: {contact.get('priority', 'MEDIUM')}\n"
    
    if contact.get('first_contact_date'):
        text += f"📅 Первый контакт: {contact['first_contact_date'][:10]}\n"
    if contact.get('call_scheduled_date'):
        text += f"📞 Созвон: {contact['call_scheduled_date'][:10]}\n"
    if contact.get('notes'):
        text += f"\n📝 Заметки: {contact['notes']}\n"
    
    # Быстрые действия - обновление статусов
    current_status = contact.get('outreach_status', 'NOT_CONTACTED')
    status_buttons = []
    
    if current_status == 'SENT':
        status_buttons.append(InlineKeyboardButton(text="✅ Ответил", callback_data=f"quick_status_{instagram_handle}_REPLIED"))
        status_buttons.append(InlineKeyboardButton(text="💡 Заинтересован", callback_data=f"quick_status_{instagram_handle}_INTERESTED"))
    elif current_status == 'REPLIED':
        status_buttons.append(InlineKeyboardButton(text="💡 Заинтересован", callback_data=f"quick_status_{instagram_handle}_INTERESTED"))
        status_buttons.append(InlineKeyboardButton(text="❌ Не заинтересован", callback_data=f"quick_status_{instagram_handle}_NOT_INTERESTED"))
    elif current_status == 'INTERESTED':
        status_buttons.append(InlineKeyboardButton(text="📞 Запланировать созвон", callback_data=f"schedule_call_{instagram_handle}"))
        status_buttons.append(InlineKeyboardButton(text="✅ Закрыть", callback_data=f"quick_status_{instagram_handle}_CLOSED"))
    elif current_status == 'CALL_SCHEDULED':
        status_buttons.append(InlineKeyboardButton(text="✅ Закрыть", callback_data=f"quick_status_{instagram_handle}_CLOSED"))
    
    keyboard_rows = []
    if status_buttons:
        keyboard_rows.append(status_buttons)
    
    # Шаблоны ответов
    keyboard_rows.append([InlineKeyboardButton(text="📝 Шаблоны ответов", callback_data=f"response_templates_{instagram_handle}")])
    
    # Другие действия
    keyboard_rows.append([
    ])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_rows)
    
    await message.answer(text, reply_markup=keyboard, parse_mode='Markdown')
    await state.clear()

@dp.callback_query(F.data.startswith("quick_status_"))
async def quick_update_status(callback_query: types.CallbackQuery):
    """Быстрое обновление статуса контакта"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    # Парсим данные: quick_status_handle_STATUS
    parts = callback_query.data.replace("quick_status_", "").split("_", 1)
    if len(parts) != 2:
        await callback_query.answer("Ошибка формата", show_alert=True)
        return
    
    instagram_handle = parts[0]
    new_status = parts[1]
    
    if not outreach_manager:
        await callback_query.answer("Instagram Outreach Manager не инициализирован", show_alert=True)
        return
    
    status_names = {
        'REPLIED': 'Ответил',
        'INTERESTED': 'Заинтересованы',
        'NOT_INTERESTED': 'Не заинтересованы',
        'CLOSED': 'Закрыто'
    }
    
    success = outreach_manager.update_status(instagram_handle, new_status)
    
    if success:
        status_display = status_names.get(new_status, new_status)
        await callback_query.answer(f"✅ Статус обновлен: {status_display}")
        
        # Обновляем сообщение
        contact = outreach_manager.get_by_instagram_handle(instagram_handle)
        if contact:
            status_names_full = {
                'NOT_CONTACTED': 'Не обработаны',
                'QUEUED': 'В очереди',
                'SENT': 'Отправлено',
                'REPLIED': 'Ответили',
                'INTERESTED': 'Заинтересованы',
                'CALL_SCHEDULED': 'Созвон запланирован',
                'CLOSED': 'Закрыто'
            }
            
            text = f"👤 **Контакт: @{instagram_handle}**\n\n"
            text += f"📛 Имя: {contact.get('name', 'не указано')}\n"
            text += f"📍 Район: {contact.get('district', 'не указано')}\n"
            text += f"💼 Тип бизнеса: {contact.get('business_type', 'не указано')}\n"
            text += f"📊 Статус: {status_names_full.get(contact.get('outreach_status'), contact.get('outreach_status', 'UNKNOWN'))}\n"
            text += f"⭐ Приоритет: {contact.get('priority', 'MEDIUM')}\n"
            text += f"\n✅ **Статус обновлен!**\n"
            
            # Обновляем кнопки в зависимости от нового статуса
            current_status = contact.get('outreach_status', 'NOT_CONTACTED')
            status_buttons = []
            
            if current_status == 'SENT':
                status_buttons.append(InlineKeyboardButton(text="✅ Ответил", callback_data=f"quick_status_{instagram_handle}_REPLIED"))
                status_buttons.append(InlineKeyboardButton(text="💡 Заинтересован", callback_data=f"quick_status_{instagram_handle}_INTERESTED"))
            elif current_status == 'REPLIED':
                status_buttons.append(InlineKeyboardButton(text="💡 Заинтересован", callback_data=f"quick_status_{instagram_handle}_INTERESTED"))
                status_buttons.append(InlineKeyboardButton(text="❌ Не заинтересован", callback_data=f"quick_status_{instagram_handle}_NOT_INTERESTED"))
            elif current_status == 'INTERESTED':
                status_buttons.append(InlineKeyboardButton(text="📞 Запланировать созвон", callback_data=f"schedule_call_{instagram_handle}"))
                status_buttons.append(InlineKeyboardButton(text="✅ Закрыть", callback_data=f"quick_status_{instagram_handle}_CLOSED"))
            
            keyboard_rows = []
            if status_buttons:
                keyboard_rows.append(status_buttons)
            keyboard_rows.append([InlineKeyboardButton(text="📝 Шаблоны ответов", callback_data=f"response_templates_{instagram_handle}")])
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_rows)
            await callback_query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')
    else:
        await callback_query.answer("❌ Ошибка обновления статуса", show_alert=True)

@dp.callback_query(F.data.startswith("response_templates_"))
async def show_response_templates(callback_query: types.CallbackQuery):
    """Показывает шаблоны ответов для контакта"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    instagram_handle = callback_query.data.replace("response_templates_", "")
    
    try:
        from response_templates import get_all_templates
        
        templates = get_all_templates()
        
        text = f"📝 **Шаблоны ответов для @{instagram_handle}**\n\n"
        text += "Выберите шаблон:\n\n"
        
        keyboard_rows = []
        row = []
        
        for key, template in templates.items():
            emoji_map = {
                'greeting': '👋',
                'program_details': '📋',
                'pricing': '💰',
                'benefits': '✨',
                'integration': '🔧',
                'objection_price': '💭',
                'objection_time': '⏰',
                'objection_competitors': '👍',
                'call_to_action': '🎉',
                'follow_up': '📞',
                'thank_you': '🙏'
            }
            emoji = emoji_map.get(key, '📝')
            
            use_button = InlineKeyboardButton(
                text=f"{emoji} {template['name']}",
                callback_data=f"template_use_{instagram_handle}_{key}"
            )
            edit_button = InlineKeyboardButton(
                text="✏️",
                callback_data=f"template_edit_{instagram_handle}_{key}"
            )
            row.append(use_button)
            row.append(edit_button)
            if len(row) == 4:
                keyboard_rows.append(row)
                row = []
        
        if row:
            keyboard_rows.append(row)
        
        keyboard_rows.append([InlineKeyboardButton(text="◀️ Назад к контакту", callback_data=f"show_contact_{instagram_handle}")])
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_rows)
        await callback_query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')
        await callback_query.answer()
        
    except ImportError:
        await callback_query.answer("Модуль response_templates не найден", show_alert=True)
    except Exception as e:
        logger.exception(f"Error showing templates: {e}")
        await callback_query.answer("Ошибка при загрузке шаблонов", show_alert=True)

@dp.callback_query(F.data.startswith("template_use_"))
async def use_response_template(callback_query: types.CallbackQuery):
    """Использует выбранный шаблон ответа"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    # Парсим: template_use_handle_key
    parts = callback_query.data.replace("template_use_", "").split("_", 1)
    if len(parts) != 2:
        await callback_query.answer("Ошибка формата", show_alert=True)
        return
    
    instagram_handle = parts[0]
    template_key = parts[1]
    
    try:
        # Получаем данные контакта для переменных
        contact = outreach_manager.get_by_instagram_handle(instagram_handle) if outreach_manager else None
        
        variables = {}
        if contact:
            # Можно добавить переменные из контакта (пока используем константы/заглушки)
            variables = {
                'commission': '5',  # Можно брать из настроек
                'min_amount': '10',
                'entry_fee': '0',
                'partner_count': '50+'  # Можно брать из статистики
            }

        # Рендерим шаблон с учётом возможного оверрайда из Supabase
        template = await render_response_template(template_key, variables)
        
        if not template:
            await callback_query.answer("Шаблон не найден", show_alert=True)
            return
        
        text = f"📝 **Шаблон: {template['name']}**\n\n"
        text += "```\n"
        text += template['message']
        text += "\n```\n\n"
        if template.get('use_case'):
            text += f"💡 **Использование:** {template.get('use_case', '')}\n"
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📋 Копировать", callback_data=f"template_copy_{instagram_handle}_{template_key}")],
            [InlineKeyboardButton(text="◀️ Назад к шаблонам", callback_data=f"response_templates_{instagram_handle}")]
        ])
        
        await callback_query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')
        await callback_query.answer()
        
    except ImportError:
        await callback_query.answer("Модуль response_templates не найден", show_alert=True)
    except Exception as e:
        logger.exception(f"Error using template: {e}")
        await callback_query.answer("Ошибка при использовании шаблона", show_alert=True)

@dp.callback_query(F.data.startswith("outreach_message_btn_"))
async def generate_message_from_button(callback_query: types.CallbackQuery):
    """Генерирует сообщение из кнопки"""
    instagram_handle = callback_query.data.replace("outreach_message_btn_", "")
    
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    if not outreach_manager:
        await callback_query.answer("Instagram Outreach Manager не инициализирован", show_alert=True)
        return
    
    try:
        preview = outreach_manager.generate_message(instagram_handle, 'first_contact_short')
        
        if not preview or 'error' in preview:
            await callback_query.answer("Ошибка генерации сообщения", show_alert=True)
            return
        
        text = f"📝 **Сообщение для `{instagram_handle}`**\n\n"
        text += f"Шаблон: {preview['template_display_name']}\n"
        text += f"Длина: {preview['character_count']} символов, {preview['word_count']} слов\n\n"
        text += "```\n"
        text += preview['message']
        text += "\n```"
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад к контакту", callback_data=f"show_contact_{instagram_handle}")]
        ])
        
        await callback_query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')
        await callback_query.answer()
        
    except Exception as e:
        logger.exception(f"Error generating message: {e}")
        await callback_query.answer(f"Ошибка: {str(e)}", show_alert=True)


async def render_response_template(template_key: str, variables: dict | None = None) -> dict | None:
    """
    Рендерит шаблон ответа с учётом возможного оверрайда в Supabase.
    
    Возвращает словарь:
    - name: имя шаблона
    - message: готовый текст сообщения
    - use_case: описание использования (если есть)
    """
    try:
        from response_templates import RESPONSE_TEMPLATES
    except ImportError:
        return None

    base = RESPONSE_TEMPLATES.get(template_key)
    if not base:
        return None

    # Пытаемся получить оверрайд из Supabase
    override_text = None
    try:
        if db_manager and db_manager.client:
            result = db_manager.client.from_('instagram_response_templates') \
                .select('template_text') \
                .eq('template_key', template_key) \
                .limit(1) \
                .execute()
            if result.data:
                override_text = result.data[0].get('template_text')
    except Exception as e:
        logger.warning(f"Не удалось получить оверрайд шаблона {template_key}: {e}")

    template_text = override_text or base.get('template', '')

    # Подставляем переменные, если они есть
    variables = variables or {}
    for var in base.get('variables', []):
        value = variables.get(var, f'{{{var}}}')
        template_text = template_text.replace(f'{{{var}}}', str(value))

    return {
        'name': base.get('name', template_key),
        'message': template_text,
        'use_case': base.get('use_case', '')
    }


@dp.callback_query(F.data.startswith("template_edit_"))
async def edit_response_template(callback_query: types.CallbackQuery, state: FSMContext):
    """Запускает процесс редактирования выбранного шаблона ответа."""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return

    # Формат: template_edit_{instagram_handle}_{template_key}
    raw = callback_query.data.replace("template_edit_", "")
    parts = raw.split("_", 1)
    if len(parts) != 2:
        await callback_query.answer("Ошибка формата", show_alert=True)
        return

    instagram_handle, template_key = parts

    # Получаем текущий текст шаблона (с учётом оверрайда)
    current = await render_response_template(template_key, {})
    if not current:
        await callback_query.answer("Шаблон не найден", show_alert=True)
        return

    text = f"✏️ **Редактирование шаблона** `{template_key}`\n\n"
    text += "Текущий текст:\n"
    text += "```\n"
    text += current['message']
    text += "\n```\n\n"
    text += "Отправьте новый текст сообщения *одним сообщением*.\n\n"
    text += "Подсказки:\n"
    text += "- Можно использовать плейсхолдеры: `{commission}`, `{min_amount}`, `{entry_fee}`, `{partner_count}` (для соответствующих шаблонов)\n"
    text += "- Чтобы отменить — отправьте `/cancel`.\n"

    await state.set_state(TemplateEditing.waiting_for_new_text)
    await state.update_data(instagram_handle=instagram_handle, template_key=template_key)

    await callback_query.message.edit_text(text, parse_mode='Markdown')
    await callback_query.answer()


@dp.message(TemplateEditing.waiting_for_new_text)
async def process_new_template_text(message: types.Message, state: FSMContext):
    """Получает новый текст шаблона и сохраняет его в Supabase."""
    if not is_admin(message.from_user.id):
        await message.answer("У вас нет прав администратора")
        return

    if message.text.strip().lower() in ("/cancel", "отмена"):
        await state.clear()
        await message.answer("❌ Редактирование шаблона отменено.")
        return

    data = await state.get_data()
    template_key = data.get('template_key')
    instagram_handle = data.get('instagram_handle')

    new_text = message.text

    # Сохраняем оверрайд в Supabase
    try:
        if not db_manager or not db_manager.client:
            await message.answer("❌ Supabase недоступен, не удалось сохранить изменения.")
            return

        upsert_data = {
            'template_key': template_key,
            'template_text': new_text,
            'updated_by': str(message.from_user.id)
        }

        db_manager.client.from_('instagram_response_templates') \
            .upsert(upsert_data, on_conflict='template_key') \
            .execute()

        await message.answer(
            "✅ Шаблон обновлён.\n\nНовая версия:\n"
            "```\n" + new_text + "\n```",
            parse_mode='Markdown'
        )

        # Возвращаемся к списку шаблонов для контакта
        await state.clear()
        # эмулируем нажатие кнопки "Шаблоны ответов"
        fake_callback = types.CallbackQuery(
            id="0",
            from_user=message.from_user,
            chat_instance="",
            message=message,
            data=f"response_templates_{instagram_handle}"
        )
        await show_response_templates(fake_callback)

    except Exception as e:
        logger.exception(f"Error saving template override: {e}")
        await message.answer("❌ Ошибка при сохранении шаблона. Попробуйте позже.")
        await state.clear()

@dp.callback_query(F.data.startswith("show_contact_"))
async def show_contact_from_button(callback_query: types.CallbackQuery):
    """Показывает детали контакта из кнопки"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    instagram_handle = callback_query.data.replace("show_contact_", "")
    
    if not outreach_manager:
        await callback_query.answer("Instagram Outreach Manager не инициализирован", show_alert=True)
        return
    
    contact = outreach_manager.get_by_instagram_handle(instagram_handle)
    
    if not contact:
        await callback_query.answer(f"Контакт {instagram_handle} не найден", show_alert=True)
        return
    
    # Формируем информацию о контакте
    status_names = {
        'NOT_CONTACTED': 'Не обработаны',
        'QUEUED': 'В очереди',
        'SENT': 'Отправлено',
        'REPLIED': 'Ответили',
        'INTERESTED': 'Заинтересованы',
        'CALL_SCHEDULED': 'Созвон запланирован',
        'FOLLOW_UP_1': 'Follow-up 1',
        'FOLLOW_UP_2': 'Follow-up 2',
        'NOT_INTERESTED': 'Не заинтересованы',
        'GHOSTED': 'Исчезли',
        'CLOSED': 'Закрыто'
    }
    
    text = f"👤 **Контакт: @{contact['instagram_handle']}**\n\n"
    text += f"📛 Имя: {contact.get('name', 'не указано')}\n"
    text += f"📍 Район: {contact.get('district', 'не указано')}\n"
    text += f"💼 Тип бизнеса: {contact.get('business_type', 'не указано')}\n"
    text += f"📊 Статус: {status_names.get(contact.get('outreach_status'), contact.get('outreach_status', 'UNKNOWN'))}\n"
    text += f"⭐ Приоритет: {contact.get('priority', 'MEDIUM')}\n"
    
    if contact.get('first_contact_date'):
        text += f"📅 Первый контакт: {contact['first_contact_date'][:10]}\n"
    if contact.get('call_scheduled_date'):
        text += f"📞 Созвон: {contact['call_scheduled_date'][:10]}\n"
    if contact.get('notes'):
        text += f"\n📝 Заметки: {contact['notes']}\n"
    
    # Быстрые действия
    current_status = contact.get('outreach_status', 'NOT_CONTACTED')
    status_buttons = []
    
    if current_status == 'SENT':
        status_buttons.append(InlineKeyboardButton(text="✅ Ответил", callback_data=f"quick_status_{instagram_handle}_REPLIED"))
        status_buttons.append(InlineKeyboardButton(text="💡 Заинтересован", callback_data=f"quick_status_{instagram_handle}_INTERESTED"))
    elif current_status == 'REPLIED':
        status_buttons.append(InlineKeyboardButton(text="💡 Заинтересован", callback_data=f"quick_status_{instagram_handle}_INTERESTED"))
        status_buttons.append(InlineKeyboardButton(text="❌ Не заинтересован", callback_data=f"quick_status_{instagram_handle}_NOT_INTERESTED"))
    elif current_status == 'INTERESTED':
        status_buttons.append(InlineKeyboardButton(text="📞 Запланировать созвон", callback_data=f"schedule_call_{instagram_handle}"))
        status_buttons.append(InlineKeyboardButton(text="✅ Закрыть", callback_data=f"quick_status_{instagram_handle}_CLOSED"))
    elif current_status == 'CALL_SCHEDULED':
        status_buttons.append(InlineKeyboardButton(text="✅ Закрыть", callback_data=f"quick_status_{instagram_handle}_CLOSED"))
    
    keyboard_rows = []
    if status_buttons:
        keyboard_rows.append(status_buttons)
    
    keyboard_rows.append([InlineKeyboardButton(text="📝 Шаблоны ответов", callback_data=f"response_templates_{instagram_handle}")])
    keyboard_rows.append([
    ])
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_rows)
    await callback_query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')
    await callback_query.answer()

@dp.callback_query(F.data == "outreach_followups")
async def show_followups(callback_query: types.CallbackQuery):
    """Показывает контакты, требующие follow-up"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    if not outreach_manager:
        await callback_query.answer("Instagram Outreach Manager не инициализирован", show_alert=True)
        return
    
    follow_ups = outreach_manager.get_follow_ups()
    
    if not follow_ups:
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
        ])
        
        await callback_query.message.edit_text(
            "⏰ **Follow-up напоминания**\n\n"
            "Нет контактов, требующих follow-up.",
            reply_markup=keyboard
        )
        await callback_query.answer()
        return
    
    text = "⏰ **Контакты, требующие follow-up**\n\n"
    
    for i, contact in enumerate(follow_ups[:10], 1):
        text += f"{i}. 📱 @{contact.get('instagram_handle', 'unknown')}\n"
        text += f"   👤 {contact.get('name', 'не указано')}\n"
        text += f"   📊 Статус: {contact.get('outreach_status', 'UNKNOWN')}\n"
        if contact.get('first_contact_date'):
            text += f"   📅 Первый контакт: {contact['first_contact_date'][:10]}\n"
        text += "\n"
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
    ])
    
    await callback_query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown')
    await callback_query.answer()

# --- Calendar Integration Handlers ---

@dp.callback_query(F.data == "outreach_upcoming_calls")
async def show_upcoming_calls(callback_query: types.CallbackQuery):
    """Показывает предстоящие созвоны"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    if not outreach_manager:
        await callback_query.answer("Instagram Outreach Manager не инициализирован", show_alert=True)
        return
    
    upcoming = outreach_manager.get_upcoming_calls(limit=10)
    
    if not upcoming:
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
        ])
        
        await callback_query.message.edit_text(
            "📅 **Предстоящие созвоны**\n\n"
            "Нет запланированных созвонов.",
            reply_markup=keyboard
        )
        await callback_query.answer()
        return
    
    from datetime import datetime
    text = "📅 **Предстоящие созвоны**\n\n"
    
    for i, call in enumerate(upcoming[:10], 1):
        call_date = call.get('call_scheduled_date')
        if call_date:
            try:
                if isinstance(call_date, str):
                    dt = datetime.fromisoformat(call_date.replace('Z', '+00:00'))
                else:
                    dt = call_date
                formatted_date = dt.strftime('%d.%m.%Y %H:%M')
                
                text += f"{i}. 📞 {call.get('name', call.get('instagram_handle', 'Unknown'))}\n"
                text += f"   🕐 {formatted_date}\n"
                if call.get('meeting_link'):
                    text += f"   🔗 [Ссылка на встречу]({call.get('meeting_link')})\n"
                text += f"   📱 @{call.get('instagram_handle', '')}\n\n"
            except Exception as e:
                logger.warning(f"Error formatting call date: {e}")
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
    ])
    
    await callback_query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown', disable_web_page_preview=True)
    await callback_query.answer()

@dp.callback_query(F.data.startswith("schedule_call_"))
async def start_schedule_call(callback_query: types.CallbackQuery, state: FSMContext):
    """Начинает процесс планирования созвона"""
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    instagram_handle = callback_query.data.replace("schedule_call_", "")
    
    # Сохраняем handle в состоянии
    await state.update_data(instagram_handle=instagram_handle)
    await state.set_state(CallScheduling.waiting_for_time)
    
    # Показываем быстрые опции (время для Нью-Йорка)
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📅 Завтра 10:00 NY", callback_data="quick_time_tomorrow_10"),
            InlineKeyboardButton(text="📅 Завтра 14:00 NY", callback_data="quick_time_tomorrow_14")
        ],
        [
            InlineKeyboardButton(text="📅 Завтра 15:00 NY", callback_data="quick_time_tomorrow_15"),
            InlineKeyboardButton(text="📅 Через 3 дня 14:00 NY", callback_data="quick_time_3days_14")
        ],
        [InlineKeyboardButton(text="✏️ Ввести вручную", callback_data="manual_time")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel_schedule")]
    ])
    
    await callback_query.message.edit_text(
        f"📅 **Планирование созвона с @{instagram_handle}**\n\n"
        "⏰ **Важно:** Указывайте время для Нью-Йорка (NY)\n"
        "Разница: Нячанг опережает NY на 11-12 часов\n\n"
        "Выберите время или введите вручную:\n"
        "Формат: `DD.MM.YYYY HH:MM` (время для Нью-Йорка)\n"
        "Пример: `25.12.2024 14:00` (14:00 в Нью-Йорке)",
        reply_markup=keyboard,
        parse_mode='Markdown'
    )
    await callback_query.answer()

@dp.callback_query(F.data.startswith("quick_time_"))
async def quick_schedule_time(callback_query: types.CallbackQuery, state: FSMContext):
    """Быстрое планирование с предустановленным временем"""
    from datetime import datetime, timedelta
    
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    data = await state.get_data()
    instagram_handle = data.get('instagram_handle')
    
    if not instagram_handle:
        await callback_query.answer("Ошибка: handle не найден", show_alert=True)
        return
    
    # Парсим опцию (время указывается для Нью-Йорка)
    option = callback_query.data.replace("quick_time_", "")
    
    # Используем timezone для Нью-Йорка
    from datetime import timezone, timedelta
    import pytz
    
    ny_tz = pytz.timezone('America/New_York')
    now_ny = datetime.now(ny_tz)
    
    if option == "tomorrow_10":
        scheduled_time_ny = (now_ny + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    elif option == "tomorrow_14":
        scheduled_time_ny = (now_ny + timedelta(days=1)).replace(hour=14, minute=0, second=0, microsecond=0)
    elif option == "tomorrow_15":
        scheduled_time_ny = (now_ny + timedelta(days=1)).replace(hour=15, minute=0, second=0, microsecond=0)
    elif option == "3days_14":
        scheduled_time_ny = (now_ny + timedelta(days=3)).replace(hour=14, minute=0, second=0, microsecond=0)
    else:
        await callback_query.answer("Неизвестная опция", show_alert=True)
        return
    
    # Конвертируем в UTC для хранения в базе
    scheduled_time = scheduled_time_ny.astimezone(timezone.utc).replace(tzinfo=None)
    
    # Планируем созвон
    try:
        result = outreach_manager.schedule_call(
            instagram_handle=instagram_handle,
            scheduled_time=scheduled_time,
            duration_minutes=30
        )
        
        if result and result.get('success'):
            calendar_link = result.get('calendar_html_link', '')
            meeting_link = result.get('meeting_link', '')
            
            # Показываем время в обоих часовых поясах
            import pytz
            ny_tz = pytz.timezone('America/New_York')
            nha_tz = pytz.timezone('Asia/Ho_Chi_Minh')
            
            # scheduled_time_ny уже определен выше, используем его
            scheduled_time_nha = scheduled_time_ny.astimezone(nha_tz)
            
            text = f"✅ **Созвон запланирован!**\n\n"
            text += f"📱 Партнер: @{instagram_handle}\n"
            text += f"🕐 Время в Нью-Йорке: {scheduled_time_ny.strftime('%d.%m.%Y %H:%M')} (NY)\n"
            text += f"🕐 Время в Нячанге: {scheduled_time_nha.strftime('%d.%m.%Y %H:%M')} (NHA)\n"
            text += f"⏱ Длительность: 30 минут\n"
            
            if meeting_link:
                text += f"🔗 [Ссылка на встречу]({meeting_link})\n"
            
            if calendar_link:
                text += f"📅 [Открыть в календаре]({calendar_link})\n"
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
            ])
            
            await callback_query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown', disable_web_page_preview=True)
            await state.clear()
        else:
            await callback_query.answer("Ошибка при планировании созвона", show_alert=True)
    except Exception as e:
        logger.exception(f"Error scheduling call: {e}")
        await callback_query.answer(f"Ошибка: {str(e)}", show_alert=True)
    
    await callback_query.answer()

@dp.callback_query(F.data == "manual_time")
async def manual_time_input(callback_query: types.CallbackQuery, state: FSMContext):
    """Запрашивает ручной ввод времени"""
    await callback_query.message.edit_text(
        "✏️ **Введите дату и время созвона**\n\n"
        "⏰ **Важно:** Указывайте время для Нью-Йорка (NY)\n"
        "Разница: Нячанг опережает NY на 11-12 часов\n\n"
        "Формат: `DD.MM.YYYY HH:MM` (время для Нью-Йорка)\n"
        "Пример: `25.12.2024 14:00` (14:00 в Нью-Йорке)\n\n"
        "Или используйте команду /cancel для отмены"
    )
    await callback_query.answer()

@dp.message(CallScheduling.waiting_for_time)
async def process_call_time(message: types.Message, state: FSMContext):
    """Обрабатывает введенное время созвона (время для Нью-Йорка)"""
    from datetime import datetime, timezone
    import pytz
    
    time_str = message.text.strip()
    
    try:
        # Парсим дату и время (предполагаем, что это время для Нью-Йорка)
        scheduled_time_naive = datetime.strptime(time_str, '%d.%m.%Y %H:%M')
        
        # Применяем timezone Нью-Йорка
        ny_tz = pytz.timezone('America/New_York')
        scheduled_time_ny = ny_tz.localize(scheduled_time_naive)
        
        # Конвертируем в UTC для хранения
        scheduled_time = scheduled_time_ny.astimezone(timezone.utc).replace(tzinfo=None)
        
        # Проверяем, что время в будущем (в Нью-Йорке)
        now_ny = datetime.now(ny_tz)
        if scheduled_time_naive < now_ny.replace(tzinfo=None):
            await message.answer("❌ Время должно быть в будущем (для Нью-Йорка)! Попробуйте еще раз:")
            return
        
        # Сохраняем время
        await state.update_data(scheduled_time=scheduled_time.isoformat())
        await state.set_state(CallScheduling.waiting_for_duration)
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="30 мин", callback_data="duration_30"),
                InlineKeyboardButton(text="45 мин", callback_data="duration_45"),
                InlineKeyboardButton(text="60 мин", callback_data="duration_60")
            ],
            [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel_schedule")]
        ])
        
        await message.answer(
            f"✅ Время: {scheduled_time.strftime('%d.%m.%Y %H:%M')}\n\n"
            "Выберите длительность созвона:",
            reply_markup=keyboard
        )
    except ValueError:
        await message.answer(
            "❌ Неверный формат времени!\n\n"
            "Используйте формат: `DD.MM.YYYY HH:MM`\n"
            "Пример: `25.12.2024 14:00`",
            parse_mode='Markdown'
        )

@dp.callback_query(F.data.startswith("duration_"))
async def process_call_duration(callback_query: types.CallbackQuery, state: FSMContext):
    """Обрабатывает выбранную длительность"""
    from datetime import datetime
    
    if not is_admin(callback_query.from_user.id):
        await callback_query.answer("У вас нет прав администратора")
        return
    
    duration = int(callback_query.data.replace("duration_", ""))
    data = await state.get_data()
    
    instagram_handle = data.get('instagram_handle')
    scheduled_time_str = data.get('scheduled_time')
    
    if not instagram_handle or not scheduled_time_str:
        await callback_query.answer("Ошибка: данные не найдены", show_alert=True)
        return
    
    try:
        scheduled_time = datetime.fromisoformat(scheduled_time_str)
        
        # Планируем созвон
        result = outreach_manager.schedule_call(
            instagram_handle=instagram_handle,
            scheduled_time=scheduled_time,
            duration_minutes=duration
        )
        
        if result and result.get('success'):
            calendar_link = result.get('calendar_html_link', '')
            meeting_link = result.get('meeting_link', '')
            
            # Показываем время в обоих часовых поясах
            import pytz
            ny_tz = pytz.timezone('America/New_York')
            nha_tz = pytz.timezone('Asia/Ho_Chi_Minh')
            
            # Конвертируем scheduled_time обратно в NY timezone
            scheduled_time_utc = pytz.utc.localize(scheduled_time)
            scheduled_time_ny = scheduled_time_utc.astimezone(ny_tz)
            scheduled_time_nha = scheduled_time_utc.astimezone(nha_tz)
            
            text = f"✅ **Созвон запланирован!**\n\n"
            text += f"📱 Партнер: @{instagram_handle}\n"
            text += f"🕐 Время в Нью-Йорке: {scheduled_time_ny.strftime('%d.%m.%Y %H:%M')} (NY)\n"
            text += f"🕐 Время в Нячанге: {scheduled_time_nha.strftime('%d.%m.%Y %H:%M')} (NHA)\n"
            text += f"⏱ Длительность: {duration} минут\n"
            
            if meeting_link:
                text += f"🔗 [Ссылка на встречу]({meeting_link})\n"
            
            if calendar_link:
                text += f"📅 [Открыть в календаре]({calendar_link})\n"
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
            ])
            
            await callback_query.message.edit_text(text, reply_markup=keyboard, parse_mode='Markdown', disable_web_page_preview=True)
            await state.clear()
        else:
            await callback_query.answer("Ошибка при планировании созвона", show_alert=True)
    except Exception as e:
        logger.exception(f"Error scheduling call: {e}")
        await callback_query.answer(f"Ошибка: {str(e)}", show_alert=True)
    
    await callback_query.answer()

@dp.callback_query(F.data == "cancel_schedule")
async def cancel_schedule(callback_query: types.CallbackQuery, state: FSMContext):
    """Отменяет планирование созвона"""
    await state.clear()
    await callback_query.message.edit_text("❌ Планирование отменено")
    await callback_query.answer()

# --- Запуск Бота ---

async def main():
    # Глобальный обработчик ошибок для перехвата всех исключений
    async def error_handler(update: types.Update, exception: Exception):
        error_msg = f"Unhandled exception: {exception}"
        logging.error(error_msg, exc_info=True)
        print(f"[GLOBAL_ERROR] {error_msg}", flush=True)
        import traceback
        print(f"[GLOBAL_ERROR] Traceback: {traceback.format_exc()}", flush=True)
        return True
    
    dp.errors.register(error_handler)
    
    # Запускаем фоновые вочеры
    asyncio.create_task(watch_new_partner_applications())
    asyncio.create_task(watch_new_service_submissions())
    asyncio.create_task(watch_new_ugc_submissions())
    logger.info("=== Админ-бот запущен (с автоуведомлениями о партнёрах, услугах и UGC) ===")
    print("=== Админ-бот запущен ===", flush=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        # Убедитесь, что ваш .env файл содержит ADMIN_BOT_TOKEN и ADMIN_CHAT_ID
        asyncio.run(main())
    except RuntimeError as e:
        logger.critical(f"RuntimeError: {e}")
        print(e)
    except KeyboardInterrupt:
        logger.info("Бот остановлен пользователем (KeyboardInterrupt)")
        print("Bot stopped by user.")
    except Exception as e:
        logger.exception(f"Критическая ошибка при запуске админ-бота: {e}")
        raise
