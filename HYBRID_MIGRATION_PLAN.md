# 🚀 Пошаговый план перехода к гибридной модели (Telegram + Web App)

**Цель:** Добавить standalone веб-версию, сохранив Telegram как основной канал  
**Срок:** 9-11 недель  
**Бюджет:** $30K-60K

---

## 📋 Обзор плана

### Фазы реализации:
1. **Подготовка Backend API** (2 недели)
2. **Изменения в базе данных** (1 неделя)
3. **Система авторизации** (2 недели)
4. **Standalone Frontend** (4-6 недель)
5. **Интеграция и тестирование** (2 недели)

---

## 📅 ФАЗА 1: Подготовка Backend API (2 недели)

### Цель: Унифицировать API для работы с обоими каналами

### Неделя 1: Рефакторинг существующего API

#### День 1-2: Анализ и планирование
- [ ] Аудит текущих endpoints в `secure_api.py`
- [ ] Документирование всех зависимостей от `chat_id`
- [ ] Создание схемы унифицированного API
- [ ] Планирование миграции endpoints

**Результат:** Документ с планом рефакторинга API

#### День 3-5: Создание унифицированного API слоя

**Файл:** `api/unified_api.py` (новый)

```python
from fastapi import FastAPI, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Union
from enum import Enum

class AuthMethod(str, Enum):
    TELEGRAM = "telegram"
    EMAIL = "email"
    PHONE = "phone"

class UserIdentifier(BaseModel):
    """Унифицированный идентификатор пользователя"""
    auth_method: AuthMethod
    identifier: str  # chat_id, email или phone
    user_id: Optional[str] = None  # Внутренний ID после авторизации

def get_user_identifier(request: Request) -> UserIdentifier:
    """
    Извлекает идентификатор пользователя из запроса.
    Поддерживает:
    - Telegram: X-Telegram-Chat-Id header
    - Email/Phone: Authorization Bearer token
    """
    # Проверяем Telegram header
    telegram_chat_id = request.headers.get("X-Telegram-Chat-Id")
    if telegram_chat_id:
        return UserIdentifier(
            auth_method=AuthMethod.TELEGRAM,
            identifier=telegram_chat_id
        )
    
    # Проверяем JWT token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        # Декодируем JWT и извлекаем user_id
        user_data = decode_jwt_token(token)
        return UserIdentifier(
            auth_method=AuthMethod.EMAIL if "@" in user_data.get("email", "") else AuthMethod.PHONE,
            identifier=user_data.get("email") or user_data.get("phone"),
            user_id=user_data.get("user_id")
        )
    
    raise HTTPException(status_code=401, detail="Authentication required")

def resolve_user_id(identifier: UserIdentifier) -> str:
    """
    Преобразует унифицированный идентификатор во внутренний user_id.
    Если user_id уже есть - возвращает его.
    Иначе ищет в БД по identifier и auth_method.
    """
    if identifier.user_id:
        return identifier.user_id
    
    # Ищем в БД
    user = sm.get_user_by_identifier(
        auth_method=identifier.auth_method,
        identifier=identifier.identifier
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user["id"]

@app.get("/api/v1/users/me")
async def get_current_user(
    identifier: UserIdentifier = Depends(get_user_identifier)
):
    """Получить информацию о текущем пользователе"""
    user_id = resolve_user_id(identifier)
    return sm.get_user_by_id(user_id)
```

**Задачи:**
- [ ] Создать `api/unified_api.py`
- [ ] Реализовать `UserIdentifier` модель
- [ ] Реализовать `get_user_identifier` dependency
- [ ] Реализовать `resolve_user_id` функцию
- [ ] Добавить JWT токен декодирование

#### День 6-7: Миграция существующих endpoints

**Файл:** `secure_api.py` (обновление)

```python
# Старый endpoint (оставляем для обратной совместимости)
@app.get("/clients/{client_chat_id}/balance")
def get_client_balance_legacy(client_chat_id: str):
    # ... существующий код ...

# Новый унифицированный endpoint
@app.get("/api/v1/users/me/balance")
async def get_user_balance(
    identifier: UserIdentifier = Depends(get_user_identifier)
):
    """Получить баланс текущего пользователя"""
    user_id = resolve_user_id(identifier)
    balance = sm.get_user_balance(user_id)
    return {"balance": balance}
```

**Задачи:**
- [ ] Создать новые унифицированные endpoints
- [ ] Сохранить старые endpoints для обратной совместимости
- [ ] Добавить версионирование API (`/api/v1/`)
- [ ] Обновить Swagger документацию

### Неделя 2: Расширение API для Web App

#### День 8-10: Endpoints для авторизации

**Файл:** `api/auth.py` (новый)

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
import jwt
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    name: str
    password: Optional[str] = None  # Опционально для phone auth

class LoginRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    otp_code: Optional[str] = None  # Для phone auth

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: str
    auth_method: str

@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """
    Регистрация нового пользователя через email или phone
    """
    # Проверяем, что указан email или phone
    if not request.email and not request.phone:
        raise HTTPException(400, "Email or phone required")
    
    # Проверяем, не существует ли уже пользователь
    existing_user = sm.get_user_by_email_or_phone(
        email=request.email,
        phone=request.phone
    )
    
    if existing_user:
        raise HTTPException(400, "User already exists")
    
    # Создаём пользователя в БД
    user_id = sm.create_user(
        email=request.email,
        phone=request.phone,
        name=request.name,
        auth_method="email" if request.email else "phone"
    )
    
    # Генерируем JWT токены
    access_token = generate_access_token(user_id, request.email or request.phone)
    refresh_token = generate_refresh_token(user_id)
    
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user_id,
        auth_method="email" if request.email else "phone"
    )

@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """
    Вход через email/phone + password или phone + OTP
    """
    # Находим пользователя
    user = sm.get_user_by_email_or_phone(
        email=request.email,
        phone=request.phone
    )
    
    if not user:
        raise HTTPException(401, "Invalid credentials")
    
    # Проверяем пароль или OTP
    if request.password:
        if not verify_password(request.password, user["password_hash"]):
            raise HTTPException(401, "Invalid password")
    elif request.otp_code:
        if not verify_otp(request.phone, request.otp_code):
            raise HTTPException(401, "Invalid OTP code")
    else:
        raise HTTPException(400, "Password or OTP required")
    
    # Генерируем токены
    access_token = generate_access_token(user["id"], request.email or request.phone)
    refresh_token = generate_refresh_token(user["id"])
    
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user["id"],
        auth_method=user["auth_method"]
    )

@router.post("/send-otp")
async def send_otp(phone: str):
    """
    Отправка OTP кода на телефон
    """
    # Генерируем 6-значный код
    otp_code = generate_otp_code()
    
    # Сохраняем в кэш (Redis) с TTL 5 минут
    redis_client.setex(f"otp:{phone}", 300, otp_code)
    
    # Отправляем SMS через Twilio/MessageBird
    sms_service.send_otp(phone, otp_code)
    
    return {"message": "OTP sent"}

@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """
    Обновление access token
    """
    # Декодируем refresh token
    payload = decode_jwt_token(refresh_token)
    
    # Генерируем новый access token
    new_access_token = generate_access_token(
        payload["user_id"],
        payload["identifier"]
    )
    
    return {"access_token": new_access_token}
```

**Задачи:**
- [ ] Создать `api/auth.py`
- [ ] Реализовать регистрацию через email/phone
- [ ] Реализовать вход через password
- [ ] Реализовать вход через OTP (SMS)
- [ ] Интегрировать SMS сервис (Twilio/MessageBird)
- [ ] Реализовать JWT токены (access + refresh)
- [ ] Добавить хеширование паролей (bcrypt)

#### День 11-12: Endpoints для восстановления пароля

```python
@router.post("/forgot-password")
async def forgot_password(email: EmailStr):
    """Отправка ссылки для восстановления пароля"""
    user = sm.get_user_by_email(email)
    if not user:
        # Не раскрываем, существует ли пользователь
        return {"message": "If email exists, reset link sent"}
    
    # Генерируем токен сброса
    reset_token = generate_reset_token(user["id"])
    
    # Отправляем email
    email_service.send_password_reset(email, reset_token)
    
    return {"message": "If email exists, reset link sent"}

@router.post("/reset-password")
async def reset_password(token: str, new_password: str):
    """Сброс пароля по токену"""
    # Проверяем токен
    user_id = verify_reset_token(token)
    if not user_id:
        raise HTTPException(400, "Invalid or expired token")
    
    # Обновляем пароль
    sm.update_user_password(user_id, new_password)
    
    return {"message": "Password reset successful"}
```

**Задачи:**
- [ ] Реализовать forgot-password endpoint
- [ ] Реализовать reset-password endpoint
- [ ] Интегрировать email сервис (SendGrid/Mailgun)
- [ ] Создать email шаблоны

#### День 13-14: Тестирование API

**Файл:** `tests/test_unified_api.py` (новый)

```python
import pytest
from fastapi.testclient import TestClient

def test_telegram_auth():
    """Тест авторизации через Telegram"""
    response = client.get(
        "/api/v1/users/me/balance",
        headers={"X-Telegram-Chat-Id": "123456789"}
    )
    assert response.status_code == 200

def test_email_auth():
    """Тест авторизации через email"""
    # Регистрация
    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "name": "Test User"}
    )
    assert register_response.status_code == 200
    token = register_response.json()["access_token"]
    
    # Использование токена
    response = client.get(
        "/api/v1/users/me/balance",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200

def test_phone_auth():
    """Тест авторизации через phone + OTP"""
    # Запрос OTP
    otp_response = client.post("/api/v1/auth/send-otp", json={"phone": "+79991234567"})
    assert otp_response.status_code == 200
    
    # Вход с OTP (мок)
    # ...
```

**Задачи:**
- [ ] Написать unit тесты для auth endpoints
- [ ] Написать integration тесты
- [ ] Протестировать обратную совместимость
- [ ] Обновить документацию API

---

## 📅 ФАЗА 2: Изменения в базе данных (1 неделя)

### Цель: Поддержка множественных методов авторизации

### Неделя 3: Миграция схемы БД

#### День 15-16: Создание миграций

**Файл:** `migrations/001_add_auth_methods.sql`

```sql
-- Добавляем поля для унифицированной авторизации
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS auth_method TEXT DEFAULT 'telegram' CHECK (auth_method IN ('telegram', 'email', 'phone')),
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Создаём индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);

-- Обновляем существующие записи
UPDATE users 
SET user_id = gen_random_uuid()
WHERE user_id IS NULL;

-- Создаём таблицу для OTP кодов
CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, expires_at) WHERE used = FALSE;

-- Создаём таблицу для refresh токенов
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- Создаём таблицу для токенов сброса пароля
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id, used);
```

**Задачи:**
- [ ] Создать SQL миграции
- [ ] Протестировать миграции на тестовой БД
- [ ] Создать rollback скрипты
- [ ] Документировать изменения

#### День 17-18: Обновление SupabaseManager

**Файл:** `supabase_manager.py` (обновление)

```python
def get_user_by_identifier(self, auth_method: str, identifier: str) -> Optional[dict]:
    """
    Универсальный метод поиска пользователя по любому идентификатору
    """
    if auth_method == "telegram":
        return self.get_user_by_chat_id(identifier)
    elif auth_method == "email":
        return self.get_user_by_email(identifier)
    elif auth_method == "phone":
        return self.get_user_by_phone(identifier)
    return None

def get_user_by_email(self, email: str) -> Optional[dict]:
    """Поиск пользователя по email"""
    result = self.client.table(USER_TABLE)\
        .select("*")\
        .eq("email", email)\
        .maybe_single()
    return result.data if result.data else None

def get_user_by_phone(self, phone: str) -> Optional[dict]:
    """Поиск пользователя по phone"""
    result = self.client.table(USER_TABLE)\
        .select("*")\
        .eq("phone", phone)\
        .maybe_single()
    return result.data if result.data else None

def create_user(self, email: Optional[str] = None, 
                phone: Optional[str] = None,
                name: str = "",
                auth_method: str = "telegram",
                chat_id: Optional[str] = None) -> str:
    """
    Создание пользователя с поддержкой разных методов авторизации
    """
    user_data = {
        "name": name,
        "auth_method": auth_method,
        "balance": 0,
        "status": "active",
        "reg_date": datetime.now().isoformat()
    }
    
    if auth_method == "telegram" and chat_id:
        user_data["chat_id"] = chat_id
    elif auth_method == "email" and email:
        user_data["email"] = email
        user_data["email_verified"] = False
    elif auth_method == "phone" and phone:
        user_data["phone"] = phone
        user_data["phone_verified"] = False
    
    result = self.client.table(USER_TABLE)\
        .insert(user_data)\
        .select("user_id")\
        .execute()
    
    return result.data[0]["user_id"] if result.data else None
```

**Задачи:**
- [ ] Добавить методы поиска по email/phone
- [ ] Обновить метод создания пользователя
- [ ] Обновить все методы, использующие chat_id
- [ ] Добавить методы работы с OTP
- [ ] Протестировать изменения

#### День 19-21: Миграция данных

**Файл:** `scripts/migrate_to_unified_auth.py`

```python
"""
Скрипт миграции существующих пользователей на унифицированную систему
"""
import asyncio
from supabase_manager import SupabaseManager

async def migrate_users():
    """Миграция пользователей"""
    sm = SupabaseManager()
    
    # Получаем всех пользователей
    users = sm.client.table("users").select("*").execute()
    
    for user in users.data:
        # Если у пользователя нет user_id - создаём
        if not user.get("user_id"):
            user_id = str(uuid.uuid4())
            sm.client.table("users")\
                .update({"user_id": user_id})\
                .eq("chat_id", user["chat_id"])\
                .execute()
        
        # Если нет auth_method - устанавливаем telegram
        if not user.get("auth_method"):
            sm.client.table("users")\
                .update({"auth_method": "telegram"})\
                .eq("chat_id", user["chat_id"])\
                .execute()
    
    print(f"Migrated {len(users.data)} users")

if __name__ == "__main__":
    asyncio.run(migrate_users())
```

**Задачи:**
- [ ] Создать скрипт миграции
- [ ] Протестировать на копии production БД
- [ ] Выполнить миграцию на production
- [ ] Проверить целостность данных

---

## 📅 ФАЗА 3: Система авторизации (2 недели)

### Цель: Реализовать полноценную систему авторизации для Web App

### Неделя 4: JWT и пароли

#### День 22-24: JWT токены

**Файл:** `auth/jwt_handler.py` (новый)

```python
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict
import os

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 часа
REFRESH_TOKEN_EXPIRE_DAYS = 30

def generate_access_token(user_id: str, identifier: str) -> str:
    """Генерация access token"""
    payload = {
        "user_id": user_id,
        "identifier": identifier,
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": datetime.utcnow(),
        "type": "access"
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def generate_refresh_token(user_id: str) -> str:
    """Генерация refresh token"""
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "iat": datetime.utcnow(),
        "type": "refresh"
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_jwt_token(token: str) -> Optional[Dict]:
    """Декодирование JWT токена"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
```

**Задачи:**
- [ ] Создать `auth/jwt_handler.py`
- [ ] Реализовать генерацию access/refresh токенов
- [ ] Реализовать декодирование токенов
- [ ] Добавить валидацию токенов
- [ ] Настроить переменные окружения

#### День 25-26: Хеширование паролей

**Файл:** `auth/password_handler.py` (новый)

```python
import bcrypt
from typing import str

def hash_password(password: str) -> str:
    """Хеширование пароля"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    """Проверка пароля"""
    return bcrypt.checkpw(
        password.encode('utf-8'),
        password_hash.encode('utf-8')
    )
```

**Задачи:**
- [ ] Создать `auth/password_handler.py`
- [ ] Реализовать хеширование паролей
- [ ] Реализовать проверку паролей
- [ ] Добавить требования к сложности пароля

### Неделя 5: SMS и Email сервисы

#### День 27-29: SMS сервис (OTP)

**Файл:** `services/sms_service.py` (новый)

```python
from twilio.rest import Client
import os
import random
import redis

class SMSService:
    def __init__(self):
        self.client = Client(
            os.getenv("TWILIO_ACCOUNT_SID"),
            os.getenv("TWILIO_AUTH_TOKEN")
        )
        self.redis_client = redis.Redis.from_url(os.getenv("REDIS_URL"))
        self.from_number = os.getenv("TWILIO_PHONE_NUMBER")
    
    def generate_otp_code(self) -> str:
        """Генерация 6-значного OTP кода"""
        return str(random.randint(100000, 999999))
    
    def send_otp(self, phone: str) -> str:
        """Отправка OTP кода на телефон"""
        # Генерируем код
        otp_code = self.generate_otp_code()
        
        # Сохраняем в Redis с TTL 5 минут
        self.redis_client.setex(
            f"otp:{phone}",
            300,  # 5 минут
            otp_code
        )
        
        # Отправляем SMS
        message = f"Ваш код подтверждения: {otp_code}. Действителен 5 минут."
        self.client.messages.create(
            body=message,
            from_=self.from_number,
            to=phone
        )
        
        return otp_code
    
    def verify_otp(self, phone: str, code: str) -> bool:
        """Проверка OTP кода"""
        stored_code = self.redis_client.get(f"otp:{phone}")
        
        if not stored_code:
            return False
        
        if stored_code.decode('utf-8') == code:
            # Удаляем код после использования
            self.redis_client.delete(f"otp:{phone}")
            return True
        
        return False
```

**Задачи:**
- [ ] Зарегистрироваться в Twilio/MessageBird
- [ ] Создать `services/sms_service.py`
- [ ] Настроить Redis для хранения OTP
- [ ] Реализовать отправку SMS
- [ ] Реализовать проверку OTP
- [ ] Протестировать на реальных номерах

#### День 30-31: Email сервис

**Файл:** `services/email_service.py` (новый)

```python
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import os
from jinja2 import Template

class EmailService:
    def __init__(self):
        self.client = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
        self.from_email = os.getenv("SENDGRID_FROM_EMAIL", "noreply@loyalitybot.com")
    
    def send_password_reset(self, email: str, reset_token: str):
        """Отправка письма для сброса пароля"""
        reset_url = f"{os.getenv('WEB_APP_URL')}/reset-password?token={reset_token}"
        
        message = Mail(
            from_email=self.from_email,
            to_emails=email,
            subject="Сброс пароля",
            html_content=self._render_reset_password_template(reset_url)
        )
        
        self.client.send(message)
    
    def send_verification_email(self, email: str, verification_token: str):
        """Отправка письма для верификации email"""
        verification_url = f"{os.getenv('WEB_APP_URL')}/verify-email?token={verification_token}"
        
        message = Mail(
            from_email=self.from_email,
            to_emails=email,
            subject="Подтвердите ваш email",
            html_content=self._render_verification_template(verification_url)
        )
        
        self.client.send(message)
    
    def _render_reset_password_template(self, reset_url: str) -> str:
        """Рендеринг шаблона для сброса пароля"""
        template = Template("""
        <html>
        <body>
            <h1>Сброс пароля</h1>
            <p>Для сброса пароля перейдите по ссылке:</p>
            <a href="{{ reset_url }}">Сбросить пароль</a>
            <p>Ссылка действительна 1 час.</p>
        </body>
        </html>
        """)
        return template.render(reset_url=reset_url)
```

**Задачи:**
- [ ] Зарегистрироваться в SendGrid/Mailgun
- [ ] Создать `services/email_service.py`
- [ ] Создать email шаблоны
- [ ] Реализовать отправку писем
- [ ] Настроить SPF/DKIM записи
- [ ] Протестировать доставку

---

## 📅 ФАЗА 4: Standalone Frontend (4-6 недель)

### Цель: Создать веб-версию без зависимости от Telegram

### Неделя 6-7: Базовая структура

#### День 32-35: Настройка проекта

**Структура:**
```
frontend-web/
├── src/
│   ├── components/
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── ForgotPassword.jsx
│   │   │   └── ResetPassword.jsx
│   ├── services/
│   │   ├── api.js          # Унифицированный API клиент
│   │   ├── auth.js         # Работа с авторизацией
│   │   └── supabase.js     # Обновлённый для работы без Telegram
│   ├── store/
│   │   └── authStore.js    # Zustand store для авторизации
│   └── utils/
│       └── apiClient.js    # HTTP клиент с JWT
```

**Файл:** `frontend-web/src/services/api.js`

```javascript
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

// Создаём axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor для добавления токена
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor для обновления токена при 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Пытаемся обновить токен
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken
          })
          localStorage.setItem('access_token', data.access_token)
          // Повторяем запрос
          error.config.headers.Authorization = `Bearer ${data.access_token}`
          return apiClient.request(error.config)
        } catch (refreshError) {
          // Если refresh не удался - разлогиниваем
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
```

**Задачи:**
- [ ] Создать структуру `frontend-web/`
- [ ] Настроить Vite/React
- [ ] Создать API клиент
- [ ] Настроить роутинг (React Router)
- [ ] Настроить state management (Zustand)

#### День 36-38: Система авторизации

**Файл:** `frontend-web/src/store/authStore.js`

```javascript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import apiClient from '../services/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      authMethod: null, // 'telegram' | 'email' | 'phone'
      
      login: async (emailOrPhone, password, otpCode = null) => {
        try {
          const response = await apiClient.post('/api/v1/auth/login', {
            email: emailOrPhone.includes('@') ? emailOrPhone : null,
            phone: !emailOrPhone.includes('@') ? emailOrPhone : null,
            password,
            otp_code: otpCode
          })
          
          const { access_token, refresh_token, user_id, auth_method } = response.data
          
          localStorage.setItem('access_token', access_token)
          localStorage.setItem('refresh_token', refresh_token)
          
          set({
            accessToken: access_token,
            refreshToken: refresh_token,
            isAuthenticated: true,
            authMethod: auth_method
          })
          
          // Загружаем данные пользователя
          await get().fetchUser()
          
          return { success: true }
        } catch (error) {
          return { 
            success: false, 
            error: error.response?.data?.detail || 'Login failed' 
          }
        }
      },
      
      register: async (emailOrPhone, name, password = null) => {
        try {
          const response = await apiClient.post('/api/v1/auth/register', {
            email: emailOrPhone.includes('@') ? emailOrPhone : null,
            phone: !emailOrPhone.includes('@') ? emailOrPhone : null,
            name,
            password
          })
          
          const { access_token, refresh_token, user_id, auth_method } = response.data
          
          localStorage.setItem('access_token', access_token)
          localStorage.setItem('refresh_token', refresh_token)
          
          set({
            accessToken: access_token,
            refreshToken: refresh_token,
            isAuthenticated: true,
            authMethod: auth_method
          })
          
          await get().fetchUser()
          
          return { success: true }
        } catch (error) {
          return { 
            success: false, 
            error: error.response?.data?.detail || 'Registration failed' 
          }
        }
      },
      
      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          authMethod: null
        })
      },
      
      fetchUser: async () => {
        try {
          const response = await apiClient.get('/api/v1/users/me')
          set({ user: response.data })
        } catch (error) {
          console.error('Failed to fetch user:', error)
        }
      },
      
      sendOTP: async (phone) => {
        try {
          await apiClient.post('/api/v1/auth/send-otp', { phone })
          return { success: true }
        } catch (error) {
          return { 
            success: false, 
            error: error.response?.data?.detail || 'Failed to send OTP' 
          }
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        authMethod: state.authMethod
      })
    }
  )
)

export default useAuthStore
```

**Задачи:**
- [ ] Создать auth store
- [ ] Реализовать login/register
- [ ] Реализовать logout
- [ ] Добавить сохранение состояния
- [ ] Создать защищённые роуты

### Неделя 8-9: Страницы авторизации

#### День 39-42: Login/Register страницы

**Файл:** `frontend-web/src/pages/auth/Login.jsx`

```javascript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

function Login() {
  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [useOTP, setUseOTP] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const navigate = useNavigate()
  const { login, sendOTP } = useAuthStore()
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      if (useOTP && !otpSent) {
        // Отправляем OTP
        const result = await sendOTP(emailOrPhone)
        if (result.success) {
          setOtpSent(true)
        } else {
          setError(result.error)
        }
      } else {
        // Вход
        const result = await login(emailOrPhone, password, otpCode)
        if (result.success) {
          navigate('/')
        } else {
          setError(result.error)
        }
      }
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <h2 className="text-3xl font-bold text-center">Вход</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Email или телефон"
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg"
          />
          
          {!useOTP && (
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border rounded-lg"
            />
          )}
          
          {useOTP && otpSent && (
            <input
              type="text"
              placeholder="Код из SMS"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              required
              className="w-full px-4 py-2 border rounded-lg"
            />
          )}
          
          {error && <div className="text-red-500">{error}</div>}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
          >
            {loading ? 'Загрузка...' : (useOTP && !otpSent ? 'Отправить код' : 'Войти')}
          </button>
        </form>
        
        <div className="text-center">
          <button
            onClick={() => setUseOTP(!useOTP)}
            className="text-blue-500"
          >
            {useOTP ? 'Войти с паролем' : 'Войти по SMS'}
          </button>
        </div>
        
        <div className="text-center">
          <a href="/forgot-password" className="text-blue-500">
            Забыли пароль?
          </a>
        </div>
      </div>
    </div>
  )
}

export default Login
```

**Задачи:**
- [ ] Создать страницу Login
- [ ] Создать страницу Register
- [ ] Создать страницу ForgotPassword
- [ ] Создать страницу ResetPassword
- [ ] Добавить валидацию форм
- [ ] Добавить обработку ошибок

### Неделя 10-11: Адаптация существующих страниц

#### День 43-49: Обновление компонентов

**Основные изменения:**

1. **Убрать зависимости от Telegram SDK**
   - Удалить `getChatId()`, `getTelegramUser()`
   - Использовать данные из auth store

2. **Обновить API вызовы**
   - Заменить прямые вызовы Supabase на унифицированный API
   - Использовать `/api/v1/users/me/*` endpoints

3. **Адаптировать навигацию**
   - Добавить кнопку "Выйти"
   - Показывать email/phone вместо chat_id

**Пример обновления:**

**Было:**
```javascript
const chatId = getChatId()
const balance = await getClientBalance(chatId)
```

**Стало:**
```javascript
const { user } = useAuthStore()
const response = await apiClient.get('/api/v1/users/me/balance')
const balance = response.data.balance
```

**Задачи:**
- [ ] Обновить все страницы (Home, Services, History, Profile)
- [ ] Убрать зависимости от Telegram SDK
- [ ] Обновить API вызовы
- [ ] Адаптировать UI для веб-версии
- [ ] Добавить обработку ошибок авторизации

---

## 📅 ФАЗА 5: Интеграция и тестирование (2 недели)

### Цель: Объединить оба канала и протестировать

### Неделя 12: Интеграция

#### День 50-52: Определение канала

**Файл:** `frontend/src/utils/channelDetector.js` (новый)

```javascript
/**
 * Определяет, из какого канала открыто приложение
 */
export const detectChannel = () => {
  // Проверяем Telegram
  if (window.Telegram?.WebApp) {
    return {
      channel: 'telegram',
      user: window.Telegram.WebApp.initDataUnsafe?.user,
      chatId: window.Telegram.WebApp.initDataUnsafe?.user?.id?.toString()
    }
  }
  
  // Проверяем веб-версию
  if (localStorage.getItem('access_token')) {
    return {
      channel: 'web',
      token: localStorage.getItem('access_token')
    }
  }
  
  // Не авторизован
  return {
    channel: 'unknown'
  }
}

/**
 * Универсальный способ получения идентификатора пользователя
 */
export const getUserId = () => {
  const channel = detectChannel()
  
  if (channel.channel === 'telegram') {
    return channel.chatId
  }
  
  if (channel.channel === 'web') {
    // Декодируем JWT и извлекаем user_id
    const token = channel.token
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.user_id
  }
  
  return null
}
```

**Задачи:**
- [ ] Создать детектор канала
- [ ] Обновить все компоненты для работы с обоими каналами
- [ ] Добавить условную логику для разных каналов

#### День 53-54: Обновление API клиента

**Файл:** `frontend/src/services/apiClient.js` (обновление)

```javascript
import { detectChannel } from '../utils/channelDetector'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL
})

// Добавляем заголовки в зависимости от канала
apiClient.interceptors.request.use((config) => {
  const channel = detectChannel()
  
  if (channel.channel === 'telegram') {
    // Для Telegram добавляем chat_id в заголовок
    config.headers['X-Telegram-Chat-Id'] = channel.chatId
  } else if (channel.channel === 'web') {
    // Для Web добавляем JWT токен
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  
  return config
})
```

**Задачи:**
- [ ] Обновить API клиент для поддержки обоих каналов
- [ ] Протестировать запросы из обоих каналов
- [ ] Убедиться в обратной совместимости

### Неделя 13: Тестирование

#### День 55-56: Unit тесты

**Задачи:**
- [ ] Написать тесты для auth endpoints
- [ ] Написать тесты для унифицированного API
- [ ] Написать тесты для frontend компонентов
- [ ] Покрытие кода > 70%

#### День 57-59: Integration тесты

**Сценарии для тестирования:**

1. **Регистрация через Telegram**
   - Открыть бота
   - Нажать "Открыть приложение"
   - Проверить авторизацию

2. **Регистрация через Web**
   - Открыть веб-версию
   - Зарегистрироваться через email
   - Проверить авторизацию

3. **Переключение между каналами**
   - Зарегистрироваться в Telegram
   - Войти в веб-версию с тем же email
   - Проверить, что данные синхронизированы

4. **Транзакции**
   - Создать транзакцию из Telegram
   - Проверить баланс в Web
   - Создать транзакцию из Web
   - Проверить баланс в Telegram

**Задачи:**
- [ ] Протестировать все сценарии
- [ ] Исправить найденные баги
- [ ] Документировать результаты

#### День 60-61: Production deployment

**Задачи:**
- [ ] Настроить production окружение
- [ ] Выполнить миграции БД
- [ ] Задеплоить backend API
- [ ] Задеплоить standalone frontend
- [ ] Настроить мониторинг
- [ ] Провести smoke тесты

---

## 📊 Чеклист готовности

### Backend
- [ ] Унифицированный API работает
- [ ] Auth endpoints реализованы
- [ ] JWT токены работают
- [ ] SMS/Email сервисы настроены
- [ ] Миграции БД выполнены
- [ ] Тесты написаны и проходят

### Frontend
- [ ] Standalone версия работает
- [ ] Страницы авторизации готовы
- [ ] Все страницы адаптированы
- [ ] API клиент поддерживает оба канала
- [ ] Обработка ошибок реализована
- [ ] Тесты написаны

### Инфраструктура
- [ ] Production окружение настроено
- [ ] SMS сервис подключен
- [ ] Email сервис подключен
- [ ] Redis настроен
- [ ] Мониторинг настроен
- [ ] Backup стратегия определена

### Документация
- [ ] API документация обновлена
- [ ] Инструкции для пользователей готовы
- [ ] Миграционный план документирован
- [ ] Troubleshooting guide создан

---

## 💰 Оценка ресурсов

### Команда:
- **Backend разработчик:** 1 человек, 8 недель
- **Frontend разработчик:** 1 человек, 6 недель
- **DevOps инженер:** 0.5 человека, 2 недели
- **QA инженер:** 0.5 человека, 2 недели

### Инфраструктура (ежемесячно):
- **SMS сервис (Twilio):** $50-200
- **Email сервис (SendGrid):** $20-100
- **Redis (Upstash):** $10-50
- **Дополнительный сервер:** $50-200

### Итого:
- **Разработка:** $30K-60K
- **Инфраструктура (первый год):** $1.5K-6K

---

## ⚠️ Риски и митигация

### Риск 1: Сложность синхронизации данных
**Митигация:** Использовать единый источник истины (БД), унифицированный API

### Риск 2: Проблемы с SMS доставкой
**Митигация:** Использовать проверенного провайдера, добавить fallback на email

### Риск 3: Высокая нагрузка на API
**Митигация:** Добавить rate limiting, кэширование, горизонтальное масштабирование

### Риск 4: Проблемы с миграцией данных
**Митигация:** Тщательное тестирование на копии production БД, rollback план

---

## 🎯 Критерии успеха

1. ✅ Пользователи могут регистрироваться через Telegram и Web
2. ✅ Данные синхронизируются между каналами
3. ✅ Все существующие функции работают в обоих каналах
4. ✅ Нет регрессий в Telegram версии
5. ✅ Web версия имеет все основные функции
6. ✅ Производительность API не ухудшилась
7. ✅ Тесты покрывают > 70% кода

---

**Дата создания плана:** Декабрь 2024  
**Версия:** 1.0


