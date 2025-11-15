import logging
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from dotenv import load_dotenv

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

app = FastAPI(
    title="Loyalty Secure API",
    description="Внутренний сервис-прокси для работы с Supabase ключом сервиса.",
    version="1.0.0"
)

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


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/clients/{client_chat_id}/balance")
def get_client_balance(client_chat_id: str):
    balance = manager.get_client_balance(client_chat_id)
    return {"client_chat_id": client_chat_id, "balance": balance}


@app.post("/transactions", response_model=TransactionResponse)
def create_transaction(payload: TransactionRequest):
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

