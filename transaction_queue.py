import json
import logging
import os
import threading
from pathlib import Path
from typing import Optional


class TransactionQueue:
    """Локальная очередь транзакций с отложенной обработкой."""

    def __init__(self, manager, storage_path: Optional[str] = None):
        self.manager = manager
        base_path = storage_path or os.getenv("TRANSACTION_QUEUE_PATH", "transaction_queue.json")
        self._path = Path(base_path)
        self._lock = threading.Lock()
        self._processing = False

    def enqueue(self, payload: dict) -> bool:
        """Сохраняет транзакцию для повторной обработки."""
        if not payload:
            return False
        try:
            with self._lock:
                queue = self._read_queue()
                queue.append(payload)
                self._write_queue(queue)
            logging.warning(f"Транзакция поставлена в очередь: {payload}")
            return True
        except Exception as e:
            logging.error(f"Не удалось сохранить транзакцию в очередь: {e}")
            return False

    def enqueue_manual(self, client_chat_id: str, partner_chat_id: str, txn_type: str, raw_amount: float) -> bool:
        payload = {
            "client_chat_id": str(client_chat_id),
            "partner_chat_id": str(partner_chat_id),
            "txn_type": txn_type,
            "raw_amount": raw_amount
        }
        return self.enqueue(payload)

    def list_pending(self) -> list:
        with self._lock:
            return list(self._read_queue())

    def clear(self):
        with self._lock:
            self._write_queue([])

    def process_pending(self):
        """Пытается выполнить отложенные транзакции."""
        if self._processing:
            return {"processed": 0, "failed": 0}

        try:
            with self._lock:
                queue = self._read_queue()
                if not queue:
                    return {"processed": 0, "failed": 0}
                self._write_queue([])
                self._processing = True

            remaining = []
            processed = 0
            for payload in queue:
                try:
                    result = self.manager.execute_transaction(
                        payload.get("client_chat_id"),
                        payload.get("partner_chat_id"),
                        payload.get("txn_type"),
                        payload.get("raw_amount"),
                        allow_queue=False
                    )
                    if not result.get("success"):
                        logging.warning(f"Не удалось провести отложенную транзакцию: {payload} -> {result}")
                        remaining.append(payload)
                    else:
                        processed += 1
                except Exception as e:
                    logging.error(f"Ошибка обработки отложенной транзакции {payload}: {e}")
                    remaining.append(payload)

            if remaining:
                with self._lock:
                    current_queue = self._read_queue()
                    current_queue.extend(remaining)
                    self._write_queue(current_queue)

            return {"processed": processed, "failed": len(remaining)}
        finally:
            self._processing = False

    def _read_queue(self) -> list:
        if not self._path.exists():
            return []
        try:
            data = self._path.read_text(encoding='utf-8')
            if not data:
                return []
            return json.loads(data)
        except Exception:
            logging.error("Не удалось прочитать файл очереди транзакций. Очередь будет очищена.")
            return []

    def _write_queue(self, queue: list):
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(queue, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

