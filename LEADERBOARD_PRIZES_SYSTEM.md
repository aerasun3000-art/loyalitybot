# 🏆 Система лидерборда и призов

**Дата:** 18 ноября 2025  
**Интеграция:** Гибридная модель промоутеров + MLM система

---

## 🎯 КОНЦЕПЦИЯ

### Цель
Создать соревновательную систему с призами для лучших промоутеров:
1. **Лидерборды** по периодам (месяц, квартал, год)
2. **Призы** для топ-лидеров
3. **Мотивация** через конкурсы и соревнования

---

## 📊 МЕХАНИКА ОПРЕДЕЛЕНИЯ ЛИДЕРОВ

### Метрики для рейтинга

**Базовые метрики:**
1. **Баллы за рефералов** (MLM система)
   - Регистрации: 100/25/10 баллов (1/2/3 уровень)
   - Транзакции: 8%/4%/2% от баллов рефералов
   - Достижения: 200/500/1500/3000 баллов

2. **Баллы за UGC контент** (Промоутеры)
   - Публикации: 80-150 баллов (зависит от платформы)
   - Качество: +50-100 баллов
   - Вирусность: +50% (100+ лайков)
   - Регулярность: +25% (4+ публикации/месяц)

3. **Бонусные метрики** (для промоутеров)
   - Активность рефералов: +10% если >5 активных
   - Конверсия контента: +5% если >10% конверсия в рефералов
   - Виральность: +20% за каждый вирусный пост

### Формула рейтинга

```
Общий рейтинг = 
  Баллы за рефералов × 1.0 +
  Баллы за UGC × 1.2 +
  Бонусные баллы × 1.5
```

**Пример:**
```
Промоутер:
- Рефералы: 500 баллов
- UGC: 300 баллов
- Бонусы: 100 баллов

Рейтинг = (500 × 1.0) + (300 × 1.2) + (100 × 1.5) = 1010 очков
```

---

## 🏆 СИСТЕМА ПРИЗОВ

### Типы периодов

1. **Ежемесячный конкурс** (каждый месяц)
   - Призы: Меньше, но чаще
   - Приоритет: Активность

2. **Квартальный конкурс** (раз в квартал)
   - Призы: Средние
   - Приоритет: Стабильность

3. **Годовой конкурс** (раз в год)
   - Призы: Максимальные (MacBook, iPhone)
   - Приоритет: Долгосрочная активность

### Примеры призов

#### Ежемесячный конкурс
- 🥇 1 место: AirPods Pro или 5,000 баллов
- 🥈 2 место: Apple Watch или 3,000 баллов
- 🥉 3 место: Подарочная карта $2,000 или 2,000 баллов
- 🏅 4-10 места: 1,000 баллов

#### Квартальный конкурс
- 🥇 1 место: iPad или 15,000 баллов
- 🥈 2 место: iPhone 15 или 10,000 баллов
- 🥉 3 место: AirPods Max или 7,000 баллов
- 🏅 4-10 места: 3,000 баллов

#### Годовой конкурс
- 🥇 1 место: MacBook Air или 50,000 баллов
- 🥈 2 место: iPhone 15 Pro или 30,000 баллов
- 🥉 3 место: iPad Pro или 20,000 баллов
- 🏅 4-10 места: 10,000 баллов

---

## 🗄️ ТЕХНИЧЕСКАЯ РЕАЛИЗАЦИЯ

### Новая таблица: `leaderboard_periods`

```sql
CREATE TABLE leaderboard_periods (
    id SERIAL PRIMARY KEY,
    period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
    period_name TEXT NOT NULL, -- "Ноябрь 2025", "Q4 2025", "2025"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('upcoming', 'active', 'completed', 'rewards_distributed')),
    prizes_config JSONB, -- Конфигурация призов
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    rewards_distributed_at TIMESTAMP
);

CREATE INDEX idx_period_type ON leaderboard_periods(period_type);
CREATE INDEX idx_period_status ON leaderboard_periods(status);
CREATE INDEX idx_period_dates ON leaderboard_periods(start_date, end_date);
```

**Пример `prizes_config`:**
```json
{
  "1": {
    "type": "physical",
    "name": "MacBook Air",
    "alternative_points": 50000,
    "description": "MacBook Air M2"
  },
  "2": {
    "type": "physical",
    "name": "iPhone 15 Pro",
    "alternative_points": 30000,
    "description": "iPhone 15 Pro 256GB"
  },
  "3": {
    "type": "physical",
    "name": "iPad Pro",
    "alternative_points": 20000,
    "description": "iPad Pro 11\" M2"
  },
  "4-10": {
    "type": "points",
    "points": 10000,
    "description": "10,000 баллов"
  }
}
```

### Новая таблица: `leaderboard_rankings`

```sql
CREATE TABLE leaderboard_rankings (
    id SERIAL PRIMARY KEY,
    period_id INTEGER NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    client_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    total_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
    referral_points NUMERIC(10, 2) DEFAULT 0,
    ugc_points NUMERIC(10, 2) DEFAULT 0,
    bonus_points NUMERIC(10, 2) DEFAULT 0,
    final_rank INTEGER,
    prize_earned TEXT, -- Описание приза
    prize_type TEXT, -- 'physical', 'points', 'none'
    prize_distributed BOOLEAN DEFAULT false,
    prize_distributed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(period_id, client_chat_id)
);

CREATE INDEX idx_rankings_period ON leaderboard_rankings(period_id);
CREATE INDEX idx_rankings_client ON leaderboard_rankings(client_chat_id);
CREATE INDEX idx_rankings_score ON leaderboard_rankings(period_id, total_score DESC);
CREATE INDEX idx_rankings_rank ON leaderboard_rankings(period_id, final_rank);
```

### Новая таблица: `leaderboard_metrics`

```sql
CREATE TABLE leaderboard_metrics (
    id SERIAL PRIMARY KEY,
    period_id INTEGER NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    client_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL, -- 'referral_registration', 'referral_transaction', 'ugc_publication', 'ugc_viral', 'achievement'
    metric_value NUMERIC(10, 2) NOT NULL,
    description TEXT,
    related_id INTEGER, -- ID связанной записи (referral_rewards, ugc_content, etc.)
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_metrics_period_client ON leaderboard_metrics(period_id, client_chat_id);
CREATE INDEX idx_metrics_type ON leaderboard_metrics(metric_type);
```

### Новая таблица: `prize_distributions`

```sql
CREATE TABLE prize_distributions (
    id SERIAL PRIMARY KEY,
    period_id INTEGER NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    client_chat_id TEXT NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    prize_type TEXT NOT NULL CHECK (prize_type IN ('physical', 'points', 'gift_card')),
    prize_name TEXT NOT NULL,
    prize_value NUMERIC(10, 2), -- Стоимость приза в баллах/рублях
    points_awarded INTEGER, -- Если приз в баллах
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'shipped', 'delivered', 'points_distributed')),
    delivery_address TEXT,
    tracking_number TEXT,
    notes TEXT,
    distributed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_distributions_period ON prize_distributions(period_id);
CREATE INDEX idx_distributions_client ON prize_distributions(client_chat_id);
CREATE INDEX idx_distributions_status ON prize_distributions(status);
```

### Обновление существующих таблиц

```sql
-- Обновление promoters
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS total_leaderboard_points NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS best_rank INTEGER;
ALTER TABLE promoters ADD COLUMN IF NOT EXISTS prizes_won INTEGER DEFAULT 0;

-- Обновление users
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_leaderboard_points NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS leaderboard_wins INTEGER DEFAULT 0;
```

---

## 🔧 МЕТОДЫ ДЛЯ РАСЧЁТА РЕЙТИНГА

### Метод 1: Подсчёт очков за рефералов

```python
def calculate_referral_points(client_chat_id, period_start, period_end):
    """
    Подсчитывает баллы за рефералов за период
    """
    # Получаем все реферальные награды за период
    rewards = get_referral_rewards(client_chat_id, period_start, period_end)
    
    total_points = 0
    for reward in rewards:
        if reward['reward_type'] == 'registration':
            # Регистрации учитываются полностью
            total_points += reward['points']
        elif reward['reward_type'] == 'transaction':
            # Транзакции учитываются полностью
            total_points += reward['points']
        elif reward['reward_type'] == 'achievement':
            # Достижения учитываются полностью
            total_points += reward['points']
    
    return total_points
```

### Метод 2: Подсчёт очков за UGC

```python
def calculate_ugc_points(client_chat_id, period_start, period_end):
    """
    Подсчитывает баллы за UGC контент за период
    """
    # Получаем одобренные публикации за период
    publications = get_approved_ugc_content(client_chat_id, period_start, period_end)
    
    total_points = 0
    for publication in publications:
        base_points = publication['reward_points']
        
        # Бонус за вирусность
        if publication['likes_count'] >= 100:
            base_points *= 1.5
        
        # Бонус за качество (если есть оценка модератора)
        if publication.get('quality_score', 0) >= 8:
            base_points += 50
        
        total_points += base_points
    
    # Бонус за регулярность (4+ публикации в месяц)
    if len(publications) >= 4:
        total_points *= 1.25
    
    return total_points
```

### Метод 3: Бонусные очки

```python
def calculate_bonus_points(client_chat_id, period_start, period_end):
    """
    Подсчитывает бонусные очки
    """
    bonus = 0
    
    # Бонус за активность рефералов
    active_referrals = get_active_referrals_count(client_chat_id, period_start, period_end)
    if active_referrals >= 5:
        referral_points = calculate_referral_points(client_chat_id, period_start, period_end)
        bonus += referral_points * 0.10  # +10%
    
    # Бонус за конверсию контента
    ugc_count = get_ugc_count(client_chat_id, period_start, period_end)
    referrals_from_ugc = get_referrals_from_ugc(client_chat_id, period_start, period_end)
    if ugc_count > 0:
        conversion_rate = (referrals_from_ugc / ugc_count) * 100
        if conversion_rate >= 10:
            ugc_points = calculate_ugc_points(client_chat_id, period_start, period_end)
            bonus += ugc_points * 0.05  # +5%
    
    # Бонус за вирусные посты
    viral_posts = get_viral_posts_count(client_chat_id, period_start, period_end, min_likes=100)
    if viral_posts >= 1:
        bonus += viral_posts * 50  # +50 баллов за каждый вирусный пост
    
    return bonus
```

### Метод 4: Расчёт общего рейтинга

```python
def calculate_total_leaderboard_score(client_chat_id, period_start, period_end):
    """
    Рассчитывает общий рейтинг для лидерборда
    """
    referral_points = calculate_referral_points(client_chat_id, period_start, period_end)
    ugc_points = calculate_ugc_points(client_chat_id, period_start, period_end)
    bonus_points = calculate_bonus_points(client_chat_id, period_start, period_end)
    
    # Формула рейтинга
    total_score = (
        referral_points * 1.0 +
        ugc_points * 1.2 +
        bonus_points * 1.5
    )
    
    return {
        'total_score': round(total_score, 2),
        'referral_points': round(referral_points, 2),
        'ugc_points': round(ugc_points, 2),
        'bonus_points': round(bonus_points, 2)
    }
```

---

## 🎯 АВТОМАТИЗАЦИЯ ПРОЦЕССОВ

### 1. Создание периода

```python
def create_leaderboard_period(period_type, start_date, end_date, prizes_config):
    """
    Создаёт новый период конкурса
    """
    period_name = generate_period_name(period_type, start_date)
    
    period = {
        'period_type': period_type,
        'period_name': period_name,
        'start_date': start_date,
        'end_date': end_date,
        'status': 'upcoming',
        'prizes_config': prizes_config
    }
    
    return create_period(period)
```

### 2. Обновление рейтингов

```python
def update_leaderboard_rankings(period_id):
    """
    Обновляет рейтинги всех участников за период
    Вызывается раз в день или при значительных изменениях
    """
    period = get_period(period_id)
    if not period or period['status'] != 'active':
        return
    
    # Получаем всех промоутеров/активных пользователей
    participants = get_all_promoters()
    
    for participant in participants:
        scores = calculate_total_leaderboard_score(
            participant['chat_id'],
            period['start_date'],
            period['end_date']
        )
        
        # Сохраняем или обновляем рейтинг
        upsert_leaderboard_ranking(
            period_id=period_id,
            client_chat_id=participant['chat_id'],
            **scores
        )
    
    # Пересчитываем ранги
    recalculate_ranks(period_id)
```

### 3. Определение победителей

```python
def finalize_leaderboard_period(period_id):
    """
    Финализирует период и определяет победителей
    """
    period = get_period(period_id)
    if not period or period['status'] != 'active':
        return False
    
    # Обновляем рейтинги в последний раз
    update_leaderboard_rankings(period_id)
    
    # Получаем топ-10
    top_10 = get_top_rankings(period_id, limit=10)
    
    # Определяем призы
    prizes_config = period['prizes_config']
    
    for ranking in top_10:
        rank = ranking['final_rank']
        prize_config = get_prize_for_rank(prizes_config, rank)
        
        if prize_config:
            create_prize_distribution(
                period_id=period_id,
                client_chat_id=ranking['client_chat_id'],
                rank=rank,
                prize_type=prize_config['type'],
                prize_name=prize_config['name'],
                prize_value=prize_config.get('alternative_points', 0)
            )
    
    # Обновляем статус периода
    update_period_status(period_id, 'completed')
    
    return True
```

### 4. Распределение призов

```python
def distribute_prizes(period_id):
    """
    Распределяет призы победителям
    """
    period = get_period(period_id)
    if period['status'] != 'completed':
        return False
    
    distributions = get_pending_prize_distributions(period_id)
    
    for distribution in distributions:
        if distribution['prize_type'] == 'points':
            # Начисляем баллы
            points = distribution['prize_value']
            award_points(distribution['client_chat_id'], points, 
                        description=f"Приз за {distribution['rank']} место в {period['period_name']}")
            
            update_distribution_status(distribution['id'], 'points_distributed')
            
        elif distribution['prize_type'] == 'physical':
            # Отправляем запрос на доставку физического приза
            notify_admin_for_shipping(distribution)
            update_distribution_status(distribution['id'], 'approved')
    
    update_period_status(period_id, 'rewards_distributed')
    return True
```

---

## 📊 UI/UX КОМПОНЕНТЫ

### 1. Лидерборд на странице промоутеров

```jsx
// Компонент Leaderboard
<LeaderboardView>
  <PeriodSelector>
    - Текущий период
    - Прошлые периоды
  </PeriodSelector>
  
  <TopThree>
    🥇 1 место: Имя, Фото, Очки
    🥈 2 место: Имя, Фото, Очки
    🥉 3 место: Имя, Фото, Очки
  </TopThree>
  
  <FullRanking>
    - Ранг
    - Имя
    - Очки
    - Приз (если в топ-10)
  </FullRanking>
  
  <UserRank>
    - Ваше место
    - Ваши очки
    - До следующего места: XXX очков
  </UserRank>
</LeaderboardView>
```

### 2. Уведомления победителям

```
🎉 Поздравляем! Вы заняли 1 место в конкурсе "Ноябрь 2025"!

🏆 Ваш приз: MacBook Air M2

📊 Ваши результаты:
• Рефералы: 1,250 очков
• UGC контент: 680 очков
• Бонусы: 150 очков
• Итого: 2,080 очков

🎁 Для получения приза, пожалуйста, укажите адрес доставки:
/prize_delivery [адрес]
```

---

## 🔄 ИНТЕГРАЦИЯ С СУЩЕСТВУЮЩИМИ СИСТЕМАМИ

### 1. С MLM системой

- **Связь:** `referral_rewards` → `leaderboard_metrics`
- **Триггер:** При начислении реферальных бонусов → запись в `leaderboard_metrics`
- **Период:** Автоматическое определение текущего активного периода

### 2. С системой промоутеров

- **Связь:** `ugc_content` → `leaderboard_metrics`
- **Триггер:** При одобрении UGC контента → запись в `leaderboard_metrics`
- **Бонусы:** Учитываются вирусность и качество

### 3. С NPS системой

- **Связь:** `nps_ratings` (оценка 10) → статус промоутера
- **Триггер:** При оценке 10 → автоматическое приглашение стать промоутером

---

## 📅 ПЕРИОДЫ И РАСПИСАНИЕ

### Ежемесячные конкурсы

```
Период: 1-е число месяца → последний день месяца
Расчёт рейтингов: Каждый день в 00:00 UTC
Финализация: 1-го числа следующего месяца в 00:00 UTC
Распределение призов: 1-3 число следующего месяца
```

### Квартальные конкурсы

```
Q1: Январь-Март
Q2: Апрель-Июнь
Q3: Июль-Сентябрь
Q4: Октябрь-Декабрь

Финализация: 1-го числа первого месяца квартала
Распределение призов: 1-5 число
```

### Годовые конкурсы

```
Период: 1 января → 31 декабря
Финализация: 1 января следующего года
Распределение призов: Январь (весь месяц)
```

---

## 🎁 УПРАВЛЕНИЕ ПРИЗАМИ

### Типы призов

1. **Физические призы:**
   - MacBook Air
   - iPhone
   - iPad
   - AirPods
   - Apple Watch

2. **Баллы:**
   - Альтернатива физическим призам
   - Мгновенное начисление
   - Использование в системе

3. **Подарочные карты:**
   - Альтернатива физическим призам
   - Более гибкий выбор

### Процесс распределения

1. **Автоматическое определение победителей** (после финализации)
2. **Уведомление победителей** (в бот + email если есть)
3. **Запрос данных для доставки** (адрес для физических призов)
4. **Подтверждение администратором** (проверка данных)
5. **Отправка приза** (трекинг доставки)
6. **Подтверждение получения** (статус "delivered")

---

## 📈 МЕТРИКИ И АНАЛИТИКА

### Метрики для анализа

- **Участие:** % промоутеров, участвующих в конкурсах
- **Активность:** Среднее количество очков на участника
- **Конверсия:** NPS 10 → Промоутер → Участник конкурса
- **ROI:** Стоимость призов / Доход от промоутеров
- **Эффективность:** Рост активности во время конкурсов

### Отчёты

1. **Отчёт по периоду:**
   - Общая статистика
   - Топ-10 победителей
   - Распределение призов
   - ROI конкурса

2. **Отчёт по участнику:**
   - История участия
   - Выигранные призы
   - Прогресс и достижения

---

## 🚀 ПЛАН ВНЕДРЕНИЯ

### Фаза 1: MVP (3-4 недели)
- ✅ Создание таблиц БД
- ✅ Базовый расчёт рейтингов
- ✅ Ручное создание периодов
- ✅ Ручное распределение призов
- ✅ Простой лидерборд в боте

### Фаза 2: Автоматизация (2-3 недели)
- ✅ Автоматическое создание периодов
- ✅ Автоматический расчёт рейтингов (cron)
- ✅ Автоматическая финализация
- ✅ Уведомления победителям
- ✅ Лидерборд в веб-приложении

### Фаза 3: Расширение (3-4 недели)
- ✅ Интеграция с системой доставки призов
- ✅ Автоматическое распределение баллов
- ✅ Расширенная аналитика
- ✅ A/B тестирование призов
- ✅ Геймификация (прогресс-бар, достижения)

---

## 💡 ДОПОЛНИТЕЛЬНЫЕ ИДЕИ

### Специальные конкурсы

1. **Новогодний конкурс:**
   - Призы выше обычного
   - Дополнительные категории (лучший контент, самый активный)

2. **Сезонные конкурсы:**
   - Летний конкурс
   - Осенний конкурс
   - Специальные призы для сезона

3. **Категории:**
   - Лучший промоутер (по UGC)
   - Лучший реферал (по рефералам)
   - Самый вирусный (по лайкам)

### Бонусные акции

1. **Двойные очки:**
   - Периоды с удвоенными очками
   - Мотивация активности

2. **Суперприз:**
   - Дополнительный приз для абсолютного лидера
   - Максимальная мотивация

3. **Командные конкурсы:**
   - Группировка по городам/регионам
   - Командные призы

---

## ✅ ЗАКЛЮЧЕНИЕ

Добавление системы лидерборда и призов к гибридной модели обеспечит:

1. ✅ **Мощную мотивацию** промоутеров
2. ✅ **Соревновательный элемент** (геймификация)
3. ✅ **Увеличение активности** (особенно в конце периодов)
4. ✅ **Ретеншн** (удержание промоутеров)
5. ✅ **Вирусность** (больше контента, больше рефералов)

**Техническая сложность:** Средняя  
**ROI:** Высокий (мотивация → активность → рост)

