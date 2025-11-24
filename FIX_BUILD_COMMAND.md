# 🔧 Исправление: uvicorn не установлен в venv

## 🔍 Проблема

В логах:
- ✅ Build successful
- ❌ `No module named uvicorn` при запуске

**Причина:** Возможно uvicorn не установлен в правильный venv, или Build Command не работает как ожидается.

---

## ✅ Решение: Убедиться что Build Command правильный

### Проверьте Build Command

В Render → Settings → Build Command должно быть:

```
pip install -r requirements.txt
```

**ИЛИ** более явная версия:

```
pip install --upgrade pip && pip install -r requirements.txt
```

---

## ✅ Альтернативное решение: Создать startup script

Если Build Command правильный, но всё равно не работает, создайте скрипт запуска.

### Шаг 1: Создайте файл `start.sh`

Создайте файл в корне проекта:

```bash
#!/bin/bash
source .venv/bin/activate
pip install -r requirements.txt
uvicorn secure_api:app --host 0.0.0.0 --port $PORT
```

### Шаг 2: Измените Start Command на:

```
chmod +x start.sh && ./start.sh
```

---

## ✅ Самое простое решение: Использовать pip install в Start Command

Измените Start Command на:

```
pip install -r requirements.txt && python3 -m uvicorn secure_api:app --host 0.0.0.0 --port $PORT
```

Это гарантирует что uvicorn установлен перед запуском.

---

## 🔧 Рекомендуемый подход

### Вариант 1: Проверьте Build Command

1. Render → Settings → Build Command
2. Убедитесь что там:
   ```
   pip install -r requirements.txt
   ```
3. Если нет - добавьте

### Вариант 2: Измените Start Command

Измените Start Command на:

```
pip install -r requirements.txt && python3 -m uvicorn secure_api:app --host 0.0.0.0 --port $PORT
```

Это установит зависимости перед запуском.

---

*Попробуйте вариант 2 - установить зависимости прямо в Start Command!*


