#!/usr/bin/env python3
"""
Churn Prevention — единый job:
1) Обновление статистики визитов (compute_client_visit_stats)
2) Отбор кандидатов (get_churn_candidates)
3) Формирование оффера, отправка в Telegram, логирование (шаг 4)

Запуск по cron раз в день.
"""

import os
import sys
import json
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("churn_detector")

# Клиентский бот для отправки сообщений
TOKEN_CLIENT = os.getenv("TOKEN_CLIENT")
client_bot = None
if TOKEN_CLIENT:
    try:
        import telebot
        client_bot = telebot.TeleBot(TOKEN_CLIENT)
        logger.info("Client bot initialized for sending reactivation messages")
    except Exception as e:
        logger.warning("Failed to init client_bot: %s", e)
else:
    logger.warning("TOKEN_CLIENT not set — messages will NOT be sent")

# Шаблон сообщения по умолчанию
DEFAULT_MESSAGE_TEMPLATE = """👋 {client_name}, мы заметили, что вы давно не были у *{partner_name}*!

🎁 Специально для вас — {offer_text}

📲 Записаться: {partner_contact_link}
"""


def build_reactivation_message(offer_data: dict) -> str:
    """Формирует текст сообщения из данных оффера. Шаблон берётся из offer_data или дефолтный."""
    template = offer_data.get("message_template") or DEFAULT_MESSAGE_TEMPLATE
    return template.format(
        client_name=offer_data.get("client_name", "дорогой клиент"),
        partner_name=offer_data.get("partner_name", "партнёр"),
        offer_text=offer_data.get("offer_text", "специальное предложение"),
        partner_contact_link=offer_data.get("partner_contact_link") or offer_data.get("partner_booking_url") or "",
    )


def send_reactivation_message(chat_id: str, text: str) -> bool:
    """Отправляет сообщение клиенту. Возвращает True при успехе."""
    if not client_bot:
        logger.warning("client_bot not available — skipping send to %s", chat_id)
        return False
    try:
        client_bot.send_message(chat_id, text, parse_mode="Markdown")
        return True
    except Exception as e:
        logger.error("Failed to send message to %s: %s", chat_id, e)
        return False


def main():
    from supabase_manager import SupabaseManager

    sm = SupabaseManager()
    if not sm.client:
        logger.error("Supabase client not initialized. Check SUPABASE_URL and SUPABASE_KEY.")
        sys.exit(1)

    # 1) Обновить интервалы визитов
    n_stats = sm.compute_client_visit_stats()
    logger.info("compute_client_visit_stats: updated %s client-partner pairs", n_stats)

    # 2) Отбор кандидатов
    candidates = sm.get_churn_candidates(
        partner_chat_id=None,
        min_days_threshold=7,
        coefficient_k=2.0,
        reactivation_cooldown_days=14,
    )
    logger.info("get_churn_candidates: %s candidates", len(candidates))

    if not candidates:
        logger.info("No candidates to reactivate")
        print("[]")
        return

    sent_count = 0
    failed_count = 0

    for c in candidates:
        client_chat_id = c["client_chat_id"]
        partner_chat_id = c["partner_chat_id"]
        trigger_reason = c.get("trigger_reason", "churn")

        # 3) Данные для оффера
        offer_data = sm.get_reactivation_offer_data(client_chat_id, partner_chat_id)

        # 4) Сформировать сообщение
        message_text = build_reactivation_message(offer_data)

        # 5) Отправить
        success = send_reactivation_message(client_chat_id, message_text)

        # 6) Логировать
        sm.log_reactivation_event(
            client_chat_id=client_chat_id,
            partner_chat_id=partner_chat_id,
            status="sent" if success else "failed",
            trigger_reason=trigger_reason,
            message_text=message_text,
            error_message=None if success else "send failed",
        )

        if success:
            sent_count += 1
            logger.info("Sent reactivation to client=%s partner=%s", client_chat_id, partner_chat_id)
        else:
            failed_count += 1

    logger.info("Reactivation complete: sent=%s failed=%s", sent_count, failed_count)
    # Вывод итогового JSON
    print(json.dumps({"sent": sent_count, "failed": failed_count, "total": len(candidates)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
