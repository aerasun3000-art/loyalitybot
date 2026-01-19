#!/usr/bin/env python3
"""
Периодическое обновление курса TON/USD
Запускать через cron раз в час/день
"""

import os
import sys
import requests
from decimal import Decimal
from datetime import datetime
from dotenv import load_dotenv
from supabase_manager import SupabaseManager

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def update_ton_exchange_rate(source: str = 'binance', supabase_manager: SupabaseManager = None):
    """
    Обновляет курс TON/USD из внешнего API и сохраняет в БД
    
    Args:
        source: Источник курса ('binance' или 'coingecko')
        supabase_manager: Экземпляр SupabaseManager (если None, создается новый)
    
    Returns:
        Decimal: Обновленный курс TON/USD или None при ошибке
    """
    if not supabase_manager:
        supabase_manager = SupabaseManager()
    
    rate = None
    
    try:
        if source == 'binance':
            # Binance API: TONUSDT
            response = requests.get(
                'https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT',
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                price_usdt = Decimal(str(data['price']))
                # USDT ≈ USD (примерно, можно добавить конвертацию USDT→USD если нужно)
                rate = price_usdt
                source_name = 'binance'
            else:
                logger.error(f"Binance API вернул статус {response.status_code}")
                return None
                
        elif source == 'coingecko':
            # CoinGecko API
            response = requests.get(
                'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                rate = Decimal(str(data['the-open-network']['usd']))
                source_name = 'coingecko'
            else:
                logger.error(f"CoinGecko API вернул статус {response.status_code}")
                return None
        else:
            logger.error(f"Неизвестный источник: {source}")
            return None
        
        if rate is None:
            logger.error("Не удалось получить курс")
            return None
        
        # Сохранить в БД
        try:
            # Обновить effective_until для предыдущих актуальных курсов
            supabase_manager.client.table('ton_exchange_rates').update({
                'effective_until': datetime.now().isoformat()
            }).is_('effective_until', 'null').execute()
            
            # Вставить новый курс
            supabase_manager.client.table('ton_exchange_rates').insert({
                'rate': float(rate),
                'source': source_name,
                'effective_from': datetime.now().isoformat()
            }).execute()
            
            logger.info(f"✅ Курс TON/USD обновлен: {rate} (источник: {source_name})")
            return rate
            
        except Exception as e:
            logger.error(f"Ошибка при сохранении курса в БД: {e}")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Ошибка при запросе к API ({source}): {e}")
        return None
    except Exception as e:
        logger.error(f"Неожиданная ошибка при обновлении курса: {e}")
        return None


def main():
    """Главная функция для запуска из командной строки"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Обновление курса TON/USD')
    parser.add_argument(
        '--source',
        choices=['binance', 'coingecko'],
        default='binance',
        help='Источник курса (по умолчанию: binance)'
    )
    
    args = parser.parse_args()
    
    logger.info("🔄 Начало обновления курса TON/USD...")
    
    sm = SupabaseManager()
    rate = update_ton_exchange_rate(source=args.source, supabase_manager=sm)
    
    if rate:
        logger.info(f"✅ Курс успешно обновлен: 1 TON = {rate} USD")
        sys.exit(0)
    else:
        logger.error("❌ Не удалось обновить курс")
        sys.exit(1)


if __name__ == "__main__":
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    main()
