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

# Предполагается, что SupabaseManager находится в отдельном файле (например, supabase_manager.py)
from supabase_manager import SupabaseManager 

load_dotenv()

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
        [InlineKeyboardButton(text="🤝 Заявки Партнеров", callback_data="admin_partners")],
        [InlineKeyboardButton(text="✨ Модерация Услуг", callback_data="admin_services")],
        [InlineKeyboardButton(text="📰 Управление Новостями", callback_data="admin_news")],
        [InlineKeyboardButton(text="📊 Общая статистика", callback_data="admin_stats")]
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
    
    partners_df = db_manager.get_all_partners()
    pending_partners = partners_df[partners_df['status'].str.lower() == 'pending']
    
    if pending_partners.empty:
        await callback_query.message.edit_text("✅ Новых заявок на партнерство нет.")
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

    await callback_query.message.edit_text(
        f"⏳ Загружено {len(pending_partners)} заявок на модерацию."
    )


@dp.callback_query(F.data.startswith("partner_"))
async def handle_partner_approval(callback_query: types.CallbackQuery):
    """Обрабатывает одобрение или отклонение заявки партнера."""
    action, partner_id = callback_query.data.split('_')[1], callback_query.data.split('_')[2]
    
    new_status = 'Approved' if action == 'approve' else 'Rejected'
    success = db_manager.update_partner_status(partner_id, new_status)
    
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
        await callback_query.answer("Ошибка при обновлении статуса в БД.")
        
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
    service_id = int(parts[2])
    
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
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🤝 Заявки Партнеров", callback_data="admin_partners")],
        [InlineKeyboardButton(text="✨ Модерация Услуг", callback_data="admin_services")],
        [InlineKeyboardButton(text="📰 Управление Новостями", callback_data="admin_news")],
        [InlineKeyboardButton(text="📊 Общая статистика", callback_data="admin_stats")]
    ])
    
    await callback_query.message.edit_text(
        "👋 **Админ-панель**\n\nВыберите раздел для управления системой лояльности:",
        reply_markup=keyboard
    )


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
    if message.text == '/cancel':
        await state.clear()
        await message.answer("❌ Создание новости отменено.")
        return
    
    if message.text != '/skip':
        await state.update_data(preview_text=message.text)
    
    await state.set_state(NewsCreation.waiting_for_image)
    await message.answer(
        "✅ Превью сохранено!\n\n"
        "Шаг 4/4: Отправьте URL изображения для новости.\n\n"
        "Отправьте /skip чтобы создать новость без изображения, или /cancel для отмены."
    )


@dp.message(NewsCreation.waiting_for_image)
async def process_news_image(message: types.Message, state: FSMContext):
    """Обрабатывает изображение новости и создает ее."""
    if message.text == '/cancel':
        await state.clear()
        await message.answer("❌ Создание новости отменено.")
        return
    
    data = await state.get_data()
    
    if message.text != '/skip':
        data['image_url'] = message.text
    
    # Добавляем ID автора
    data['author_chat_id'] = str(message.chat.id)
    
    # Создаем новость в БД
    success, news_id = db_manager.create_news(data)
    
    if success:
        await message.answer(
            f"✅ **Новость успешно создана!**\n\n"
            f"🆔 ID новости: {news_id}\n"
            f"📰 Заголовок: {data['title']}\n\n"
            f"Новость опубликована и видна пользователям в приложении."
        )
    else:
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
    success = db_manager.update_news(news_id, {db_field: new_value})
    
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


# --- Запуск Бота ---

async def main():
    # Запускаем фоновые вочеры
    asyncio.create_task(watch_new_partner_applications())
    asyncio.create_task(watch_new_service_submissions())
    logger.info("=== Админ-бот запущен (с автоуведомлениями о партнёрах и услугах) ===")
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
