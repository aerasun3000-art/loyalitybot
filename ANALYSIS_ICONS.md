# 🔍 Анализ: Как отображаются иконки

## Найденная логика:

### 1. В Home.jsx (строка 347):
```javascript
{(services.length > 0 ? services.slice(0, 8) : defaultServiceIcons.slice(0, 8)).map((item, index) => {
```

**Два варианта:**
- Если `services.length > 0` → используем данные из БД (`item.title`)
- Если `services.length === 0` → используем `defaultServiceIcons` (предустановленные)

### 2. defaultServiceIcons (serviceIcons.js строка 175):
```javascript
export const defaultServiceIcons = [
  serviceCategories.manicure,  // это объект с полями: icon, name, nameEn
  serviceCategories.hairstyle,
  ...
]
```

### 3. Структура serviceCategories.manicure:
```javascript
manicure: {
  icon: 'manicure',      // ← УЖЕ ЕСТЬ ГОТОВОЕ ЗНАЧЕНИЕ!
  name: 'Маникюр',
  nameEn: 'Manicure',
  color: '...'
}
```

## 🎯 ПРОБЛЕМА НАЙДЕНА!

Когда используется `defaultServiceIcons`:
- `item.icon` УЖЕ содержит 'manicure', 'hairstyle' и т.д.
- Но мы это игнорируем и пытаемся найти через `getServiceIcon(item.name)`
- А потом еще проверяем на эмодзи и заменяем на 'default'

**Правильная логика:**
1. Если `isService` (данные из БД) → используем `getServiceIcon(item.title)`
2. Если НЕ `isService` (defaultServiceIcons) → используем `item.icon` напрямую!

