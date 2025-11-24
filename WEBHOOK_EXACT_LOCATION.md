# 🎯 Точное место Webhooks в Sentry

## ✅ Вы в правильном проекте!

Проект: **python** (ID: 4510368109297664)

---

## 📍 Где найти Webhooks

### Вариант 1: Через Alert Rules (рекомендуется)

1. В левом меню найдите:
   - **Alert Settings** (в разделе Project)
   - ИЛИ просто **Alerts** в верхнем меню

2. Перейдите по прямой ссылке:
   ```
   https://sentry.io/organizations/ghbi/projects/python/alerts/rules/
   ```

3. Нажмите **"Create Alert Rule"** или **"+ Create Alert"**

4. Настройте:
   - **When**: `An issue is first seen`
   - **Then**: `Send a notification` → выберите опцию с webhook

---

### Вариант 2: Через Integrations

1. В левом меню найдите:
   - **Settings** → **Integrations**
   - ИЛИ используйте кнопку **"Create New Integration"** вверху страницы

2. В списке интеграций найдите **Webhooks**

3. Нажмите **Configure** или **Add to Project**

---

### Вариант 3: Прямая ссылка на Webhooks

Попробуйте открыть напрямую:
```
https://sentry.io/organizations/ghbi/projects/python/settings/integrations/webhooks/
```

Или:
```
https://sentry.io/organizations/ghbi/projects/python/settings/integrations/
```
(там должен быть Webhooks в списке)

---

## 🚀 Быстрый способ

1. В левом меню прокрутите вниз до раздела **"Settings"**
2. Найдите **"Integrations"** или **"Developer Settings"**
3. Там должен быть **Webhooks**

---

## 💡 Если не видите Webhooks

В Sentry webhooks могут называться:
- **Incoming Webhooks**
- **Custom Webhooks**  
- **HTTP Integrations**
- Или настраиваются через **Alert Rules** → **Actions** → **Webhooks**

---

## ✅ Самый простой способ

1. Перейдите в **Alerts**:
   ```
   https://sentry.io/organizations/ghbi/projects/python/alerts/
   ```

2. Нажмите **"Create Alert"**

3. В разделе **"Then perform these actions"**:
   - Выберите **"Send a notification via Webhooks"**
   - Там можно указать webhook URL напрямую

---

*Попробуйте сначала Alert Settings - это самый простой способ!*


