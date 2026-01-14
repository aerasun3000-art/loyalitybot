import asyncio
import logging
from typing import List, Dict, Any

from dotenv import load_dotenv

from supabase_manager import SupabaseManager
from ai_helper import translate_text_ai


load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("backfill_news_translations")


async def backfill_news_translations() -> None:
    """
    Заполняет отсутствующие английские переводы для существующих новостей.
    Использует тот же AI-переводчик и кэш, что и админ-бот.
    """
    db = SupabaseManager()
    if not getattr(db, "client", None):
        logger.error("Supabase client is not initialized. Check SUPABASE_URL / SUPABASE_KEY.")
        return

    logger.info("Загружаем существующие новости...")
    try:
        response = (
            db.client.from_("news")
            .select("id,title,content,preview_text,title_en,content_en,preview_text_en")
            .execute()
        )
    except Exception as e:
        logger.error(f"Failed to load news from Supabase: {e}")
        return

    rows: List[Dict[str, Any]] = response.data or []
    logger.info(f"Найдено новостей: {len(rows)}")

    for row in rows:
        news_id = row.get("id")
        if news_id is None:
            continue

        updates: Dict[str, Any] = {}

        title = row.get("title") or ""
        content = row.get("content") or ""
        preview_text = row.get("preview_text") or ""

        # Пропускаем, если все переводы уже есть
        if row.get("title_en") and row.get("content_en") and row.get("preview_text_en"):
            continue

        if title and not row.get("title_en"):
            updates["title_en"] = await translate_text_ai(title, target_lang="en", source_lang="ru")

        if content and not row.get("content_en"):
            updates["content_en"] = await translate_text_ai(content, target_lang="en", source_lang="ru")

        if (preview_text or content) and not row.get("preview_text_en"):
            source_preview = preview_text or content[:200]
            updates["preview_text_en"] = await translate_text_ai(
                source_preview, target_lang="en", source_lang="ru"
            )

        if not updates:
            continue

        logger.info(f"Обновляем новости ID={news_id} полями: {list(updates.keys())}")
        ok = db.update_news(news_id, updates)
        if not ok:
            logger.error(f"Не удалось обновить новость ID={news_id}")


if __name__ == "__main__":
    asyncio.run(backfill_news_translations())





