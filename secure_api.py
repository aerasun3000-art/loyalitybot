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

