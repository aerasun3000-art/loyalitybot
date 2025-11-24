# 🚀 План развития проекта: Следующие шаги

**Дата:** 28 октября 2025  
**Статус:** Roadmap на 6 месяцев

---

## 🎯 ГЛАВНАЯ ИДЕЯ

**CRM интеграция - это НЕ следующий шаг!**  
Сначала нужно запустить базовый продукт и получить первых пользователей.

---

## 📅 ЭТАП 1: MVP - Запуск (0-4 недели)

### 🎯 Цель
Получить 5-10 партнёров на базовом функционале и протестировать все сценарии.

### ✅ Что уже готово
- [x] Telegram бот для партнёров
- [x] Telegram бот для клиентов  
- [x] Админский бот
- [x] Supabase база данных
- [x] Система начисления/списания баллов
- [x] Дашборды (партнёр + админ)
- [x] One-pagers (партнёр, клиент, инвестор)
- [x] NPS система
- [x] Реферальная программа

### 🔨 Что нужно доделать

#### 1. Улучшить onboarding партнёра (1 неделя)
```python
# bot.py - добавить пошаговую настройку

@bot.message_handler(commands=['setup_wizard'])
def setup_wizard(message):
    """Мастер первоначальной настройки для нового партнёра."""
    chat_id = message.chat.id
    
    bot.send_message(
        chat_id,
        "🎉 Отлично! Давайте настроим вашу программу лояльности.\n\n"
        "Я задам несколько вопросов, чтобы всё работало идеально.\n\n"
        "Шаг 1 из 5: Какой процент кэшбэка вы хотите?\n"
        "💡 Рекомендуем: 5% (стандарт для beauty-сферы)\n\n"
        "Введите число от 1 до 20:"
    )
    bot.register_next_step_handler(message, process_cashback_rate)

def process_cashback_rate(message):
    try:
        rate = float(message.text)
        if 1 <= rate <= 20:
            # Сохраняем
            sm.update_partner(message.chat.id, {'cashback_rate': rate / 100})
            
            # Следующий шаг
            bot.send_message(
                message.chat.id,
                f"✅ Кэшбэк установлен: {rate}%\n\n"
                "Шаг 2 из 5: Приветственный бонус для новых клиентов?\n"
                "💡 Рекомендуем: 100 баллов\n\n"
                "Введите количество баллов (0-500):"
            )
            bot.register_next_step_handler(message, process_welcome_bonus)
        else:
            raise ValueError
    except:
        bot.send_message(
            message.chat.id,
            "❌ Пожалуйста, введите число от 1 до 20"
        )
        bot.register_next_step_handler(message, process_cashback_rate)

# И так далее для всех настроек
```

#### 2. Добавить быстрое начисление (3 дня)
```python
# Текущий процесс: 5 кликов
# 1. Нажать "➕ Начислить баллы"
# 2. Ввести Chat ID клиента
# 3. Подтвердить клиента
# 4. Ввести сумму чека
# 5. Подтвердить начисление

# Новый процесс: 2 клика
@bot.message_handler(func=lambda m: m.text == "⚡ Быстрое начисление")
def quick_accrual(message):
    """Упрощённое начисление для частых клиентов."""
    partner_id = message.chat.id
    
    # Показываем последних 5 клиентов
    recent_clients = sm.get_recent_clients(partner_id, limit=5)
    
    keyboard = types.InlineKeyboardMarkup()
    for client in recent_clients:
        name = client.get('name', 'Клиент')
        last_visit = client.get('last_visit_date', 'Давно')
        keyboard.add(
            types.InlineKeyboardButton(
                text=f"{name} | {last_visit}",
                callback_data=f"quick_accrual_{client['chat_id']}"
            )
        )
    keyboard.add(types.InlineKeyboardButton("🔍 Найти другого", callback_data="find_client"))
    
    bot.send_message(
        partner_id,
        "⚡ Выберите клиента:",
        reply_markup=keyboard
    )

@bot.callback_query_handler(func=lambda c: c.data.startswith('quick_accrual_'))
def process_quick_accrual(call):
    client_id = call.data.replace('quick_accrual_', '')
    
    # Спрашиваем только сумму
    bot.edit_message_text(
        "💰 Введите сумму чека:",
        call.message.chat.id,
        call.message.message_id
    )
    bot.register_next_step_handler(call.message, lambda m: finalize_quick_accrual(m, client_id))
```

#### 3. Tutorial / Демо режим (3 дня)
```python
# Интерактивный туториал для нового партнёра

@bot.message_handler(commands=['tutorial'])
def start_tutorial(message):
    """Интерактивное обучение работе с ботом."""
    
    # Создаём тестового клиента
    test_client_id = f"DEMO_{message.chat.id}"
    
    bot.send_message(
        message.chat.id,
        "👋 Добро пожаловать в демо-режим!\n\n"
        "Я покажу, как работает программа лояльности.\n"
        "Все действия будут с тестовыми данными.\n\n"
        "📱 Представьте: к вам пришёл клиент Анна.\n"
        "Она сделала покупку на ₽2,000.\n\n"
        "Давайте начислим ей баллы! 👇"
    )
    
    # Показываем кнопку начисления
    keyboard = types.InlineKeyboardMarkup()
    keyboard.add(types.InlineKeyboardButton(
        "➕ Начислить баллы Анне",
        callback_data=f"demo_accrual_{test_client_id}_2000"
    ))
    
    bot.send_message(message.chat.id, "Нажмите кнопку:", reply_markup=keyboard)
```

#### 4. Шаблоны акций (1 неделя)
```python
# Готовые шаблоны акций для разных типов бизнеса

PROMOTION_TEMPLATES = {
    'beauty': [
        {
            'name': '🎂 День рождения',
            'description': 'Двойные баллы в день рождения клиента',
            'type': 'birthday',
            'multiplier': 2.0
        },
        {
            'name': '💅 Неделя красоты',
            'description': '+50% баллов на все услуги',
            'type': 'weekly',
            'multiplier': 1.5
        },
        {
            'name': '🌟 Приведи друга',
            'description': '500 баллов за каждого приглашённого друга',
            'type': 'referral',
            'bonus': 500
        }
    ],
    'food': [
        {
            'name': '☕ Счастливые часы',
            'description': 'Двойные баллы с 15:00 до 17:00',
            'type': 'happy_hours',
            'time_range': ['15:00', '17:00'],
            'multiplier': 2.0
        },
        {
            'name': '🍕 Комбо-обед',
            'description': 'При заказе от ₽1000 - бонус 100 баллов',
            'type': 'minimum_purchase',
            'min_amount': 1000,
            'bonus': 100
        }
    ]
}

@bot.message_handler(func=lambda m: m.text == "📋 Готовые акции")
def show_templates(message):
    partner_id = message.chat.id
    
    # Определяем тип бизнеса партнёра
    partner = sm.get_partner(partner_id)
    business_type = partner.get('business_type', 'beauty')
    
    templates = PROMOTION_TEMPLATES.get(business_type, PROMOTION_TEMPLATES['beauty'])
    
    keyboard = types.InlineKeyboardMarkup()
    for idx, template in enumerate(templates):
        keyboard.add(types.InlineKeyboardButton(
            text=template['name'],
            callback_data=f"use_template_{idx}"
        ))
    
    bot.send_message(
        partner_id,
        "📋 Выберите готовую акцию:\n\n"
        "Все параметры можно будет настроить перед запуском.",
        reply_markup=keyboard
    )
```

### 📊 Метрики успеха Этапа 1
```
✅ 5-10 партнёров подключено
✅ 50+ клиентов в программе
✅ 200+ транзакций проведено
✅ NPS > 8.0
✅ Retention rate > 60%
```

---

## 📅 ЭТАП 2: Улучшение UX (4-8 недель)

### 🎯 Цель
Сделать процесс начисления баллов МАКСИМАЛЬНО простым для партнёров.

### 🔨 Задачи

#### 1. QR-коды для начисления (1 неделя)

**Концепция:**
```
Партнёр генерирует QR → Клиент сканирует → 
Вводит сумму → Баллы начислены автоматически
```

**Реализация:**
```python
# qr_system.py

import qrcode
import io

@bot.message_handler(func=lambda m: m.text == "🔲 Мой QR-код")
def generate_partner_qr(message):
    partner_id = message.chat.id
    
    # Генерируем уникальную ссылку
    # Используем Telegram Mini App
    qr_url = f"https://t.me/YourBot/checkin?startapp={partner_id}"
    
    # Создаём QR-код
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Конвертируем в bytes
    bio = io.BytesIO()
    img.save(bio, 'PNG')
    bio.seek(0)
    
    bot.send_photo(
        partner_id,
        bio,
        caption=(
            "📱 Ваш персональный QR-код для начисления баллов\n\n"
            "Как использовать:\n"
            "1. Покажите этот QR-код клиенту\n"
            "2. Клиент сканирует его камерой телефона\n"
            "3. Клиент вводит сумму покупки\n"
            "4. Баллы начисляются автоматически! ✅\n\n"
            "💡 Совет: Распечатайте и поставьте на кассе"
        )
    )
```

**Frontend для клиента:**
```javascript
// Telegram Mini App - Checkin page

function CheckinPage() {
  const [partnerId, setPartnerId] = useState('');
  const [amount, setAmount] = useState('');
  
  useEffect(() => {
    // Получаем partner_id из URL
    const params = new URLSearchParams(window.location.search);
    setPartnerId(params.get('startapp'));
  }, []);
  
  const handleCheckin = async () => {
    const tg = window.Telegram.WebApp;
    const userId = tg.initDataUnsafe?.user?.id;
    
    if (!userId) {
      alert('Пожалуйста, откройте через Telegram');
      return;
    }
    
    try {
      // Отправляем запрос на начисление
      const response = await fetch('/api/accrual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: userId,
          partner_id: partnerId,
          amount: parseFloat(amount)
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        tg.showAlert(
          `✅ Начислено ${data.points} баллов!\n\n` +
          `Ваш баланс: ${data.new_balance} баллов`,
          () => tg.close()
        );
      }
    } catch (error) {
      tg.showAlert('Ошибка начисления баллов');
    }
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>💰 Введите сумму покупки</h2>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Например: 2500"
        style={{ fontSize: '24px', padding: '15px', width: '100%' }}
      />
      <button 
        onClick={handleCheckin}
        style={{ 
          marginTop: '20px', 
          padding: '15px', 
          fontSize: '18px',
          width: '100%',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '10px'
        }}
      >
        ✅ Начислить баллы
      </button>
    </div>
  );
}
```

#### 2. Голосовой ввод для начисления (1 неделя)

**Концепция:**
```
Партнёр говорит: "Начисли Анне 2000 рублей"
Бот распознаёт и выполняет
```

**Реализация:**
```python
# voice_recognition.py

from openai import OpenAI

client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

@bot.message_handler(content_types=['voice'])
def handle_voice(message):
    """Обработка голосовых команд от партнёра."""
    partner_id = message.chat.id
    
    # Скачиваем голосовое сообщение
    file_info = bot.get_file(message.voice.file_id)
    downloaded_file = bot.download_file(file_info.file_path)
    
    # Сохраняем во временный файл
    with open('temp_voice.ogg', 'wb') as f:
        f.write(downloaded_file)
    
    # Распознаём через Whisper API
    with open('temp_voice.ogg', 'rb') as audio:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio,
            language="ru"
        )
    
    text = transcript.text.lower()
    
    # Парсим команду
    if 'начисли' in text or 'начислить' in text:
        # Извлекаем сумму
        import re
        amount_match = re.search(r'(\d+)\s*(рубл|₽)', text)
        if amount_match:
            amount = int(amount_match.group(1))
            
            # Извлекаем имя клиента (если есть)
            # Простой вариант: ищем слова между "начисли" и суммой
            name_match = re.search(r'начисл[иь]\s+([а-яё\s]+)\s+\d+', text)
            
            if name_match:
                client_name = name_match.group(1).strip()
                
                # Ищем клиента по имени
                clients = sm.find_clients_by_name(partner_id, client_name)
                
                if len(clients) == 1:
                    # Начисляем автоматически
                    result = sm.execute_transaction(
                        clients[0]['chat_id'],
                        partner_id,
                        'accrual',
                        amount
                    )
                    bot.send_message(
                        partner_id,
                        f"✅ Начислено {result['points']} баллов клиенту {client_name}"
                    )
                elif len(clients) > 1:
                    # Показываем список для выбора
                    bot.send_message(
                        partner_id,
                        f"Найдено {len(clients)} клиентов с именем {client_name}. "
                        "Выберите нужного:"
                    )
                    # ... показываем кнопки
                else:
                    bot.send_message(partner_id, f"Клиент {client_name} не найден")
            else:
                bot.send_message(
                    partner_id,
                    f"💰 Сумма распознана: ₽{amount}\n"
                    "Отправьте имя или телефон клиента."
                )
    else:
        bot.send_message(
            partner_id,
            "❓ Не понял команду. Попробуйте:\n"
            "🎤 'Начисли Анне 2000 рублей'\n"
            "🎤 'Спиши у Ивана 500 баллов'"
        )
```

#### 3. Telegram Mini App - админка партнёра (2 недели)

**Полноценное веб-приложение внутри Telegram:**

```javascript
// PartnerDashboardMiniApp.jsx

import { WebApp } from '@twa-dev/sdk';

function PartnerDashboardMiniApp() {
  const [stats, setStats] = useState(null);
  const [quickClients, setQuickClients] = useState([]);
  
  useEffect(() => {
    // Инициализация Telegram Mini App
    WebApp.ready();
    WebApp.expand();
    
    // Загружаем данные
    loadDashboard();
  }, []);
  
  const loadDashboard = async () => {
    const tg = WebApp;
    const partnerId = tg.initDataUnsafe?.user?.id;
    
    const response = await fetch(`/api/partner/dashboard?id=${partnerId}`);
    const data = await response.json();
    
    setStats(data.stats);
    setQuickClients(data.recent_clients);
  };
  
  const quickAccrual = async (clientId) => {
    const amount = prompt('Введите сумму чека:');
    if (!amount) return;
    
    const response = await fetch('/api/accrual', {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId,
        partner_id: WebApp.initDataUnsafe?.user?.id,
        amount: parseFloat(amount)
      })
    });
    
    if (response.ok) {
      WebApp.showAlert('✅ Баллы начислены!');
      loadDashboard();
    }
  };
  
  return (
    <div style={{ padding: '16px' }}>
      {/* Статистика */}
      <Card>
        <h3>📊 Сегодня</h3>
        <div style={{ display: 'flex', gap: '20px' }}>
          <Stat label="Оборот" value={`₽${stats?.today_revenue || 0}`} />
          <Stat label="Транзакций" value={stats?.today_transactions || 0} />
          <Stat label="Клиентов" value={stats?.today_clients || 0} />
        </div>
      </Card>
      
      {/* Быстрое начисление */}
      <Card style={{ marginTop: '16px' }}>
        <h3>⚡ Частые клиенты</h3>
        {quickClients.map(client => (
          <div 
            key={client.id}
            style={{ 
              padding: '12px', 
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontWeight: 'bold' }}>{client.name}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Баланс: {client.balance} баллов
              </div>
            </div>
            <button
              onClick={() => quickAccrual(client.chat_id)}
              style={{
                padding: '8px 16px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px'
              }}
            >
              ➕ Начислить
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}
```

### 📊 Метрики успеха Этапа 2
```
✅ Время начисления < 30 секунд (было 2-3 минуты)
✅ 80% партнёров используют QR-коды
✅ 50% партнёров используют Mini App
✅ Удовлетворённость партнёров > 9.0
```

---

## 📅 ЭТАП 3: Масштабирование (8-12 недель)

### 🎯 Цель
Вырасти до 50-100 партнёров и оптимизировать процессы.

### 🔨 Задачи

#### 1. Партнёрская программа (2 недели)
```python
# Партнёры приглашают других партнёров

REFERRAL_REWARDS = {
    'referrer': {
        'signup_bonus': 5000,  # ₽5,000 при регистрации
        'revenue_share': 0.10   # 10% от дохода с реферала первые 6 месяцев
    },
    'referee': {
        'signup_bonus': 3000,   # ₽3,000 новому партнёру
        'first_month_free': True  # Первый месяц без комиссии
    }
}

@bot.message_handler(func=lambda m: m.text == "🤝 Пригласить партнёра")
def partner_referral(message):
    partner_id = message.chat.id
    
    # Генерируем реферальную ссылку
    ref_code = generate_referral_code(partner_id)
    ref_link = f"https://t.me/YourBot?start=partner_{ref_code}"
    
    # Статистика рефералов
    stats = sm.get_partner_referral_stats(partner_id)
    
    bot.send_message(
        partner_id,
        f"🤝 **Приглашайте партнёров и зарабатывайте!**\n\n"
        f"Ваша реферальная ссылка:\n"
        f"`{ref_link}`\n\n"
        f"**💰 Ваши бонусы:**\n"
        f"• ₽5,000 за каждого нового партнёра\n"
        f"• 10% от нашего дохода с него (6 месяцев)\n\n"
        f"**📊 Ваша статистика:**\n"
        f"• Приглашено партнёров: {stats['total_referrals']}\n"
        f"• Заработано: ₽{stats['total_earned']:,}\n"
        f"• Активных рефералов: {stats['active_referrals']}",
        parse_mode='Markdown'
    )
```

#### 2. Автоматические отчёты (1 неделя)
```python
# Еженедельные отчёты партнёрам

import schedule

def send_weekly_report(partner_id):
    """Отправляет еженедельный отчёт партнёру."""
    
    stats = sm.get_partner_weekly_stats(partner_id)
    
    # Сравнение с прошлой неделей
    prev_stats = sm.get_partner_weekly_stats(partner_id, weeks_ago=1)
    
    revenue_change = calculate_change(stats['revenue'], prev_stats['revenue'])
    clients_change = calculate_change(stats['new_clients'], prev_stats['new_clients'])
    
    # Генерируем красивый график
    chart_url = generate_revenue_chart(partner_id, period='week')
    
    bot.send_photo(
        partner_id,
        chart_url,
        caption=(
            f"📊 **Отчёт за неделю**\n\n"
            f"💰 Оборот: ₽{stats['revenue']:,} {revenue_change}\n"
            f"👥 Новых клиентов: {stats['new_clients']} {clients_change}\n"
            f"🔄 Повторных визитов: {stats['returning_clients']}\n"
            f"⭐ NPS: {stats['nps']}\n\n"
            f"**🏆 Достижения:**\n"
            f"{get_achievements(stats)}\n\n"
            f"**💡 Рекомендации:**\n"
            f"{get_recommendations(stats)}"
        ),
        parse_mode='Markdown'
    )

# Запускаем каждый понедельник в 10:00
schedule.every().monday.at("10:00").do(send_weekly_reports_to_all_partners)
```

#### 3. Сегментация и таргетинг (2 недели)
```python
# Умные рассылки клиентам на основе сегментов

@bot.message_handler(func=lambda m: m.text == "📢 Создать рассылку")
def create_campaign(message):
    partner_id = message.chat.id
    
    # Показываем сегменты
    keyboard = types.InlineKeyboardMarkup()
    keyboard.add(
        types.InlineKeyboardButton("👥 Всем клиентам", callback_data="segment_all"),
        types.InlineKeyboardButton("⭐ VIP (топ 20%)", callback_data="segment_vip")
    )
    keyboard.add(
        types.InlineKeyboardButton("😴 Спящим (30+ дней)", callback_data="segment_sleeping"),
        types.InlineKeyboardButton("🆕 Новым (< 7 дней)", callback_data="segment_new")
    )
    keyboard.add(
        types.InlineKeyboardButton("🎂 Именинникам", callback_data="segment_birthday")
    )
    
    bot.send_message(
        partner_id,
        "📢 Кому отправить сообщение?",
        reply_markup=keyboard
    )

@bot.callback_query_handler(func=lambda c: c.data.startswith('segment_'))
def process_segment(call):
    segment = call.data.replace('segment_', '')
    partner_id = call.message.chat.id
    
    # Получаем список клиентов сегмента
    clients = sm.get_clients_by_segment(partner_id, segment)
    
    bot.edit_message_text(
        f"✅ Сегмент выбран: {get_segment_name(segment)}\n"
        f"👥 Клиентов в сегменте: {len(clients)}\n\n"
        f"Введите текст сообщения:",
        call.message.chat.id,
        call.message.message_id
    )
    
    bot.register_next_step_handler(
        call.message, 
        lambda m: send_campaign(m, partner_id, clients)
    )
```

### 📊 Метрики успеха Этапа 3
```
✅ 50-100 партнёров
✅ 1,000+ клиентов
✅ ₽500K+ месячного оборота через программу
✅ 30% партнёров приходят по рефералам
```

---

## 📅 ЭТАП 4: Подготовка к CRM (12-16 недель)

### 🎯 Цель
Изучить API CRM систем и создать прототип интеграции.

### 🔨 Задачи

#### 1. Исследование рынка CRM (1 неделя)

**Создать таблицу сравнения:**

| CRM | Доля рынка | API | Webhook | Стоимость |
|-----|-----------|-----|---------|-----------|
| YCLIENTS | 40% | ✅ REST | ✅ Да | ₽0 |
| Altegio | 25% | ✅ REST | ✅ Да | ₽0 |
| MoiKlient | 15% | ✅ REST | ❌ Нет | ₽0 |
| Арника | 10% | ⚠️ Ограниченный | ❌ Нет | €50/мес |
| BeautyPro | 5% | ❌ Нет | ❌ Нет | - |

**Вывод:** Начать с YCLIENTS (самая популярная + лучший API).

#### 2. Регистрация в YCLIENTS Partner Program (1 день)

**Шаги:**
1. Зайти на https://yclients.com/developers/
2. Зарегистрироваться как партнёр
3. Создать тестовый аккаунт
4. Получить API ключи

**Получаете:**
- Тестовый салон с фейковыми данными
- Полный доступ к API
- Webhook endpoint для тестирования
- Документацию: https://yclients.docs.apiary.io/

#### 3. Изучение YCLIENTS API (1 неделя)

**Ключевые endpoints:**

```python
# yclients_api.py

import requests

class YClientsAPI:
    BASE_URL = "https://api.yclients.com/api/v1"
    
    def __init__(self, bearer_token, company_id):
        self.token = bearer_token
        self.company_id = company_id
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def get_clients(self):
        """Получить список всех клиентов."""
        url = f"{self.BASE_URL}/company/{self.company_id}/clients"
        response = requests.get(url, headers=self.headers)
        return response.json()
    
    def find_client_by_phone(self, phone):
        """Найти клиента по номеру телефона."""
        url = f"{self.BASE_URL}/company/{self.company_id}/clients/search"
        params = {"phone": phone}
        response = requests.get(url, headers=self.headers, params=params)
        return response.json()
    
    def get_records(self, start_date, end_date):
        """Получить записи (визиты) за период."""
        url = f"{self.BASE_URL}/company/{self.company_id}/records"
        params = {
            "start_date": start_date,
            "end_date": end_date
        }
        response = requests.get(url, headers=self.headers, params=params)
        return response.json()
    
    def get_visit_details(self, visit_id):
        """Получить детали визита (чек, услуги, сумма)."""
        url = f"{self.BASE_URL}/company/{self.company_id}/record/{visit_id}"
        response = requests.get(url, headers=self.headers)
        return response.json()
```

#### 4. Прототип webhook обработчика (1 неделя)

```python
# webhook_handler.py

from fastapi import FastAPI, Request
from datetime import datetime

app = FastAPI()

@app.post("/webhooks/yclients")
async def handle_yclients_webhook(request: Request):
    """
    Обрабатывает webhook от YCLIENTS.
    
    События:
    - record_created: Новая запись создана
    - record_changed: Запись изменена
    - record_deleted: Запись удалена
    - visit_completed: Визит завершён ← ГЛАВНОЕ!
    """
    
    data = await request.json()
    event_type = data.get('resource')
    
    if event_type == 'visit_completed':
        # Визит завершён - начисляем баллы!
        await process_completed_visit(data)
    
    return {"status": "ok"}

async def process_completed_visit(data):
    """Обрабатывает завершённый визит и начисляет баллы."""
    
    visit = data['data']
    
    # Извлекаем данные
    yclients_company_id = visit['company_id']
    yclients_client_id = visit['client_id']
    visit_cost = visit['cost']  # Сумма визита
    
    # Находим нашего партнёра по yclients_company_id
    partner = sm.find_partner_by_yclients_id(yclients_company_id)
    if not partner:
        logger.warning(f"Партнёр с YCLIENTS ID {yclients_company_id} не найден")
        return
    
    # Находим клиента по yclients_client_id
    # Сначала проверяем, есть ли у нас связка
    client = sm.find_client_by_yclients_id(yclients_client_id)
    
    if not client:
        # Клиента нет в нашей системе
        # Получаем данные клиента из YCLIENTS
        yclients_api = YClientsAPI(partner['yclients_token'], yclients_company_id)
        yclients_client = yclients_api.get_client(yclients_client_id)
        
        # Создаём виртуального клиента
        client_id = sm.create_virtual_client({
            'phone': yclients_client['phone'],
            'name': yclients_client['name'],
            'yclients_id': yclients_client_id
        })
        
        # Отправляем приглашение в бот
        send_invitation_to_telegram(
            yclients_client['phone'],
            partner['company_name']
        )
    else:
        client_id = client['chat_id']
    
    # Начисляем баллы
    result = sm.execute_transaction(
        client_id,
        partner['chat_id'],
        'accrual',
        visit_cost,
        source='yclients_webhook'
    )
    
    logger.info(
        f"Автоматически начислено {result['points']} баллов "
        f"клиенту {client_id} от партнёра {partner['chat_id']}"
    )
    
    # Уведомляем партнёра
    bot.send_message(
        partner['chat_id'],
        f"✅ Автоматически начислено {result['points']} баллов\n"
        f"Клиент: {yclients_client['name']}\n"
        f"Сумма визита: ₽{visit_cost}"
    )
```

#### 5. Тестирование на sandbox данных (1 неделя)

**План тестирования:**

```
1. Создать тестового клиента в YCLIENTS
2. Создать запись (визит) на тестового клиента
3. Отметить визит как завершённый
4. Проверить, что webhook пришёл
5. Проверить, что баллы начислены
6. Проверить, что клиент получил уведомление
```

### 📊 Метрики успеха Этапа 4
```
✅ API интеграция работает на тестовых данных
✅ Webhook обработчик стабильно принимает события
✅ Автоматическое начисление работает
✅ Код покрыт тестами > 80%
```

---

## 📅 ЭТАП 5: Реальная CRM интеграция (16-24 недели)

### 🎯 Цель
Запустить интеграцию с 3-5 реальными партнёрами, которые используют YCLIENTS.

### ✅ ВОТЗДЕСЬ нужен реальный партнёр с CRM!

#### Как найти:

**Вариант 1: Среди существующих партнёров**
```
1. Опросить текущих партнёров:
   "Используете ли вы CRM систему?"
   
2. Если используют YCLIENTS:
   "Хотите автоматизировать начисление баллов?"
   
3. Предложить бесплатную интеграцию в обмен на:
   - Доступ к YCLIENTS API
   - Обратную связь
   - Участие в тестировании
```

**Вариант 2: Целевой поиск**
```
1. Найти салоны в вашем городе
2. Позвонить/написать: "Вы используете YCLIENTS?"
3. Если да: предложить бесплатную программу лояльности
   с автоматической интеграцией
```

**Вариант 3: Партнёрство с YCLIENTS**
```
1. Связаться с YCLIENTS Partner Team
2. Предложить интеграцию
3. Попросить рекомендовать 3-5 салонов для пилота
4. YCLIENTS заинтересована в допродажах!
```

### 🔨 Задачи

#### 1. Онбординг партнёра с CRM (индивидуально)

```python
@bot.message_handler(commands=['connect_yclients'])
def start_yclients_integration(message):
    """Запуск процесса подключения YCLIENTS."""
    partner_id = message.chat.id
    
    bot.send_message(
        partner_id,
        "🔗 **Подключение YCLIENTS**\n\n"
        "Отлично! Сейчас подключим вашу CRM.\n\n"
        "**Что вам нужно сделать:**\n\n"
        "1️⃣ Зайдите в YCLIENTS на компьютере\n"
        "2️⃣ Откройте раздел 'Настройки' → 'API'\n"
        "3️⃣ Скопируйте ваш API ключ\n"
        "4️⃣ Отправьте его мне\n\n"
        "💡 Если нужна помощь, вот видео-инструкция:\n"
        "https://youtu.be/...",
        parse_mode='Markdown'
    )
    
    bot.register_next_step_handler(message, process_yclients_token)

def process_yclients_token(message):
    partner_id = message.chat.id
    token = message.text.strip()
    
    # Проверяем токен
    try:
        yclients = YClientsAPI(token, None)  # company_id узнаем из токена
        companies = yclients.get_my_companies()
        
        if len(companies) == 0:
            bot.send_message(partner_id, "❌ Токен недействителен. Попробуйте ещё раз.")
            return
        
        # Сохраняем интеграцию
        sm.update_partner(partner_id, {
            'integration_type': 'yclients',
            'yclients_token': token,
            'yclients_company_id': companies[0]['id'],
            'auto_accrual': True
        })
        
        # Настраиваем webhook в YCLIENTS
        setup_yclients_webhook(token, companies[0]['id'])
        
        bot.send_message(
            partner_id,
            "✅ **YCLIENTS подключен!**\n\n"
            "Теперь баллы будут начисляться автоматически "
            "после каждого завершённого визита.\n\n"
            "Вы можете продолжать начислять баллы вручную, "
            "если клиента нет в YCLIENTS.",
            parse_mode='Markdown'
        )
        
    except Exception as e:
        logger.error(f"Ошибка подключения YCLIENTS: {e}")
        bot.send_message(
            partner_id,
            "❌ Ошибка подключения. Проверьте токен и попробуйте снова."
        )
```

#### 2. Синхронизация существующих клиентов (для каждого партнёра)

```python
async def sync_existing_clients(partner_id):
    """Синхронизирует клиентов из YCLIENTS с нашей системой."""
    
    partner = sm.get_partner(partner_id)
    yclients = YClientsAPI(
        partner['yclients_token'],
        partner['yclients_company_id']
    )
    
    # Получаем всех клиентов из YCLIENTS
    yclients_clients = yclients.get_clients()
    
    # Получаем наших клиентов партнёра
    our_clients = sm.get_partner_clients(partner_id)
    
    synced = 0
    imported = 0
    
    # Пытаемся связать по телефону
    for yc_client in yclients_clients:
        phone = normalize_phone(yc_client['phone'])
        
        # Ищем в наших клиентах
        our_client = next(
            (c for c in our_clients if normalize_phone(c.get('phone')) == phone),
            None
        )
        
        if our_client:
            # Связываем
            sm.update_client(our_client['chat_id'], {
                'yclients_id': yc_client['id']
            })
            synced += 1
        else:
            # Импортируем
            sm.create_virtual_client({
                'phone': phone,
                'name': yc_client['name'],
                'yclients_id': yc_client['id'],
                'partner_id': partner_id
            })
            imported += 1
    
    # Отправляем отчёт партнёру
    bot.send_message(
        partner_id,
        f"✅ Синхронизация завершена!\n\n"
        f"🔗 Связано существующих клиентов: {synced}\n"
        f"📥 Импортировано новых: {imported}\n"
        f"👥 Всего клиентов в программе: {synced + imported}"
    )
```

#### 3. Мониторинг и поддержка (постоянно)

```python
# Ежедневная проверка здоровья интеграций

async def check_integrations_health():
    """Проверяет работоспособность всех CRM интеграций."""
    
    partners_with_crm = sm.get_partners_with_integration('yclients')
    
    for partner in partners_with_crm:
        try:
            # Проверяем доступность API
            yclients = YClientsAPI(
                partner['yclients_token'],
                partner['yclients_company_id']
            )
            yclients.get_clients(limit=1)  # Тестовый запрос
            
            # Всё ОК
            continue
            
        except Exception as e:
            # Интеграция сломалась!
            logger.error(f"YCLIENTS интеграция партнёра {partner['chat_id']} не работает: {e}")
            
            # Уведомляем партнёра
            bot.send_message(
                partner['chat_id'],
                "⚠️ Проблема с интеграцией YCLIENTS!\n\n"
                "Автоматическое начисление временно не работает.\n"
                "Пожалуйста, проверьте настройки или свяжитесь с поддержкой.\n\n"
                "Вы можете продолжать начислять баллы вручную."
            )
            
            # Уведомляем админа
            bot.send_message(
                ADMIN_CHAT_ID,
                f"⚠️ YCLIENTS интеграция партнёра {partner['company_name']} ({partner['chat_id']}) не работает!\n"
                f"Ошибка: {str(e)}"
            )

# Запускаем каждый день в 09:00
schedule.every().day.at("09:00").do(check_integrations_health)
```

### 📊 Метрики успеха Этапа 5
```
✅ 3-5 партнёров с YCLIENTS интеграцией
✅ 90%+ визитов начисляются автоматически
✅ 0 критических ошибок в продакшене
✅ NPS от партнёров с CRM > 9.5
✅ Партнёры экономят 2+ часа в неделю
```

---

## 🎯 ИТОГОВАЯ ВРЕМЕННАЯ ЛИНИЯ

```
Неделя 0-4:   ✅ MVP + первые партнёры
Неделя 4-8:   ⚡ QR-коды + Mini App + голосовой ввод
Неделя 8-12:  📈 Масштабирование до 50-100 партнёров
Неделя 12-16: 🔬 Изучение YCLIENTS API + прототип
Неделя 16-24: 🏢 Реальная интеграция с 3-5 партнёрами
```

---

## ✅ ГЛАВНЫЙ ВЫВОД

### ❌ НЕ НУЖНО:
- ❌ Сразу искать партнёра с CRM
- ❌ Начинать с интеграции
- ❌ Ждать пока найдётся идеальный кейс

### ✅ НУЖНО:
- ✅ Запустить базовый продукт СЕЙЧАС
- ✅ Найти 5-10 любых партнёров
- ✅ Отточить UX ручного режима
- ✅ Вырастить до 50-100 партнёров
- ✅ ТОГДА подключать CRM интеграцию

---

## 💡 Почему такая последовательность?

### 1. **Validation (Валидация идеи)**
```
Сначала доказать, что программа лояльности РАБОТАЕТ
Даже в ручном режиме партнёры и клиенты счастливы
```

### 2. **Feedback (Обратная связь)**
```
Узнать реальные боли партнёров
Может, CRM интеграция вообще не нужна!
Или нужна другая автоматизация
```

### 3. **Leverage (Переговорная позиция)**
```
С 50 партнёрами легче договориться с YCLIENTS о партнёрстве
YCLIENTS сами захотят интеграцию!
```

### 4. **Resources (Ресурсы)**
```
С доходом от 50 партнёров можно нанять разработчика
Или потратить больше времени на интеграцию
```

---

## 🚀 ЧТО ДЕЛАТЬ ПРЯМО СЕЙЧАС?

### Неделя 1: Подготовка к запуску
```
□ Финализировать onboarding партнёра
□ Создать красивые презентационные материалы
□ Записать демо-видео работы бота
□ Подготовить коммерческое предложение
□ Составить список потенциальных партнёров (20-30 контактов)
```

### Неделя 2: Первые продажи
```
□ Обзвонить/написать 30 потенциальных партнёров
□ Провести 10 демонстраций
□ Подключить 3-5 партнёров
□ Собрать первую обратную связь
```

### Неделя 3-4: Оптимизация
```
□ Исправить баги на основе обратной связи
□ Добавить быстрое начисление
□ Создать туториал для новых партнёров
□ Запустить реферальную программу
```

---

**Дата создания:** 28 октября 2025  
**Статус:** 🎯 ГОТОВ К ЗАПУСКУ  
**Следующий шаг:** Найти первых 5 партнёров БЕЗ CRM

