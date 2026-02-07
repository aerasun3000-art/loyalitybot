import logging
import os
import requests
from fastapi import FastAPI, HTTPException, Request, Header, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Any
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from dotenv import load_dotenv
import hashlib
import hmac
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from supabase_manager import SupabaseManager
from ai_helper import translate_text_ai

load_dotenv()

# Инициализация Sentry для мониторинга ошибок FastAPI
sentry_dsn = os.getenv('SENTRY_DSN')
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.getenv('SENTRY_ENVIRONMENT', 'production'),
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        release=f"loyaltybot@{os.getenv('APP_VERSION', '1.0.0')}",
        send_default_pii=True,  # Добавляет данные запросов (headers, IP) для отладки
    )
    print("✅ Sentry инициализирован для secure_api (FastAPI)")

# Инициализация Rate Limiter
limiter = Limiter(key_func=get_remote_address)
print("✅ Rate Limiter инициализирован")

app = FastAPI(
    title="Loyalty Secure API",
    description="""
    ## 🎯 Внутренний сервис для системы лояльности
    
    Этот API предоставляет безопасный доступ к операциям с базой данных Supabase.
    
    ### Основные возможности:
    
    * **Транзакции** - начисление и списание бонусных баллов
    * **Балансы клиентов** - получение текущего баланса
    * **Sentry Webhooks** - получение алертов из Sentry
    * **Health Check** - проверка статуса сервиса
    
    ### Интеграции:
    
    * 🔍 **Sentry** - мониторинг ошибок и производительности
    * 💾 **Supabase** - база данных PostgreSQL
    * 📱 **Telegram** - уведомления об ошибках
    
    ### Безопасность:
    
    * Использует service key для доступа к Supabase
    * Проверка подписи webhook от Sentry
    * Rate limiting для защиты от злоупотреблений
    
    ### Rate Limits:
    
    * Health Check: 60 запросов/минуту
    * Balance: 30 запросов/минуту
    * Transactions: 10 запросов/минуту
    * Webhooks: 5 запросов/минуту
    """,
    version="1.0.0",
    contact={
        "name": "Support",
        "email": "support@example.com",
    },
    license_info={
        "name": "MIT",
    },
    openapi_tags=[
        {
            "name": "health",
            "description": "Проверка состояния сервиса"
        },
        {
            "name": "clients",
            "description": "Операции с клиентами"
        },
        {
            "name": "transactions",
            "description": "Транзакции начисления и списания баллов"
        },
        {
            "name": "webhooks",
            "description": "Webhook endpoints для внешних интеграций"
        },
        {
            "name": "translation",
            "description": "AI-перевод текста"
        },
    ]
)

# Добавление CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене замените на конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Добавление Rate Limiter в приложение
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

manager = SupabaseManager()
logger = logging.getLogger("secure_api")


class TransactionRequest(BaseModel):
    client_chat_id: str = Field(..., description="Chat ID клиента")
    partner_chat_id: str = Field(..., description="Chat ID партнёра")
    txn_type: str = Field(..., pattern="^(accrual|spend)$")
    amount: float = Field(..., gt=0)


class TransactionResponse(BaseModel):
    success: bool
    queued: bool | None = None
    new_balance: int | None = None
    points: int | None = None
    error: str | None = None


class TranslationRequest(BaseModel):
    text: str = Field(..., description="Текст для перевода")
    target_lang: str = Field(default='en', description="Целевой язык (ru, en, es, fr, de, и т.д.)")
    source_lang: str = Field(default='ru', description="Исходный язык (ru, en, es, fr, de, и т.д.)")


class TranslationResponse(BaseModel):
    success: bool
    translated_text: str | None = None
    original_text: str | None = None
    source_lang: str | None = None
    target_lang: str | None = None
    error: str | None = None


class PartnerNotificationRequest(BaseModel):
    partner_chat_id: str = Field(..., description="Chat ID партнёра")
    client_chat_id: str = Field(..., description="Chat ID клиента")
    client_username: str | None = Field(None, description="Username клиента в Telegram")


class PartnerNotificationResponse(BaseModel):
    success: bool
    error: str | None = None


class RedeemRequest(BaseModel):
    client_chat_id: str = Field(..., description="Chat ID клиента")
    service_id: str = Field(..., description="UUID услуги для обмена")


class RedeemResponse(BaseModel):
    success: bool
    new_balance: int | None = None
    points_spent: int | None = None
    service: dict | None = None
    error: str | None = None


class RedeemPromotionRequest(BaseModel):
    client_chat_id: str = Field(..., description="Chat ID клиента")
    promotion_id: int = Field(..., description="ID акции")
    points_to_spend: int = Field(..., gt=0, description="Количество баллов для оплаты")


class RedeemPromotionResponse(BaseModel):
    success: bool
    current_balance: int | None = None
    points_to_spend: int | None = None
    points_value_usd: float | None = None
    service_price: float | None = None
    cash_payment: float | None = None
    promotion: dict | None = None
    qr_data: str | None = None
    error: str | None = None


@app.get(
    "/health",
    tags=["health"],
    summary="Health Check",
    description="Проверка работоспособности API",
    response_description="Статус сервиса"
)
@limiter.limit("60/minute")
def health_check(request: Request):
    """
    Простая проверка работоспособности сервиса.
    
    Rate Limit: 60 запросов/минуту
    
    Возвращает:
    - **status**: "ok" если сервис работает
    """
    return {"status": "ok"}


@app.get(
    "/sentry-debug",
    tags=["health"],
    summary="Test Sentry Integration",
    description="Тестовый endpoint для проверки работы Sentry (только для разработки)",
    include_in_schema=False  # Скрыть из Swagger UI
)
@limiter.limit("5/minute")
async def trigger_error(request: Request):
    """
    Тестовый endpoint для проверки отправки ошибок в Sentry.
    ⚠️ Используйте только для тестирования!
    """
    division_by_zero = 1 / 0


@app.get(
    "/clients/{client_chat_id}/balance",
    tags=["clients"],
    summary="Получить баланс клиента",
    description="Возвращает текущий баланс бонусных баллов клиента",
    response_description="Баланс клиента"
)
@limiter.limit("30/minute")
def get_client_balance(request: Request, client_chat_id: str):
    """
    Получение текущего баланса бонусных баллов клиента.
    
    Rate Limit: 30 запросов/минуту
    
    Параметры:
    - **client_chat_id**: Telegram Chat ID клиента
    
    Возвращает:
    - **client_chat_id**: Chat ID клиента
    - **balance**: Текущий баланс в баллах
    """
    balance = manager.get_client_balance(client_chat_id)
    return {"client_chat_id": client_chat_id, "balance": balance}


@app.get(
    "/api/referral-code/{chat_id}",
    tags=["clients"],
    summary="Получить или создать реферальный код",
    description="Возвращает реферальный код пользователя; при отсутствии создаёт и сохраняет в БД (для отображения ссылки в веб-приложении)",
    response_description="Реферальный код"
)
@limiter.limit("30/minute")
def get_or_create_referral_code(request: Request, chat_id: str):
    """Получение или создание реферального кода для пользователя (клиент или партнёр)."""
    code = manager.get_or_create_referral_code(chat_id)
    if not code:
        raise HTTPException(status_code=400, detail="Не удалось получить или создать реферальный код")
    return {"referral_code": code}


@app.post(
    "/transactions",
    response_model=TransactionResponse,
    tags=["transactions"],
    summary="Создать транзакцию",
    description="Начисление или списание бонусных баллов",
    response_description="Результат транзакции",
    responses={
        200: {
            "description": "Транзакция успешно выполнена",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "new_balance": 150,
                        "points": 50
                    }
                }
            }
        },
        400: {
            "description": "Ошибка выполнения транзакции",
            "content": {
                "application/json": {
                    "example": {"detail": "Недостаточно баллов"}
                }
            }
        },
        429: {
            "description": "Слишком много запросов",
            "content": {
                "application/json": {
                    "example": {"detail": "Rate limit exceeded"}
                }
            }
        }
    }
)
@limiter.limit("10/minute")
def create_transaction(request: Request, payload: TransactionRequest):
    """
    Создание транзакции начисления или списания бонусных баллов.
    
    Rate Limit: 10 запросов/минуту
    
    Параметры:
    - **client_chat_id**: Telegram Chat ID клиента
    - **partner_chat_id**: Telegram Chat ID партнёра
    - **txn_type**: Тип транзакции ("accrual" - начисление, "spend" - списание)
    - **amount**: Сумма в долларах (для начисления) или баллах (для списания)
    
    Возвращает:
    - **success**: Успешность операции
    - **new_balance**: Новый баланс клиента
    - **points**: Количество начисленных/списанных баллов
    - **queued**: Транзакция в очереди (если применимо)
    - **error**: Сообщение об ошибке (если success=false)
    
    Примеры:
    
    Начисление баллов за покупку на $1000:
    ```json
    {
        "client_chat_id": "123456789",
        "partner_chat_id": "987654321",
        "txn_type": "accrual",
        "amount": 1000
    }
    ```
    
    Списание 50 баллов:
    ```json
    {
        "client_chat_id": "123456789",
        "partner_chat_id": "987654321",
        "txn_type": "spend",
        "amount": 50
    }
    ```
    """
    result = manager.execute_transaction(
        payload.client_chat_id,
        payload.partner_chat_id,
        payload.txn_type,
        payload.amount
    )

    if not result.get("success"):
        detail = result.get("error", "Неизвестная ошибка")
        raise HTTPException(status_code=400, detail=detail)

    return result


@app.post(
    "/api/redeem",
    response_model=RedeemResponse,
    tags=["transactions"],
    summary="[DEPRECATED] Обменять баллы на услугу",
    description="⚠️ DEPRECATED: Прямой обмен баллов на услуги больше не поддерживается. Используйте акции через /api/redeem-promotion",
    response_description="Результат обмена баллов",
    responses={
        400: {
            "description": "Ошибка обмена баллов",
            "content": {
                "application/json": {
                    "example": {"detail": "Прямой обмен баллов на услуги не поддерживается. Используйте акции."}
                }
            }
        }
    }
)
@limiter.limit("10/minute")
def redeem_points(request: Request, payload: RedeemRequest):
    """
    ⚠️ DEPRECATED: Прямой обмен баллов на услуги больше не поддерживается.
    
    Для обмена баллов на услуги используйте систему акций:
    1. Найдите активную акцию для услуги через getPromotionsForService()
    2. Используйте /api/redeem-promotion для обмена баллов через акцию
    
    Rate Limit: 10 запросов/минуту
    """
    raise HTTPException(
        status_code=400, 
        detail="Прямой обмен баллов на услуги не поддерживается. Используйте акции. Найдите активную акцию для услуги и используйте /api/redeem-promotion"
    )


@app.post(
    "/api/redeem-promotion",
    response_model=RedeemPromotionResponse,
    tags=["transactions"],
    summary="Подготовить обмен баллов на акцию",
    description="Подготавливает обмен баллов для акции (частичная оплата). Баллы НЕ списываются сразу - создается QR-код для мастера.",
    response_description="Результат подготовки обмена",
    responses={
        200: {
            "description": "QR-код успешно создан",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "current_balance": 150,
                        "points_to_spend": 50,
                        "points_value_usd": 50.0,
                        "service_price": 100.0,
                        "cash_payment": 50.0,
                        "qr_data": "PROMOTION:123:456789:50:50.00"
                    }
                }
            }
        },
        400: {
            "description": "Ошибка подготовки обмена",
            "content": {
                "application/json": {
                    "example": {"detail": "Недостаточно баллов"}
                }
            }
        }
    }
)
@limiter.limit("10/minute")
def redeem_promotion(request: Request, payload: RedeemPromotionRequest):
    """
    Подготовка обмена баллов на акцию (частичная оплата).
    
    Rate Limit: 10 запросов/минуту
    
    Параметры:
    - **client_chat_id**: Telegram Chat ID клиента
    - **promotion_id**: ID акции
    - **points_to_spend**: Количество баллов для оплаты
    
    Возвращает:
    - **success**: Успешность операции
    - **current_balance**: Текущий баланс клиента
    - **points_to_spend**: Количество баллов для оплаты
    - **points_value_usd**: Стоимость баллов в долларах
    - **service_price**: Полная стоимость услуги
    - **cash_payment**: Сколько нужно доплатить наличными
    - **promotion**: Информация об акции
    - **qr_data**: Данные для QR-кода (формат: PROMOTION:id:client_id:points:usd_value)
    - **error**: Сообщение об ошибке (если success=false)
    
    Пример запроса:
    ```json
    {
        "client_chat_id": "123456789",
        "promotion_id": 123,
        "points_to_spend": 50
    }
    ```
    
    **Важно:** Баллы НЕ списываются сразу. Мастер списывает их при сканировании QR-кода.
    """
    result = manager.redeem_points_for_promotion(
        payload.client_chat_id,
        payload.promotion_id,
        payload.points_to_spend
    )

    if not result.get("success"):
        detail = result.get("error", "Неизвестная ошибка")
        raise HTTPException(status_code=400, detail=detail)

    return result


# ============================================
# SENTRY WEBHOOK для уведомлений в Telegram
# ============================================

def send_telegram_alert(message: str):
    """Отправка алерта в Telegram"""
    token = os.getenv('SENTRY_ALERT_TELEGRAM_TOKEN')
    chat_id = os.getenv('SENTRY_ALERT_CHAT_ID')
    
    if not token or not chat_id:
        logger.warning("SENTRY_ALERT_TELEGRAM_TOKEN или SENTRY_ALERT_CHAT_ID не настроены")
        return False
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        'chat_id': chat_id,
        'text': message,
        'parse_mode': 'HTML',
        'disable_web_page_preview': True
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Ошибка отправки Telegram алерта: {e}")
        return False


def format_sentry_alert(data: dict) -> str:
    """Форматирование Sentry события для Telegram"""
    try:
        # Извлечение данных из Sentry webhook
        event = data.get('event', {})
        issue = data.get('issue', {})
        
        # Основная информация
        title = event.get('title') or issue.get('title', 'Unknown Error')
        culprit = event.get('culprit', 'Unknown location')
        level = event.get('level', 'error').upper()
        environment = event.get('environment', 'unknown')
        release = event.get('release', 'unknown')
        
        # URL для перехода в Sentry
        issue_url = data.get('url') or issue.get('permalink', '')
        
        # Эмодзи в зависимости от уровня
        emoji_map = {
            'FATAL': '🔥',
            'ERROR': '❌',
            'WARNING': '⚠️',
            'INFO': 'ℹ️'
        }
        emoji = emoji_map.get(level, '🚨')
        
        # Формирование сообщения
        message = f"{emoji} <b>SENTRY ALERT</b>\n\n"
        message += f"<b>{level}:</b> {title}\n\n"
        
        if culprit:
            message += f"📍 <b>Location:</b> {culprit}\n"
        
        if environment:
            message += f"🌍 <b>Environment:</b> {environment}\n"
        
        if release:
            message += f"📦 <b>Release:</b> {release}\n"
        
        # Количество событий
        if 'count' in data:
            message += f"🔢 <b>Events:</b> {data['count']}\n"
        
        if issue_url:
            message += f"\n🔗 <a href='{issue_url}'>View in Sentry</a>"
        
        return message
        
    except Exception as e:
        logger.error(f"Ошибка форматирования Sentry webhook: {e}")
        return f"🚨 <b>SENTRY ALERT</b>\n\nОшибка обработки webhook: {str(e)}"


@app.post(
    "/api/sentry-webhook",
    tags=["webhooks"],
    summary="Sentry Webhook",
    description="Получение уведомлений от Sentry и отправка в Telegram",
    response_description="Статус обработки webhook"
)
@limiter.limit("5/minute")
async def sentry_webhook(request: Request, sentry_hook_resource: Optional[str] = Header(None)):
    """
    Endpoint для получения webhook от Sentry и отправки уведомлений в Telegram.
    
    Rate Limit: 5 запросов/минуту
    
    ### Настройка в Sentry:
    1. Settings → Integrations → Webhooks
    2. Callback URL: `https://your-domain.com/api/sentry-webhook`
    3. Включить события: `issue.created`, `issue.resolved`, `issue.assigned`
    
    ### События которые обрабатываются:
    - Новая ошибка (issue.created)
    - Изменение статуса ошибки
    - Частые ошибки (spike detection)
    
    ### Формат уведомлений:
    Уведомления отправляются в Telegram в красиво отформатированном виде с:
    - Эмодзи в зависимости от уровня ошибки
    - Название и описание ошибки
    - Место возникновения (файл, строка)
    - Окружение и релиз
    - Прямая ссылка на issue в Sentry
    
    ### Безопасность:
    Опциональная проверка подписи webhook через `SENTRY_WEBHOOK_SECRET`.
    """
    try:
        # Получение тела запроса
        body = await request.json()
        
        # Опциональная проверка подписи (если настроен SENTRY_WEBHOOK_SECRET)
        webhook_secret = os.getenv('SENTRY_WEBHOOK_SECRET')
        if webhook_secret and sentry_hook_resource:
            # Verify signature
            signature = request.headers.get('sentry-hook-signature')
            if signature:
                expected = hmac.new(
                    webhook_secret.encode(),
                    await request.body(),
                    hashlib.sha256
                ).hexdigest()
                if not hmac.compare_digest(signature, expected):
                    raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Логирование для отладки
        logger.info(f"Получен Sentry webhook: {body.get('action', 'unknown')}")
        
        # Форматирование и отправка в Telegram
        message = format_sentry_alert(body)
        success = send_telegram_alert(message)
        
        return {
            "status": "ok" if success else "failed",
            "message": "Alert sent to Telegram" if success else "Failed to send alert"
        }
        
    except Exception as e:
        logger.error(f"Ошибка обработки Sentry webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ОТПРАВКА QR КОДА ПАРТНЕРУ
# ============================================

def send_qr_to_partner_via_telegram(
    partner_chat_id: str,
    qr_image_bytes: bytes,
    client_chat_id: str,
    service_title: str = ""
) -> dict:
    """Отправка QR-кода партнеру через Telegram"""
    token = os.getenv('TOKEN_PARTNER')
    
    if not token:
        logger.warning("TOKEN_PARTNER не настроен")
        return {"success": False, "error": "Telegram бот не настроен"}
    
    try:
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
        response.raise_for_status()
        
        logger.info(f"QR-код успешно отправлен партнёру {partner_chat_id} от клиента {client_chat_id}")
        return {"success": True}
        
    except requests.exceptions.HTTPError as e:
        error_msg = f"HTTP ошибка: {e.response.status_code}"
        logger.error(f"Ошибка отправки QR партнёру {partner_chat_id}: {error_msg}")
        return {"success": False, "error": error_msg}
    except Exception as e:
        error_msg = f"Ошибка отправки QR: {str(e)}"
        logger.error(f"Ошибка отправки QR партнёру {partner_chat_id}: {error_msg}")
        return {"success": False, "error": error_msg}


@app.get(
    "/api/district-availability",
    tags=["clients"],
    summary="Получить карту доступности районов",
    description="Возвращает карту доступности всех позиций (район × сфера услуг) для указанного города",
    response_description="Карта доступности позиций"
)
@limiter.limit("30/minute")
def get_district_availability(request: Request, city: str = "New York"):
    """
    Получает карту доступности всех позиций для указанного города.
    
    Параметры:
    - **city**: Город (по умолчанию "New York")
    
    Возвращает словарь, где:
    - Ключ: название района
    - Значение: словарь с ключом business_type и значением статуса ('available', 'taken', 'pending')
    
    Пример ответа:
    ```json
    {
        "Manhattan Downtown": {
            "nail_care": "taken",
            "hair_salon": "available",
            "massage": "pending"
        },
        "Brooklyn Downtown": {
            ...
        }
    }
    ```
    """
    try:
        # Определяем все районы и услуги
        districts = [
            'Manhattan Downtown',
            'Manhattan Midtown',
            'Manhattan Upper East',
            'Manhattan Upper West',
            'Brooklyn Downtown',
            'Brooklyn North',
            'Brooklyn South + S.I.',
            'Queens West + Bronx South',
            'Queens East',
            'Brooklyn Central'
        ]
        
        services = [
            'nail_care',
            'brow_design',
            'hair_salon',
            'hair_removal',
            'facial_aesthetics',
            'lash_services',
            'massage_therapy',
            'makeup_pmu',
            'body_wellness',
            'nutrition_coaching',
            'mindfulness_coaching',
            'image_consulting'
        ]
        
        # Получаем занятые позиции из базы
        occupied = manager.get_occupied_positions(city)
        
        # Формируем карту доступности
        availability = {}
        
        for district in districts:
            availability[district] = {}
            for service in services:
                key = f"{district}_{service}"
                
                if key in occupied:
                    partner_status = occupied[key].get('status', 'Pending')
                    # Маппинг статусов
                    if partner_status == 'Approved':
                        availability[district][service] = 'taken'
                    elif partner_status in ['Pending', 'Rejected']:
                        availability[district][service] = 'pending'
                    else:
                        availability[district][service] = 'available'
                else:
                    availability[district][service] = 'available'
        
        return availability
        
    except Exception as e:
        logger.error(f"Ошибка получения карты доступности для {city}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения данных: {str(e)}")


@app.post(
    "/send-qr-to-partner",
    tags=["transactions"],
    summary="Отправить QR-код партнёру",
    description="Отправляет QR-код клиента партнёру через Telegram",
    response_description="Результат отправки QR-кода",
    responses={
        200: {
            "description": "QR-код успешно отправлен",
            "content": {
                "application/json": {
                    "example": {
                        "success": True
                    }
                }
            }
        },
        400: {
            "description": "Ошибка отправки QR-кода",
            "content": {
                "application/json": {
                    "example": {"success": False, "error": "Не указан chat_id партнёра"}
                }
            }
        }
    }
)
@limiter.limit("10/minute")
async def send_qr_to_partner(
    request: Request,
    qr_image: UploadFile = File(..., description="QR-код изображение"),
    client_chat_id: str = Form(..., description="Chat ID клиента"),
    partner_chat_id: str = Form(None, description="Chat ID партнёра (если указан)"),
    partner_username: str = Form(None, description="Username партнёра из contact_link (если указан)"),
    service_title: str = Form("", description="Название услуги"),
    service_id: str = Form("", description="ID услуги")
):
    """
    Отправка QR-кода клиента партнёру через Telegram.
    
    Rate Limit: 10 запросов/минуту
    
    Параметры:
    - **qr_image**: Изображение QR-кода (PNG, JPG)
    - **client_chat_id**: Telegram Chat ID клиента
    - **partner_chat_id**: Telegram Chat ID партнёра (если указан)
    - **partner_username**: Username партнёра из contact_link (если указан, используется для поиска chat_id)
    - **service_title**: Название услуги (опционально)
    - **service_id**: ID услуги (опционально)
    
    Возвращает:
    - **success**: Успешность отправки
    - **error**: Сообщение об ошибке (если success=false)
    """
    try:
        # Читаем изображение
        image_bytes = await qr_image.read()
        
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Пустое изображение")
        
        # Определяем chat_id партнёра
        final_partner_chat_id = partner_chat_id
        
        # Если указан username, находим chat_id по username из базы данных
        if not final_partner_chat_id and partner_username:
            try:
                sm = SupabaseManager()
                # Ищем партнёра по username
                partners_response = sm.client.from_('partners').select('chat_id').eq('username', partner_username).limit(1).execute()
                
                if partners_response.data and len(partners_response.data) > 0:
                    final_partner_chat_id = partners_response.data[0]['chat_id']
                    logger.info(f"Найден chat_id {final_partner_chat_id} для username {partner_username}")
                else:
                    raise HTTPException(status_code=404, detail=f"Партнёр с username {partner_username} не найден в базе данных")
            except Exception as e:
                logger.error(f"Ошибка поиска партнёра по username {partner_username}: {e}")
                raise HTTPException(status_code=400, detail=f"Не удалось найти партнёра по username: {str(e)}")
        
        if not final_partner_chat_id:
            raise HTTPException(status_code=400, detail="Не указан chat_id или username партнёра")
        
        # Отправляем QR-код партнёру
        result = send_qr_to_partner_via_telegram(
            partner_chat_id=final_partner_chat_id,
            qr_image_bytes=image_bytes,
            client_chat_id=client_chat_id,
            service_title=service_title
        )
        
        if not result.get("success"):
            error = result.get("error", "Неизвестная ошибка")
            raise HTTPException(status_code=400, detail=error)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка обработки запроса отправки QR: {e}")
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка: {str(e)}")


# ============================================
# УВЕДОМЛЕНИЯ ПАРТНЁРАМ
# ============================================

@app.post(
    "/api/notify-partner-interest",
    response_model=PartnerNotificationResponse,
    tags=["partners"],
    summary="Уведомить партнёра о заинтересованности клиента",
    description="Отправляет уведомление партнёру о том, что клиент просматривает его карточку",
    response_description="Результат отправки уведомления",
    responses={
        200: {
            "description": "Уведомление успешно отправлено",
            "content": {
                "application/json": {
                    "example": {
                        "success": True
                    }
                }
            }
        },
        400: {
            "description": "Ошибка отправки",
            "content": {
                "application/json": {
                    "example": {"success": False, "error": "Не указан chat_id партнёра"}
                }
            }
        }
    }
)
@limiter.limit("10/minute")
async def notify_partner_interest(request: Request, payload: PartnerNotificationRequest):
    """
    Отправляет уведомление партнёру о том, что клиент просматривает его карточку.
    
    Rate Limit: 10 запросов/минуту
    
    Параметры:
    - **partner_chat_id**: Chat ID партнёра (обязательно)
    - **client_chat_id**: Chat ID клиента (обязательно)
    - **client_username**: Username клиента в Telegram (опционально)
    
    Возвращает:
    - **success**: Успешность операции
    - **error**: Сообщение об ошибке (если success=false)
    """
    try:
        token = os.getenv('TOKEN_PARTNER')
        
        if not token:
            logger.warning("TOKEN_PARTNER не настроен")
            raise HTTPException(status_code=500, detail="Telegram бот не настроен")
        
        if not payload.partner_chat_id:
            raise HTTPException(status_code=400, detail="Не указан chat_id партнёра")
        
        if not payload.client_chat_id:
            raise HTTPException(status_code=400, detail="Не указан chat_id клиента")
        
        # Формируем сообщение для партнёра
        username_text = ""
        if payload.client_username:
            username_text = f"👤 **@{payload.client_username}**"
        else:
            username_text = f"🆔 **Chat ID:** `{payload.client_chat_id}`"
        
        message = (
            f"👀 **Клиент просматривает вашу карточку**\n\n"
            f"{username_text}\n\n"
            f"Данный клиент интересовался вашими услугами."
        )
        
        # Создаём inline-кнопку для ответа клиенту
        reply_markup = {
            'inline_keyboard': [[
                {
                    'text': '💬 Написать клиенту',
                    'callback_data': f'reply_to_client_{payload.client_chat_id}'
                }
            ]]
        }
        
        # Отправляем сообщение через Telegram API
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload_data = {
            'chat_id': str(payload.partner_chat_id),
            'text': message,
            'parse_mode': 'Markdown',
            'reply_markup': reply_markup
        }
        
        response = requests.post(url, json=payload_data, timeout=10)
        response.raise_for_status()
        
        logger.info(f"Уведомление отправлено партнёру {payload.partner_chat_id} о клиенте {payload.client_chat_id}")
        return {"success": True}
        
    except requests.exceptions.HTTPError as e:
        error_msg = f"HTTP ошибка: {e.response.status_code}"
        if e.response.status_code == 403:
            error_msg = "Партнёр заблокировал бота"
        elif e.response.status_code == 400:
            error_msg = "Неверный chat_id партнёра"
        logger.error(f"Ошибка отправки уведомления партнёру {payload.partner_chat_id}: {error_msg}")
        return {"success": False, "error": error_msg}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка обработки запроса уведомления партнёру: {e}")
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка: {str(e)}")


# ============================================
# AI ПЕРЕВОД ТЕКСТА
# ============================================

@app.post(
    "/api/translate",
    response_model=TranslationResponse,
    tags=["translation"],
    summary="Перевести текст с помощью AI",
    description="Переводит текст с одного языка на другой используя OpenAI",
    response_description="Результат перевода",
    responses={
        200: {
            "description": "Текст успешно переведен",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "translated_text": "Hello, world!",
                        "original_text": "Привет, мир!",
                        "source_lang": "ru",
                        "target_lang": "en"
                    }
                }
            }
        },
        400: {
            "description": "Ошибка перевода",
            "content": {
                "application/json": {
                    "example": {"success": False, "error": "Текст не может быть пустым"}
                }
            }
        },
        429: {
            "description": "Слишком много запросов",
            "content": {
                "application/json": {
                    "example": {"detail": "Rate limit exceeded"}
                }
            }
        }
    }
)
@limiter.limit("30/minute")
async def translate_text(request: Request, payload: TranslationRequest):
    """
    Перевод текста с помощью AI (OpenAI).
    
    Rate Limit: 30 запросов/минуту
    
    Параметры:
    - **text**: Текст для перевода (обязательно)
    - **target_lang**: Целевой язык (по умолчанию 'en')
      - Поддерживаемые: ru, en, es, fr, de, it, pt, zh, ja, ko
    - **source_lang**: Исходный язык (по умолчанию 'ru')
      - Поддерживаемые: ru, en, es, fr, de, it, pt, zh, ja, ko
    
    Возвращает:
    - **success**: Успешность операции
    - **translated_text**: Переведенный текст
    - **original_text**: Оригинальный текст
    - **source_lang**: Исходный язык
    - **target_lang**: Целевой язык
    - **error**: Сообщение об ошибке (если success=false)
    
    Примеры:
    
    Перевод с русского на английский:
    ```json
    {
        "text": "Привет, мир!",
        "target_lang": "en",
        "source_lang": "ru"
    }
    ```
    
    Перевод с английского на русский:
    ```json
    {
        "text": "Hello, world!",
        "target_lang": "ru",
        "source_lang": "en"
    }
    ```
    """
    try:
        # Валидация
        if not payload.text or not payload.text.strip():
            raise HTTPException(
                status_code=400, 
                detail="Текст для перевода не может быть пустым"
            )
        
        # Если языки одинаковые, возвращаем оригинал
        if payload.source_lang == payload.target_lang:
            return TranslationResponse(
                success=True,
                translated_text=payload.text,
                original_text=payload.text,
                source_lang=payload.source_lang,
                target_lang=payload.target_lang
            )
        
        # Выполняем перевод
        translated = await translate_text_ai(
            text=payload.text,
            target_lang=payload.target_lang,
            source_lang=payload.source_lang
        )
        
        if not translated:
            raise HTTPException(
                status_code=500,
                detail="Не удалось выполнить перевод. Попробуйте позже."
            )
        
        return TranslationResponse(
            success=True,
            translated_text=translated,
            original_text=payload.text,
            source_lang=payload.source_lang,
            target_lang=payload.target_lang
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка перевода текста: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Внутренняя ошибка при переводе: {str(e)}"
        )

