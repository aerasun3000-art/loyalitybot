"""
Утилита для определения валюты по городу партнера
"""

# Города США (используют USD)
US_CITIES = [
    'New York',
    'Los Angeles',
    'Bay Area',
    'Chicago',
    'Miami',
    'Boston',
    'Seattle',
    'San Francisco',
    'Washington',
    'Dallas',
    'Houston',
    'Atlanta',
    'Phoenix',
    'Detroit',
    'Philadelphia'
]

# Маппинг городов на валюты
CITY_TO_CURRENCY = {
    # США - доллары
    'New York': 'USD',
    'Los Angeles': 'USD',
    'Bay Area': 'USD',
    'Chicago': 'USD',
    'Miami': 'USD',
    'Boston': 'USD',
    'Seattle': 'USD',
    'San Francisco': 'USD',
    'Washington': 'USD',
    'Dallas': 'USD',
    'Houston': 'USD',
    'Atlanta': 'USD',
    'Phoenix': 'USD',
    'Detroit': 'USD',
    'Philadelphia': 'USD',
    
    # Онлайн/Все - доллары
    'Online': 'USD',
    'Все': 'USD',
    'All': 'USD',
    
    # Российские города - рубли (если нужно будет вернуть)
    'Москва': 'RUB',
    'Санкт-Петербург': 'RUB',
    'Новосибирск': 'RUB',
    'Екатеринбург': 'RUB',
    'Казань': 'RUB',
    'Нижний Новгород': 'RUB',
    
    # Другие страны (можно расширить)
    'London': 'GBP',
    'Paris': 'EUR',
    'Berlin': 'EUR',
    'Madrid': 'EUR',
    'Rome': 'EUR',
    'Amsterdam': 'EUR',
    'Dubai': 'AED',
    'Tokyo': 'JPY',
    'Singapore': 'SGD',
    'Sydney': 'AUD',
    'Toronto': 'CAD',
    'Mexico City': 'MXN'
}

# Маппинг валют на символы
CURRENCY_SYMBOLS = {
    'USD': '$',
    'RUB': '₽',
    'EUR': '€',
    'GBP': '£',
    'AED': 'د.إ',
    'JPY': '¥',
    'SGD': 'S$',
    'AUD': 'A$',
    'CAD': 'C$',
    'MXN': '$'
}


def get_currency_by_city(city):
    """
    Определяет валюту по городу партнера
    
    Args:
        city: Город партнера (может быть None)
    
    Returns:
        str: Код валюты (USD, RUB, EUR и т.д.)
    """
    if not city:
        # По умолчанию USD для онлайн/неизвестных
        return 'USD'
    
    # Проверяем точное совпадение
    if city in CITY_TO_CURRENCY:
        return CITY_TO_CURRENCY[city]
    
    # Проверяем, является ли город из США (по началу названия или содержит US города)
    city_lower = city.lower()
    is_us_city = any(us_city.lower() in city_lower or city_lower in us_city.lower() 
                     for us_city in US_CITIES)
    
    if is_us_city:
        return 'USD'
    
    # Онлайн/Все - доллары
    if city in ['Все', 'Online', 'All']:
        return 'USD'
    
    # По умолчанию USD
    return 'USD'


def get_currency_symbol(currency):
    """
    Получает символ валюты
    
    Args:
        currency: Код валюты
    
    Returns:
        str: Символ валюты
    """
    return CURRENCY_SYMBOLS.get(currency, '$')


def format_currency(value, city=None, currency=None):
    """
    Форматирует сумму в валюту
    
    Args:
        value: Сумма
        city: Город партнера (опционально)
        currency: Код валюты (опционально, если не указан, определяется по городу)
    
    Returns:
        str: Отформатированная сумма с символом валюты
    """
    final_currency = currency or get_currency_by_city(city)
    symbol = get_currency_symbol(final_currency)
    
    # Форматируем число с разделителями тысяч
    formatted_value = f"{value:,.2f}".rstrip('0').rstrip('.')
    
    return f"{symbol}{formatted_value}"















