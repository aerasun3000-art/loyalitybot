# 📸 Изображения в каруселях - Placeholder дизайн

## 🎯 Обзор

Все карусели теперь имеют красивые визуальные placeholder'ы на основе градиентов и иконок. Эти изображения можно легко заменить на реальные фото.

---

## 🎨 1. Карусель топовых акций (верх главной страницы)

### Дизайн
- **Размер изображения:** 192px высота (h-48)
- **Структура:** Градиент + большая иконка
- **Эффекты:** Backdrop blur, наложение градиентов, тени

### Градиенты (4 варианта)
```javascript
const gradients = [
  'from-pink-400 via-rose-400 to-pink-500',      // Розовый
  'from-purple-400 via-pink-400 to-rose-400',    // Фиолетово-розовый
  'from-rose-400 via-pink-500 to-purple-400',    // Rose-фиолетовый
  'from-pink-500 via-purple-400 to-pink-400'     // Розово-фиолетовый
]
```

### Иконки
```javascript
const icons = ['🎁', '✨', '💖', '🌸', '💎', '🎉']
```

### Структура
```html
<div className="h-48 bg-white/10 backdrop-blur-sm">
  <div className="bg-gradient-to-br from-white/20 to-transparent" />
  <span className="text-9xl opacity-30">{icon}</span> <!-- Фон -->
  <span className="text-7xl">{icon}</span>            <!-- Передний план -->
</div>
```

### Как заменить на реальное фото
```jsx
// Было:
<div className="h-48 bg-gradient-to-br...">
  {/* Градиент и иконка */}
</div>

// Станет:
<img 
  src={promo.imageUrl || '/placeholder.jpg'} 
  alt={promo.title}
  className="h-48 w-full object-cover"
/>
```

---

## 🌟 2. Карусель новостей сообщества

### Дизайн
- **Размер изображения:** 96px высота (h-24)
- **Структура:** Верхнее изображение + нижний контент
- **Градиенты:** Специфичные для каждой карточки

### Карточки (3 штуки)

#### Карточка 1: Добро пожаловать
```javascript
Градиент: from-pink-400 to-pink-500
Иконка: 📢
Фон карточки: from-pink-50 to-pink-100
Border: border-pink-200
```

#### Карточка 2: Акции месяца
```javascript
Градиент: from-purple-400 to-pink-400
Иконка: 🎉
Фон карточки: from-purple-50 to-purple-100
Border: border-purple-200
```

#### Карточка 3: Реферальная программа
```javascript
Градиент: from-rose-400 to-pink-500
Иконка: 🎁
Фон карточки: from-rose-50 to-rose-100
Border: border-rose-200
```

### Структура
```html
<div className="w-64 overflow-hidden rounded-2xl">
  <!-- Изображение-заголовок -->
  <div className="h-24 bg-gradient-to-br from-pink-400 to-pink-500">
    <div className="bg-white/10" />
    <span className="text-6xl">{icon}</span>
  </div>
  
  <!-- Контент -->
  <div className="p-4">
    <h3>Заголовок</h3>
    <p>Описание</p>
  </div>
</div>
```

### Как заменить на реальное фото
```jsx
// Было:
<div className="h-24 bg-gradient-to-br...">
  <span className="text-6xl">📢</span>
</div>

// Станет:
<img 
  src="/news/welcome.jpg" 
  alt="Добро пожаловать"
  className="h-24 w-full object-cover"
/>
```

---

## 🎁 3. Карусель акций партнёров (низ главной страницы)

### Дизайн
- **Размер изображения:** 160px высота (h-40)
- **Структура:** Изображение + белая карточка с контентом
- **Эффекты:** Hover scale, градиентное наложение

### Градиенты (3 варианта)
```javascript
const imageGradients = [
  'from-pink-300 via-pink-400 to-rose-400',      // Розовый
  'from-purple-300 via-pink-300 to-pink-400',    // Фиолетовый
  'from-rose-300 via-pink-400 to-purple-300'     // Rose
]
```

### Иконки
```javascript
const dealIcons = ['🎁', '✨', '💝', '🌟', '💖']
```

### Особенности
- **FREE бэдж:** Красный бэдж в правом верхнем углу если `required_points === 0`
- **Hover эффект:** `group-hover:scale-105`
- **Градиентное наложение:** `from-black/20 to-transparent` снизу вверх

### Структура
```html
<div className="w-72 group">
  <div className="bg-white rounded-2xl overflow-hidden">
    <!-- Изображение -->
    <div className="h-40 bg-gradient-to-br from-pink-300...">
      <div className="bg-gradient-to-t from-black/20 to-transparent" />
      <span className="text-8xl opacity-20">{icon}</span> <!-- Фон -->
      <span className="text-6xl">{icon}</span>            <!-- Передний план -->
      
      {/* FREE бэдж */}
      {promo.required_points === 0 && (
        <div className="absolute top-3 right-3 bg-red-500">FREE</div>
      )}
    </div>
    
    <!-- Контент -->
    <div className="p-4 bg-white">
      <h3>Название акции</h3>
      <p>Партнёр</p>
      <div>Баллы + кнопка</div>
    </div>
  </div>
</div>
```

### Как заменить на реальное фото
```jsx
// Было:
<div className="h-40 bg-gradient-to-br...">
  <span className="text-6xl">{dealIcon}</span>
</div>

// Станет:
<div className="h-40 relative">
  <img 
    src={promo.imageUrl || '/deals/default.jpg'} 
    alt={promo.title}
    className="w-full h-full object-cover"
  />
  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
  
  {/* Сохраняем бэдж */}
  {promo.required_points === 0 && (
    <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full">
      FREE
    </div>
  )}
</div>
```

---

## 🔄 Как добавить поддержку реальных изображений

### 1. Обновить структуру данных

#### Для акций (promotions)
```javascript
{
  id: 1,
  title: "Скидка 50%",
  description: "...",
  imageUrl: "/images/promotions/promo-1.jpg", // НОВОЕ
  // ... остальные поля
}
```

#### Для новостей (создать отдельный массив)
```javascript
const newsItems = [
  {
    id: 1,
    title: "Добро пожаловать!",
    description: "...",
    imageUrl: "/images/news/welcome.jpg",
    gradient: "from-pink-400 to-pink-500",
    icon: "📢"
  },
  // ...
]
```

### 2. Условный рендеринг

```jsx
{/* Если есть изображение - показываем его, иначе - градиент */}
{promo.imageUrl ? (
  <img 
    src={promo.imageUrl} 
    alt={promo.title}
    className="h-48 w-full object-cover"
  />
) : (
  <div className={`h-48 bg-gradient-to-br ${gradient}`}>
    <span className="text-7xl">{icon}</span>
  </div>
)}
```

### 3. Оптимизация изображений

**Рекомендуемые размеры:**
- Топовые акции: 800x400px (2:1)
- Новости: 600x300px (2:1)
- Акции партнёров: 600x400px (3:2)

**Формат:** WebP или JPEG
**Оптимизация:** TinyPNG, Squoosh

---

## 🎨 Цветовая схема placeholder'ов

### Градиенты по типам
| Тип | Назначение | Градиент |
|-----|-----------|----------|
| Розовый | Основной | pink-400 → pink-500 |
| Фиолетовый | Акцент | purple-400 → pink-400 |
| Rose | Дополнительный | rose-400 → pink-500 |
| Микс | Разнообразие | pink-500 → purple-400 |

### Эффекты
- **Backdrop blur:** `bg-white/10 backdrop-blur-sm`
- **Наложение:** `bg-gradient-to-br from-white/20 to-transparent`
- **Тени:** `drop-shadow-lg`
- **Opacity фона:** `opacity-20` для фоновой иконки
- **Затемнение снизу:** `from-black/20 to-transparent`

---

## 📱 Адаптивность

Все изображения автоматически адаптивны благодаря:
- `w-full` - ширина 100%
- `object-cover` - обрезка по размеру
- `overflow-hidden` - скрытие выходящего контента
- `rounded-2xl` / `rounded-3xl` - скругление углов

---

## ✨ Интерактивность

### Hover эффекты
```javascript
// Карусель акций партнёров
className="group-hover:scale-105 transition-transform"

// Можно добавить hover на изображение
onMouseEnter={() => /* показать overlay с деталями */}
```

### Индикаторы загрузки
```jsx
{loading && (
  <div className="h-48 bg-gray-200 animate-pulse" />
)}
```

---

## 🚀 Следующие шаги

1. **Создать папку для изображений:** `/public/images/`
2. **Подготовить изображения:** Оптимизировать и загрузить
3. **Обновить бэкенд:** Добавить поле `imageUrl` в таблицы
4. **Обновить компоненты:** Добавить условный рендеринг
5. **Протестировать:** Проверить на всех разрешениях

---

**Версия:** 1.0.0  
**Дата:** 24 октября 2025  
**Статус:** ✅ Placeholder'ы готовы, можно заменять на реальные фото

