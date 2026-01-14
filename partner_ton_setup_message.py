#!/usr/bin/env python3
"""
Скрипт для отправки сообщений партнерам о настройке TON COIN
Можно использовать для массовой рассылки инструкций
"""

import os
from dotenv import load_dotenv
from supabase_manager import SupabaseManager

load_dotenv()


def get_all_partners():
    """Получить список всех партнеров"""
    sm = SupabaseManager()
    
    try:
        result = sm.client.table('partners').select(
            'chat_id, name, company_name, ton_wallet_address, payment_method'
        ).execute()
        
        return result.data
    except Exception as e:
        print(f"Ошибка получения партнеров: {e}")
        return []


def generate_message_for_partner(partner):
    """Сгенерировать персональное сообщение для партнера"""
    
    name = partner.get('name', 'Партнер')
    has_wallet = partner.get('ton_wallet_address') is not None
    payment_method = partner.get('payment_method', 'bank')
    
    if has_wallet and payment_method in ['ton', 'both']:
        # Уже настроен
        message = f"""
👋 Привет, {name}!

✅ Отлично! Ваш TON кошелек уже настроен.

💰 Текущий метод выплат: {payment_method}

📊 Хотите проверить настройки?
Выполните команду: /my_wallet

💡 Нужна помощь?
Выполните команду: /ton_help
        """
    else:
        # Нужно настроить
        message = f"""
👋 Привет, {name}!

🚀 У нас отличные новости! Теперь вы можете получать Revenue Share выплаты через TON COIN!

⚡ Преимущества:
• Мгновенные выплаты (5-10 секунд вместо 1-5 дней)
• Минимальные комиссии (~$0.01 вместо 2-5%)
• Получение прямо в Telegram
• Работает везде в мире

📝 Что нужно сделать (7 минут):

1️⃣ Создайте Telegram Wallet:
   • Откройте @wallet в Telegram
   • Создайте кошелек (следуйте инструкциям)
   • Скопируйте адрес кошелька

2️⃣ Настройте в боте:
   • Выполните: /setup_wallet
   • Вставьте адрес кошелька
   • Выберите метод выплат: /payment_method

3️⃣ Готово!
   • Проверьте через: /my_wallet

❓ Вопросы? Выполните: /ton_help

Начните прямо сейчас: /setup_wallet
        """
    
    return message.strip()


def print_messages_for_all_partners():
    """Печать сообщений для всех партнеров"""
    
    partners = get_all_partners()
    
    if not partners:
        print("❌ Партнеры не найдены")
        return
    
    print(f"📋 Найдено партнеров: {len(partners)}\n")
    print("=" * 60)
    
    for i, partner in enumerate(partners, 1):
        chat_id = partner.get('chat_id')
        name = partner.get('name', 'Неизвестно')
        company = partner.get('company_name', '')
        
        print(f"\n{i}. ПАРТНЕР: {name}")
        if company:
            print(f"   Компания: {company}")
        print(f"   Chat ID: {chat_id}")
        print(f"\n   📨 СООБЩЕНИЕ:")
        print("   " + "─" * 56)
        
        message = generate_message_for_partner(partner)
        for line in message.split('\n'):
            print(f"   {line}")
        
        print("   " + "─" * 56)
        print()


def get_setup_status_summary():
    """Получить сводку по статусу настройки"""
    
    partners = get_all_partners()
    
    if not partners:
        return None
    
    total = len(partners)
    with_wallet = sum(1 for p in partners if p.get('ton_wallet_address'))
    ton_method = sum(1 for p in partners if p.get('payment_method') in ['ton', 'both'])
    bank_only = sum(1 for p in partners if p.get('payment_method') == 'bank' or not p.get('payment_method'))
    not_setup = total - with_wallet
    
    return {
        'total': total,
        'with_wallet': with_wallet,
        'ton_method': ton_method,
        'bank_only': bank_only,
        'not_setup': not_setup
    }


if __name__ == "__main__":
    print("📊 СТАТУС НАСТРОЙКИ TON COIN ДЛЯ ПАРТНЕРОВ\n")
    
    # Статистика
    stats = get_setup_status_summary()
    if stats:
        print("📈 Сводка:")
        print(f"   Всего партнеров: {stats['total']}")
        print(f"   ✅ С настроенным кошельком: {stats['with_wallet']}")
        print(f"   💰 С методом TON: {stats['ton_method']}")
        print(f"   🏦 Только банк: {stats['bank_only']}")
        print(f"   ❌ Не настроено: {stats['not_setup']}")
        print()
    
    # Сообщения для каждого
    print_messages_for_all_partners()
    
    print("\n" + "=" * 60)
    print("💡 Вы можете скопировать эти сообщения и отправить партнерам")
    print("   через бот или использовать для массовой рассылки")
    print("=" * 60)

