"""
media_manager — подготовка к загрузке фото в WooCommerce.

СЕЙЧАС ТОЛЬКО DRY-RUN: ничего реально не загружает и не удаляет.
Показывает: что было бы загружено, что удалено, какие attachment_id найдены.

Безопасность (docs/SECURITY_RULES.md): старые фото удаляются ТОЛЬКО после того, как
новое успешно загружено + прикреплено + назначено. Перед удалением — backup.
Реальные write-операции включатся отдельным флагом dry_run=False (позже, после E2E-теста).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.logger import get_logger  # noqa: E402
from woocommerce.woocommerce_client import WooReadClient  # noqa: E402

log = get_logger("media_manager")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKUP_DIR = PROJECT_ROOT / "audit" / "backups"


class MediaManager:
    def __init__(self, run_id: str | None = None, dry_run: bool = True):
        self.dry_run = dry_run
        self.run_id = run_id or datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        self.read = WooReadClient()       # только чтение
        self.plan: list[dict] = []

    # -------------------- чтение/бэкап --------------------
    def _existing(self, product_id: int) -> list[dict]:
        imgs = self.read.list_product_images(product_id)
        return [{"attachment_id": i.get("id"), "image_url": i.get("src"),
                 "filename": (i.get("src") or "").split("/")[-1]} for i in imgs]

    def backup_existing_images(self, product_id: int) -> Path:
        """Сохранить текущие фото товара перед любым изменением (для отката)."""
        data = {
            "run_id": self.run_id,
            "product_id": product_id,
            "time": datetime.now().isoformat(timespec="seconds"),
            "images": self._existing(product_id),
        }
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        path = BACKUP_DIR / f"{self.run_id}_product_{product_id}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        log.info("backup product %s → %s (%d фото)", product_id, path.name, len(data["images"]))
        return path

    def restore_backup(self, product_id: int) -> dict | None:
        """Прочитать бэкап (для будущего rollback). Сейчас только возвращает данные."""
        path = BACKUP_DIR / f"{self.run_id}_product_{product_id}.json"
        if not path.exists():
            log.warning("backup не найден: %s", path.name)
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    # -------------------- загрузка (dry-run) --------------------
    def upload_image(self, product_id: int, image_path: str) -> dict:
        step = {"action": "upload_image", "product_id": product_id,
                "file": str(image_path), "dry_run": self.dry_run}
        if self.dry_run:
            log.info("[DRY] загрузил бы %s → товар %s", Path(image_path).name, product_id)
            self.plan.append(step)
            return {"planned": True, **step}
        raise NotImplementedError("write отключён до E2E-подтверждения")

    def upload_gallery(self, product_id: int, images: list[str]) -> list[dict]:
        return [self.upload_image(product_id, p) for p in images]

    def set_featured_image(self, product_id: int, image_path: str | None = None) -> dict:
        step = {"action": "set_featured", "product_id": product_id, "file": str(image_path),
                "dry_run": self.dry_run}
        if self.dry_run:
            log.info("[DRY] назначил бы главным: %s (товар %s)",
                     Path(image_path).name if image_path else "первое", product_id)
            self.plan.append(step)
            return {"planned": True, **step}
        raise NotImplementedError("write отключён до E2E-подтверждения")

    def remove_old_gallery(self, product_id: int, *, new_uploaded_ok: bool,
                           attached_ok: bool, assigned_ok: bool) -> dict:
        """Удалять старое ТОЛЬКО при всех успехах. Иначе — отказ (старое сохраняется)."""
        old = self._existing(product_id)
        if not (new_uploaded_ok and attached_ok and assigned_ok):
            log.warning("НЕ удаляю старые фото товара %s: не все этапы успешны "
                        "(uploaded=%s attached=%s assigned=%s)",
                        product_id, new_uploaded_ok, attached_ok, assigned_ok)
            return {"removed": False, "reason": "preconditions_failed", "old": old}
        self.backup_existing_images(product_id)
        step = {"action": "remove_old_gallery", "product_id": product_id,
                "would_remove": [o["attachment_id"] for o in old], "dry_run": self.dry_run}
        if self.dry_run:
            log.info("[DRY] удалил бы старые attachment_id %s (товар %s) — после бэкапа",
                     step["would_remove"], product_id)
            self.plan.append(step)
            return {"removed": False, "planned": True, **step}
        raise NotImplementedError("write отключён до E2E-подтверждения")


if __name__ == "__main__":
    mm = MediaManager(dry_run=True)
    pid = 41560  # Pride Uno plus
    log.info("=== MEDIA MANAGER DRY-RUN (товар %s) ===", pid)
    try:
        existing = mm._existing(pid)
        log.info("Текущие фото (%d):", len(existing))
        for e in existing:
            log.info("   attachment_id=%s | %s", e["attachment_id"], e["filename"])
        mm.upload_gallery(pid, ["images/generated/optimized/new1.webp",
                                "images/generated/optimized/new2.webp"])
        mm.set_featured_image(pid, "images/generated/optimized/new1.webp")
        r = mm.remove_old_gallery(pid, new_uploaded_ok=True, attached_ok=True, assigned_ok=True)
        log.info("Удаление старых: removed=%s would_remove=%s", r["removed"], r.get("would_remove"))
        log.info("Шагов в плане: %d. Реальных изменений сайта: 0 (dry-run).", len(mm.plan))
    except Exception as e:
        log.error("Сеть/ошибка чтения: %s (товар не прочитан, но логика dry-run цела)", type(e).__name__)
