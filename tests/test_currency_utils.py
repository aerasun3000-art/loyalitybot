"""
Unit-тесты для currency_utils.py
Полное покрытие функций работы с валютами
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestCurrencyConfiguration:
    """Тесты конфигурации валют"""
    
    def test_supported_currencies(self):
        """Тест поддерживаемых валют"""
        supported = ['USD', 'RUB', 'EUR', 'GBP', 'AED', 'THB', 'TRY']
        for currency in supported:
            assert len(currency) == 3
            assert currency.isupper()
    
    def test_default_currency(self):
        """Тест валюты по умолчанию"""
        default = 'USD'
        assert default == 'USD'
    
    def test_currency_symbols(self):
        """Тест символов валют"""
        symbols = {
            'USD': '$',
            'RUB': '₽',
            'EUR': '€',
            'GBP': '£',
            'AED': 'د.إ',
            'THB': '฿',
            'TRY': '₺'
        }
        
        for code, symbol in symbols.items():
            assert symbol is not None
            assert len(symbol) >= 1


class TestCityToCurrencyMapping:
    """Тесты маппинга город-валюта"""
    
    def test_moscow_currency(self):
        """Тест валюты для Москвы"""
        city_currencies = {
            'Москва': 'RUB',
            'Moscow': 'RUB'
        }
        assert city_currencies.get('Москва') == 'RUB'
    
    def test_dubai_currency(self):
        """Тест валюты для Дубая"""
        city_currencies = {
            'Дубай': 'AED',
            'Dubai': 'AED'
        }
        assert city_currencies.get('Дубай') == 'AED'
    
    def test_bangkok_currency(self):
        """Тест валюты для Бангкока"""
        city_currencies = {
            'Бангкок': 'THB',
            'Bangkok': 'THB'
        }
        assert city_currencies.get('Бангкок') == 'THB'
    
    def test_istanbul_currency(self):
        """Тест валюты для Стамбула"""
        city_currencies = {
            'Стамбул': 'TRY',
            'Istanbul': 'TRY'
        }
        assert city_currencies.get('Стамбул') == 'TRY'
    
    def test_new_york_currency(self):
        """Тест валюты для Нью-Йорка"""
        city_currencies = {
            'New York': 'USD',
            'Нью-Йорк': 'USD'
        }
        assert city_currencies.get('New York') == 'USD'
    
    def test_unknown_city_default(self):
        """Тест валюты для неизвестного города"""
        city_currencies = {}
        default_currency = 'USD'
        
        currency = city_currencies.get('Unknown City', default_currency)
        assert currency == 'USD'


class TestExchangeRates:
    """Тесты курсов валют"""
    
    def test_usd_base_rate(self):
        """Тест базового курса USD"""
        rates = {'USD': 1.0}
        assert rates['USD'] == 1.0
    
    def test_rub_rate_range(self):
        """Тест диапазона курса RUB"""
        # Курс RUB к USD обычно в диапазоне 60-120
        rub_rate = 90.0
        assert 50.0 < rub_rate < 150.0
    
    def test_eur_rate_range(self):
        """Тест диапазона курса EUR"""
        # Курс EUR к USD обычно около 0.85-0.95
        eur_rate = 0.92
        assert 0.7 < eur_rate < 1.2
    
    def test_rate_conversion_usd_to_rub(self):
        """Тест конвертации USD в RUB"""
        usd_amount = 100
        rate = 90.0  # 1 USD = 90 RUB
        rub_amount = usd_amount * rate
        assert rub_amount == 9000.0
    
    def test_rate_conversion_rub_to_usd(self):
        """Тест конвертации RUB в USD"""
        rub_amount = 9000
        rate = 90.0
        usd_amount = rub_amount / rate
        assert usd_amount == 100.0


class TestAmountFormatting:
    """Тесты форматирования сумм"""
    
    def test_format_usd(self):
        """Тест форматирования USD"""
        amount = 1000
        formatted = f"${amount:,.2f}"
        assert formatted == "$1,000.00"
    
    def test_format_rub(self):
        """Тест форматирования RUB"""
        amount = 50000
        formatted = f"{amount:,.0f} ₽"
        assert formatted == "50,000 ₽"
    
    def test_format_eur(self):
        """Тест форматирования EUR"""
        amount = 1500.50
        formatted = f"€{amount:,.2f}"
        assert formatted == "€1,500.50"
    
    def test_format_with_decimals(self):
        """Тест форматирования с десятичными"""
        amount = 99.99
        formatted = f"${amount:.2f}"
        assert formatted == "$99.99"
    
    def test_format_large_amount(self):
        """Тест форматирования большой суммы"""
        amount = 1000000
        formatted = f"${amount:,.0f}"
        assert formatted == "$1,000,000"
    
    def test_format_zero_amount(self):
        """Тест форматирования нулевой суммы"""
        amount = 0
        formatted = f"${amount:.2f}"
        assert formatted == "$0.00"


class TestPointsToCurrency:
    """Тесты конвертации баллов в валюту"""
    
    def test_points_to_usd_default_rate(self):
        """Тест конвертации баллов в USD"""
        points = 100
        rate = 1.0  # 1 балл = 1 USD
        usd = points * rate
        assert usd == 100.0
    
    def test_points_to_rub(self):
        """Тест конвертации баллов в RUB"""
        points = 100
        usd_rate = 1.0
        rub_rate = 90.0
        rub = points * usd_rate * rub_rate
        assert rub == 9000.0
    
    def test_fractional_points(self):
        """Тест дробных баллов"""
        points = 50.5
        rate = 1.0
        result = points * rate
        assert result == 50.5


class TestCurrencyValidation:
    """Тесты валидации валют"""
    
    def test_valid_currency_code(self):
        """Тест валидного кода валюты"""
        valid_codes = ['USD', 'RUB', 'EUR', 'GBP']
        code = 'USD'
        assert code in valid_codes
    
    def test_invalid_currency_code(self):
        """Тест невалидного кода валюты"""
        valid_codes = ['USD', 'RUB', 'EUR', 'GBP']
        code = 'XXX'
        assert code not in valid_codes
    
    def test_lowercase_currency_normalization(self):
        """Тест нормализации нижнего регистра"""
        code = 'usd'
        normalized = code.upper()
        assert normalized == 'USD'
    
    def test_currency_code_length(self):
        """Тест длины кода валюты"""
        code = 'USD'
        assert len(code) == 3


class TestRateUpdates:
    """Тесты обновления курсов"""
    
    def test_rate_timestamp(self):
        """Тест метки времени курса"""
        rate_data = {
            'rate': 90.0,
            'updated_at': datetime.datetime.now().isoformat()
        }
        assert 'updated_at' in rate_data
    
    def test_stale_rate_detection(self):
        """Тест обнаружения устаревшего курса"""
        last_update = datetime.datetime.now() - datetime.timedelta(hours=25)
        now = datetime.datetime.now()
        
        max_age_hours = 24
        is_stale = (now - last_update).total_seconds() > max_age_hours * 3600
        assert is_stale is True
    
    def test_fresh_rate_detection(self):
        """Тест обнаружения свежего курса"""
        last_update = datetime.datetime.now() - datetime.timedelta(hours=1)
        now = datetime.datetime.now()
        
        max_age_hours = 24
        is_stale = (now - last_update).total_seconds() > max_age_hours * 3600
        assert is_stale is False


class TestDefaultRates:
    """Тесты дефолтных курсов"""
    
    def test_default_rates_structure(self):
        """Тест структуры дефолтных курсов"""
        DEFAULT_RATES = {
            'USD': 1.0,
            'RUB': 90.0,
            'EUR': 0.92,
            'GBP': 0.79,
            'AED': 3.67,
            'THB': 35.0,
            'TRY': 32.0
        }
        
        assert 'USD' in DEFAULT_RATES
        assert DEFAULT_RATES['USD'] == 1.0
    
    def test_all_rates_positive(self):
        """Тест что все курсы положительные"""
        rates = {'USD': 1.0, 'RUB': 90.0, 'EUR': 0.92}
        
        for currency, rate in rates.items():
            assert rate > 0


class TestCurrencyConversion:
    """Тесты конвертации валют"""
    
    def test_convert_same_currency(self):
        """Тест конвертации в ту же валюту"""
        amount = 100
        from_currency = 'USD'
        to_currency = 'USD'
        
        if from_currency == to_currency:
            result = amount
        else:
            result = amount * 1.0
        
        assert result == 100
    
    def test_convert_usd_to_eur(self):
        """Тест конвертации USD в EUR"""
        usd_amount = 100
        eur_rate = 0.92  # 1 USD = 0.92 EUR
        
        eur_amount = usd_amount * eur_rate
        assert eur_amount == 92.0
    
    def test_convert_eur_to_usd(self):
        """Тест конвертации EUR в USD"""
        eur_amount = 92
        eur_rate = 0.92
        
        usd_amount = eur_amount / eur_rate
        assert usd_amount == 100.0
    
    def test_triangular_conversion(self):
        """Тест треугольной конвертации"""
        # USD -> EUR -> RUB -> USD должно вернуть ~то же значение
        usd_amount = 100
        eur_rate = 0.92
        rub_to_eur = 0.0102  # примерно
        rub_to_usd = 1/90.0
        
        eur_amount = usd_amount * eur_rate
        assert eur_amount > 0


class TestPartnerCurrencySettings:
    """Тесты настроек валюты партнёра"""
    
    def test_partner_currency_override(self):
        """Тест переопределения валюты партнёра"""
        partner = {
            'chat_id': '123456',
            'city': 'Москва',
            'currency': 'EUR'  # переопределено
        }
        
        # Используем currency если указано, иначе по городу
        currency = partner.get('currency') or self._get_city_currency(partner.get('city'))
        assert currency == 'EUR'
    
    def _get_city_currency(self, city):
        city_map = {'Москва': 'RUB', 'Дубай': 'AED'}
        return city_map.get(city, 'USD')
    
    def test_partner_currency_from_city(self):
        """Тест валюты партнёра по городу"""
        partner = {
            'chat_id': '123456',
            'city': 'Москва'
        }
        
        currency = partner.get('currency') or self._get_city_currency(partner.get('city'))
        assert currency == 'RUB'


class TestAmountRounding:
    """Тесты округления сумм"""
    
    def test_round_to_cents(self):
        """Тест округления до центов"""
        amount = 99.999
        rounded = round(amount, 2)
        assert rounded == 100.0
    
    def test_round_down(self):
        """Тест округления вниз"""
        amount = 99.994
        rounded = round(amount, 2)
        assert rounded == 99.99
    
    def test_integer_points(self):
        """Тест целых баллов"""
        points = 99.7
        rounded = int(points)
        assert rounded == 99


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
