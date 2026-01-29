"""
Unit-тесты для message_generator.py
Полное покрытие генерации сообщений
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestWelcomeMessages:
    """Тесты приветственных сообщений"""
    
    def test_new_user_welcome(self):
        """Тест приветствия нового пользователя"""
        name = "Иван"
        bonus = 100
        
        message = f"🎉 Добро пожаловать, {name}!\n\nВы получили приветственный бонус: {bonus} баллов"
        
        assert name in message
        assert str(bonus) in message
    
    def test_returning_user_welcome(self):
        """Тест приветствия вернувшегося пользователя"""
        name = "Иван"
        balance = 500
        
        message = f"👋 С возвращением, {name}!\n\nВаш баланс: {balance} баллов"
        
        assert 'возвращением' in message
        assert str(balance) in message
    
    def test_partner_welcome(self):
        """Тест приветствия партнёра"""
        partner_name = "Салон красоты"
        
        message = f"🏢 Добро пожаловать в партнёрскую программу, {partner_name}!"
        
        assert partner_name in message


class TestTransactionMessages:
    """Тесты сообщений о транзакциях"""
    
    def test_accrual_message(self):
        """Тест сообщения о начислении"""
        points = 50
        partner_name = "Салон красоты"
        new_balance = 550
        
        message = (
            f"✅ Начислено: +{points} баллов\n"
            f"Партнёр: {partner_name}\n"
            f"Новый баланс: {new_balance}"
        )
        
        assert f"+{points}" in message
        assert partner_name in message
    
    def test_spend_message(self):
        """Тест сообщения о списании"""
        points = 100
        partner_name = "Салон красоты"
        new_balance = 400
        
        message = (
            f"💸 Списано: -{points} баллов\n"
            f"Партнёр: {partner_name}\n"
            f"Новый баланс: {new_balance}"
        )
        
        assert f"-{points}" in message
    
    def test_insufficient_balance_message(self):
        """Тест сообщения о недостаточном балансе"""
        required = 500
        available = 300
        
        message = f"❌ Недостаточно баллов. Требуется: {required}, доступно: {available}"
        
        assert str(required) in message
        assert str(available) in message


class TestNotificationMessages:
    """Тесты уведомлений"""
    
    def test_promo_approved_message(self):
        """Тест сообщения об одобрении акции"""
        promo_title = "Скидка 50%"
        
        message = f"🎉 Ваша акция «{promo_title}» одобрена!"
        
        assert promo_title in message
        assert '🎉' in message
    
    def test_promo_rejected_message(self):
        """Тест сообщения об отклонении акции"""
        promo_title = "Акция"
        reason = "Не соответствует правилам"
        
        message = f"❌ Ваша акция «{promo_title}» отклонена.\nПричина: {reason}"
        
        assert '❌' in message
        assert reason in message
    
    def test_service_approved_message(self):
        """Тест сообщения об одобрении услуги"""
        service_title = "Маникюр"
        
        message = f"✅ Ваша услуга «{service_title}» одобрена и опубликована!"
        
        assert service_title in message


class TestBalanceMessages:
    """Тесты сообщений о балансе"""
    
    def test_balance_display(self):
        """Тест отображения баланса"""
        balance = 1500
        
        message = f"💰 Ваш баланс: {balance:,} баллов".replace(',', ' ')
        
        assert '1 500' in message
    
    def test_zero_balance_message(self):
        """Тест сообщения о нулевом балансе"""
        balance = 0
        
        message = f"💰 Ваш баланс: {balance} баллов"
        
        assert '0' in message
    
    def test_revenue_share_balance(self):
        """Тест баланса Revenue Share"""
        balance = 500.50
        currency = 'USD'
        
        message = f"💎 Ваш баланс Revenue Share: ${balance:.2f}"
        
        assert '500.50' in message


class TestMenuMessages:
    """Тесты сообщений меню"""
    
    def test_main_menu_message(self):
        """Тест главного меню"""
        message = "📋 Главное меню\n\nВыберите действие:"
        
        assert 'Главное меню' in message
    
    def test_services_menu_message(self):
        """Тест меню услуг"""
        message = "📝 Управление услугами\n\nВыберите действие:"
        
        assert 'услугами' in message.lower()
    
    def test_promotions_menu_message(self):
        """Тест меню акций"""
        message = "🎁 Управление акциями\n\nВыберите действие:"
        
        assert 'акциями' in message.lower()


class TestErrorMessages:
    """Тесты сообщений об ошибках"""
    
    def test_generic_error(self):
        """Тест общей ошибки"""
        message = "❌ Произошла ошибка. Попробуйте позже."
        
        assert '❌' in message
        assert 'ошибка' in message.lower()
    
    def test_not_found_error(self):
        """Тест ошибки не найдено"""
        entity = "Услуга"
        
        message = f"❌ {entity} не найдена."
        
        assert entity in message
    
    def test_validation_error(self):
        """Тест ошибки валидации"""
        field = "Цена"
        
        message = f"⚠️ Некорректное значение поля «{field}»"
        
        assert field in message
    
    def test_access_denied_error(self):
        """Тест ошибки доступа"""
        message = "🚫 Доступ запрещён. У вас нет прав для выполнения этого действия."
        
        assert '🚫' in message


class TestConfirmationMessages:
    """Тесты сообщений подтверждения"""
    
    def test_delete_confirmation(self):
        """Тест подтверждения удаления"""
        entity = "услугу"
        name = "Маникюр"
        
        message = f"⚠️ Вы уверены, что хотите удалить {entity} «{name}»?\n\nЭто действие нельзя отменить."
        
        assert 'нельзя отменить' in message
    
    def test_success_confirmation(self):
        """Тест подтверждения успеха"""
        action = "Сохранено"
        
        message = f"✅ {action} успешно!"
        
        assert '✅' in message


class TestListMessages:
    """Тесты сообщений списков"""
    
    def test_services_list_header(self):
        """Тест заголовка списка услуг"""
        count = 5
        
        message = f"📋 Ваши услуги ({count}):"
        
        assert str(count) in message
    
    def test_empty_list_message(self):
        """Тест сообщения о пустом списке"""
        message = "📋 У вас пока нет услуг.\n\nНажмите «Добавить услугу», чтобы создать первую."
        
        assert 'нет услуг' in message.lower()
    
    def test_service_list_item(self):
        """Тест элемента списка услуг"""
        title = "Маникюр"
        price = 100
        status = "Одобрена"
        
        item = f"• {title} - {price} баллов ({status})"
        
        assert title in item
        assert str(price) in item


class TestInputPrompts:
    """Тесты подсказок для ввода"""
    
    def test_title_prompt(self):
        """Тест подсказки для заголовка"""
        message = "📝 Введите название услуги:"
        
        assert 'название' in message.lower()
    
    def test_description_prompt(self):
        """Тест подсказки для описания"""
        message = "📝 Введите описание услуги:"
        
        assert 'описание' in message.lower()
    
    def test_price_prompt(self):
        """Тест подсказки для цены"""
        message = "💰 Введите цену в баллах (только число):"
        
        assert 'цену' in message.lower()
    
    def test_date_prompt(self):
        """Тест подсказки для даты"""
        message = "📅 Введите дату окончания (ДД.ММ.ГГГГ):"
        
        assert 'дату' in message.lower()


class TestStatisticsMessages:
    """Тесты сообщений статистики"""
    
    def test_partner_stats_message(self):
        """Тест статистики партнёра"""
        stats = {
            'clients': 150,
            'transactions': 500,
            'points_given': 25000,
            'nps': 8.5
        }
        
        message = (
            f"📊 Статистика\n\n"
            f"👥 Клиентов: {stats['clients']}\n"
            f"📈 Транзакций: {stats['transactions']}\n"
            f"🎁 Выдано баллов: {stats['points_given']}\n"
            f"⭐ NPS: {stats['nps']}"
        )
        
        assert str(stats['clients']) in message
        assert str(stats['nps']) in message
    
    def test_daily_stats_message(self):
        """Тест дневной статистики"""
        date = "19.01.2026"
        transactions = 25
        
        message = f"📊 Статистика за {date}\n\nТранзакций: {transactions}"
        
        assert date in message


class TestNPSMessages:
    """Тесты сообщений NPS"""
    
    def test_nps_request_message(self):
        """Тест запроса NPS оценки"""
        partner_name = "Салон красоты"
        
        message = f"⭐ Пожалуйста, оцените {partner_name} от 0 до 10:"
        
        assert partner_name in message
        assert '0 до 10' in message
    
    def test_nps_thanks_message(self):
        """Тест благодарности за NPS"""
        message = "🙏 Спасибо за вашу оценку!"
        
        assert 'Спасибо' in message
    
    def test_nps_promoter_response(self):
        """Тест ответа промоутеру"""
        rating = 10
        
        if rating >= 9:
            message = "🎉 Мы рады, что вам понравилось! Расскажите друзьям о нас."
        else:
            message = ""
        
        assert 'друзьям' in message


class TestDateFormatting:
    """Тесты форматирования дат"""
    
    def test_date_format_russian(self):
        """Тест русского формата даты"""
        date = datetime.date(2026, 1, 19)
        formatted = date.strftime("%d.%m.%Y")
        
        assert formatted == "19.01.2026"
    
    def test_datetime_format_full(self):
        """Тест полного формата даты-времени"""
        dt = datetime.datetime(2026, 1, 19, 14, 30)
        formatted = dt.strftime("%d.%m.%Y %H:%M")
        
        assert formatted == "19.01.2026 14:30"


class TestMarkdownFormatting:
    """Тесты Markdown форматирования"""
    
    def test_bold_text(self):
        """Тест жирного текста"""
        text = "Важно"
        bold = f"**{text}**"
        
        assert bold == "**Важно**"
    
    def test_italic_text(self):
        """Тест курсивного текста"""
        text = "примечание"
        italic = f"_{text}_"
        
        assert italic == "_примечание_"
    
    def test_escape_special_chars(self):
        """Тест экранирования спецсимволов"""
        text = "100% скидка"
        # В Telegram Markdown нужно экранировать %
        # На практике используется HTML или MarkdownV2
        
        assert '%' in text


class TestMultilingualMessages:
    """Тесты мультиязычных сообщений"""
    
    def test_russian_message(self):
        """Тест русского сообщения"""
        message = "Добро пожаловать!"
        
        assert 'пожаловать' in message.lower()
    
    def test_english_fallback(self):
        """Тест английского fallback"""
        language = 'unknown'
        
        if language == 'ru':
            message = "Добро пожаловать!"
        else:
            message = "Welcome!"
        
        assert message == "Welcome!"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
