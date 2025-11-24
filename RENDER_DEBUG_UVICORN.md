# 🔧 Отладка проблемы с uvicorn на Render

## 🔍 Проблема

Даже после активации venv uvicorn не найден. Это означает что:
- Либо venv в другом месте
- Либо uvicorn не установлен в venv
- Либо нужно использовать python3 -m uvicorn

---

## ✅ Решение 1: python3 -m uvicorn после активации venv

### Измените Start Command на:

```
source .venv/bin/activate && python3 -m uvicorn secure_api:app --host 0.0.0.0 --port $PORT
```

---

## ✅ Решение 2: Проверить где venv и использовать полный путь

### Измените Start Command на:

```
.venv/bin/python -m uvicorn secure_api:app --host 0.0.0.0 --port $PORT
```

Или если venv в другом месте:

```
/opt/render/project/src/.venv/bin/python -m uvicorn secure_api:app --host 0.0.0.0 --port $PORT
```

---

## ✅ Решение 3: Установить uvicorn явно перед запуском

### Измените Start Command на:

```
source .venv/bin/activate && pip install uvicorn && uvicorn secure_api:app --host 0.0.0.0 --port $PORT
```

---

## ✅ Решение 4: Использовать python3 напрямую без venv

### Измените Start Command на:

```
pip install -r requirements.txt && python3 -m uvicorn secure_api:app --host 0.0.0.0 --port $PORT
```

---

## 🎯 Рекомендация

**Попробуйте Решение 1** - это должно сработать:

```
source .venv/bin/activate && python3 -m uvicorn secure_api:app --host 0.0.0.0 --port $PORT
```

Если не работает, попробуйте **Решение 2**:

```
.venv/bin/python -m uvicorn secure_api:app --host 0.0.0.0 --port $PORT
```

---

*Попробуйте python3 -m uvicorn после активации venv!*

