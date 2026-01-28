"""
Утилита для определения валюты по городу партнера
"""
import os
import logging
from datetime import datetime
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    
    # Вьетнам
    'Nha Trang': 'VND',
    
    # Казахстан
    'Almaty': 'KZT',
    'Astana': 'KZT',
    'Алматы': 'KZT',
    'Астана': 'KZT',
    
    # Киргизия
    'Bishkek': 'KGS',
    'Osh': 'KGS',
    'Бишкек': 'KGS',
    'Ош': 'KGS',
    
    # ОАЭ
    'Dubai': 'AED',
    'Дубай': 'AED',
    
    # Другие страны (опционально)
    'London': 'GBP',
    'Paris': 'EUR',
    'Berlin': 'EUR',
    'Madrid': 'EUR',
    'Rome': 'EUR',
    'Amsterdam': 'EUR',
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
    'VND': '₫',
    'KZT': '₸',
    'KGS': 'сом',
    'AED': 'د.إ',
    'EUR': '€',
    'GBP': '£',
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
    # Для VND, KZT, KGS - без десятичных знаков
    if final_currency in ['VND', 'KZT', 'KGS']:
        formatted_value = f"{int(value):,}".replace(',', ' ')
    else:
        formatted_value = f"{value:,.2f}".rstrip('0').rstrip('.')
    
    return f"{symbol}{formatted_value}"


# Курсы валют по умолчанию (fallback, если БД недоступна)
DEFAULT_EXCHANGE_RATES = {
    'VND_USD': 0.0000408,  # 1 VND = 0.0000408 USD (24,500 VND = 1 USD)
    'RUB_USD': 0.011,      # 1 RUB = 0.011 USD (~91 RUB = 1 USD)
    'KZT_USD': 0.0021,     # 1 KZT = 0.0021 USD (~476 KZT = 1 USD)
    'KGS_USD': 0.011,      # 1 KGS = 0.011 USD (~91 KGS = 1 USD)
    'AED_USD': 0.272,      # 1 AED = 0.272 USD (~3.67 AED = 1 USD)
    
    # Обратные курсы (если нужно)
    'USD_VND': 24500,
    'USD_RUB': 91,
    'USD_KZT': 476,
    'USD_KGS': 91,
    'USD_AED': 3.67,
}


def get_exchange_rate(from_currency: str, to_currency: str = 'USD', 
                     date: Optional[datetime] = None,
                     supabase_client=None) -> float:
    """
    Получает курс обмена валют
    
    Сначала пытается получить из БД, если не получается - использует DEFAULT_RATES
    
    Args:
        from_currency: Исходная валюта (VND, RUB, etc.)
        to_currency: Целевая валюта (по умолчанию USD)
        date: Дата для получения исторического курса (по умолчанию сегодня)
        supabase_client: Клиент Supabase (опционально, если None - используется DEFAULT_RATES)
    
    Returns:
        float: Курс обмена (1 from_currency = rate to_currency)
    """
    # Если конвертируем в ту же валюту
    if from_currency == to_currency:
        return 1.0
    
    # Пытаемся получить из БД, если клиент передан
    if supabase_client:
        try:
            if not date:
                date = datetime.now()
            
            # Получаем курс из БД
            result = supabase_client.table('currency_exchange_rates').select('rate').eq(
                'from_currency', from_currency
            ).eq('to_currency', to_currency).lte('effective_from', date.isoformat()).order(
                'effective_from', desc=True
            ).limit(1).execute()
            
            if result.data and len(result.data) > 0:
                rate = float(result.data[0]['rate'])
                logger.debug(f"Курс {from_currency}→{to_currency} из БД: {rate}")
                return rate
        except Exception as e:
            logger.warning(f"Не удалось получить курс из БД, использую DEFAULT_RATES: {e}")
    
    # Fallback: используем DEFAULT_RATES
    key = f"{from_currency}_{to_currency}"
    rate = DEFAULT_EXCHANGE_RATES.get(key, 1.0)
    
    if rate == 1.0 and from_currency != to_currency:
        logger.warning(f"Курс {key} не найден в DEFAULT_RATES, возвращаю 1.0")
    
    return rate


def convert_currency(amount: float, from_currency: str, 
                    to_currency: str = 'USD',
                    date: Optional[datetime] = None,
                    supabase_client=None) -> float:
    """
    Конвертирует сумму из одной валюты в другую
    
    Args:
        amount: Сумма в исходной валюте
        from_currency: Исходная валюта
        to_currency: Целевая валюта (по умолчанию USD)
        date: Дата для исторической конвертации
        supabase_client: Клиент Supabase (опционально)
    
    Returns:
        float: Сумма в целевой валюте
    """
    if from_currency == to_currency:
        return float(amount)
    
    rate = get_exchange_rate(from_currency, to_currency, date, supabase_client)
    converted = float(amount) * rate
    
    logger.debug(f"Конвертация: {amount} {from_currency} × {rate} = {converted} {to_currency}")
    
    return round(converted, 2)


def convert_points_to_currency(points: float, currency: str, 
                               supabase_client=None) -> float:
    """
    Конвертирует баллы (= USD) в локальную валюту клиента
    
    Args:
        points: Количество баллов (= USD)
        currency: Целевая валюта (VND, RUB, KZT, USD)
        supabase_client: Клиент Supabase (опционально)
    
    Returns:
        float: Сумма в целевой валюте
    """
    if currency == 'USD':
        return float(points)
    
    # Получаем курс USD → currency
    rate = get_exchange_rate('USD', currency, supabase_client=supabase_client)
    converted = float(points) * rate
    
    # Для VND, KZT, RUB округляем до целых
    if currency in ['VND', 'KZT', 'RUB']:
        return round(converted)
    
    return round(converted, 2)


def format_price_with_points(points: float, currency: str, 
                             supabase_client=None,
                             show_points: bool = True) -> str:
    """
    Форматирует цену услуги: показывает в локальной валюте + баллы
    
    Args:
        points: Стоимость в баллах (= USD)
        currency: Валюта клиента (USD, VND, RUB, KZT)
        supabase_client: Клиент Supabase (опционально)
        show_points: Показывать ли баллы в скобках
    
    Returns:
        str: Отформатированная цена
        
    Examples:
        - USD: "$100 (100 баллов)" или "$100"
        - VND: "2 500 000 ₫ (100 баллов)"
        - RUB: "10 000 ₽ (100 баллов)"
        - KZT: "52 000 ₸ (100 баллов)"
    """
    symbol = get_currency_symbol(currency)
    
    if currency == 'USD':
        # Для USD цена = баллы
        formatted_value = f"${int(points)}" if points == int(points) else f"${points:.2f}"
        if show_points:
            return f"{formatted_value} ({int(points)} баллов)"
        return formatted_value
    
    # Конвертируем баллы в локальную валюту
    local_amount = convert_points_to_currency(points, currency, supabase_client)
    
    # Форматируем с разделителями тысяч
    if currency in ['VND', 'KZT', 'RUB']:
        formatted_value = f"{int(local_amount):,}".replace(',', ' ')
    else:
        formatted_value = f"{local_amount:,.2f}".replace(',', ' ')
    
    # Добавляем символ валюты
    if currency == 'VND':
        price_str = f"{formatted_value} {symbol}"
    elif currency == 'RUB':
        price_str = f"{formatted_value} {symbol}"
    elif currency == 'KZT':
        price_str = f"{formatted_value} {symbol}"
    else:
        price_str = f"{symbol}{formatted_value}"
    
    if show_points:
        return f"{price_str} ({int(points)} баллов)"
    return price_str


def get_supported_currencies() -> list:
    """
    Возвращает список поддерживаемых валют
    
    Returns:
        list: Список словарей с информацией о валютах
    """
    return [
        {'code': 'USD', 'symbol': '$', 'name': 'US Dollar', 'name_ru': 'Доллар США', 'flag': '🇺🇸'},
        {'code': 'VND', 'symbol': '₫', 'name': 'Vietnamese Dong', 'name_ru': 'Вьетнамский донг', 'flag': '🇻🇳'},
        {'code': 'RUB', 'symbol': '₽', 'name': 'Russian Ruble', 'name_ru': 'Российский рубль', 'flag': '🇷🇺'},
        {'code': 'KZT', 'symbol': '₸', 'name': 'Kazakhstani Tenge', 'name_ru': 'Казахстанский тенге', 'flag': '🇰🇿'},
    ]











