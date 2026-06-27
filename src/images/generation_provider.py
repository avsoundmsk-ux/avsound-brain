"""
generation_provider — универсальный слой генерации изображений.

Pipeline НЕ знает, какая модель используется. Зовёт только generate().
Внутри выбирается провайдер по IMAGE_PROVIDER (.env), по умолчанию nanobanana.

Провайдеры сейчас:
  - NanoBananaProvider (основной) — google nano-banana edit через шлюз KIE.ai;
  - KieProvider (второй) — тот же шлюз KIE.ai (запас / иные модели KIE).
Добавить Flux Kontext / Gemini Edit позже = новый класс-провайдер, остальной код не меняется.

Общее (база): prompt (docs/KIE_PROMPTS.md), provider_name, cost_per_generation,
retry (до 3), budget_guard, единое сохранение (images/original, images/generated).
НИЧЕГО не грузит в WooCommerce.
"""
from __future__ import annotations

import base64
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.config_manager import config  # noqa: E402
from core.logger import get_logger  # noqa: E402
from core.budget_guard import BudgetGuard, BudgetExceeded  # noqa: E402

log = get_logger("generation_provider")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ORIGINAL_DIR = PROJECT_ROOT / "images" / "original"
GENERATED_DIR = PROJECT_ROOT / "images" / "generated"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0"}

PROMPT = (
    "Cut out ONLY the product from the original photo and place it on a brand-new background. "
    "COMPLETELY REMOVE and discard the original background. Do NOT keep any part of the original "
    "background, do NOT keep a framed photo, card, rectangle, border, inner picture or a second "
    "background behind the product — only the isolated product object remains. "
    "The new dark graphite-to-black studio background must be FULL-BLEED, filling the entire frame "
    "edge to edge, with soft radial backlight, a realistic reflection under the product and a subtle "
    "soft shadow. "
    "Keep the product itself exactly identical: same shape, proportions, color, materials, logos, "
    "branding, text, buttons, connectors, details. Center the product, fill ~80% of frame. "
    "Premium ecommerce product photo for AV-Sound.ru. Photorealistic, ultra sharp, 1:1 square. "
    "No people, no cars, no furniture, no extra objects, no text, no watermark, no distortion, "
    "no picture-in-picture, no inner frame."
)
MAX_ATTEMPTS = 3


class GenerationResult:
    def __init__(self, ok, provider, original_path=None, generated_path=None,
                 cost_usd=0.0, attempts=0, status="ok", reason=""):
        self.ok = ok
        self.provider = provider
        self.original_path = original_path
        self.generated_path = generated_path
        self.cost_usd = cost_usd
        self.attempts = attempts
        self.status = status        # ok | needs_manual_review | error | budget_exceeded
        self.reason = reason


def _download(url: str, dst: Path, tries: int = 8) -> Path:
    """Скачать с ретраями и backoff (нестабильная сеть = норма, NETWORK_POLICY.md)."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r, open(dst, "wb") as f:
                f.write(r.read())
            return dst
        except Exception as e:
            last = e
            wait = min(3 * (2 ** attempt), 60)
            log.warning("download повтор %d/%d: %s → %.0fс", attempt + 1, tries, type(e).__name__, wait)
            time.sleep(wait)
    raise last


def _too_light(path: Path) -> bool:
    """Грубая проверка тёмного фона (KIE/NB иногда дают светлый) → перегенерить."""
    try:
        from PIL import Image
        im = Image.open(path).convert("L")
        w, h = im.size
        strip = im.crop((0, 0, w, max(1, int(h * 0.06))))
        px = list(strip.getdata())
        return sum(px) / len(px) > 110
    except Exception:
        return False


class ImageGenerationProvider:
    """Общий интерфейс. Провайдеры реализуют _generate_once()."""
    provider_name = "base"
    cost_per_generation = 0.0

    def __init__(self, budget: BudgetGuard | None = None):
        self.budget = budget or BudgetGuard()

    def _generate_once(self, original_path: Path, out_path: Path) -> bool:
        raise NotImplementedError

    def generate(self, image_url: str, stem: str) -> GenerationResult:
        """Единый алгоритм для всех провайдеров. Pipeline вызывает только это."""
        try:
            original = _download(image_url, ORIGINAL_DIR / f"{stem}.jpg")
        except Exception as e:
            return GenerationResult(False, self.provider_name, status="error",
                                    reason=f"download_failed:{type(e).__name__}")

        out_path = GENERATED_DIR / f"{stem}.png"
        attempts = 0
        for attempt in range(1, MAX_ATTEMPTS + 1):
            attempts = attempt
            try:
                self.budget.charge(self.cost_per_generation, images=1)
            except BudgetExceeded:
                return GenerationResult(False, self.provider_name, original_path=original,
                                        cost_usd=self.budget.spent_usd, attempts=attempt - 1,
                                        status="budget_exceeded", reason="budget")
            try:
                ok = self._generate_once(original, out_path)
            except NotImplementedError:
                return GenerationResult(False, self.provider_name, original,
                                        cost_usd=self.budget.spent_usd, attempts=attempt,
                                        status="error", reason="provider_not_implemented")
            except Exception as e:
                log.warning("%s попытка %d ошибка: %s", self.provider_name, attempt, type(e).__name__)
                ok = False
            if ok and out_path.exists() and not _too_light(out_path):
                return GenerationResult(True, self.provider_name, original, out_path,
                                        self.budget.spent_usd, attempt, "ok")
            log.warning("%s попытка %d: неудачно/светлый фон", self.provider_name, attempt)

        return GenerationResult(False, self.provider_name, original,
                                out_path if out_path.exists() else None,
                                self.budget.spent_usd, attempts,
                                "needs_manual_review", "distorted_or_light_after_retries")


class _KieGatewayMixin:
    """Общий доступ к шлюзу KIE.ai (через него работает и Nano Banana)."""
    UPLOAD = "https://kieai.redpandaai.co/api/file-base64-upload"
    BASE = "https://api.kie.ai/api/v1/jobs"
    model = "google/nano-banana-edit"

    def _key(self) -> str:
        return config.require("KIE_API_KEY")

    def _headers(self):
        return {"Authorization": f"Bearer {self._key()}", "Content-Type": "application/json"}

    def _upload(self, path: Path) -> str:
        b64 = base64.b64encode(path.read_bytes()).decode()
        payload = {"base64Data": f"data:image/jpeg;base64,{b64}",
                   "uploadPath": "avsound/img", "fileName": path.name}
        r = requests.post(self.UPLOAD, json=payload, headers=self._headers(), timeout=60)
        url = (r.json().get("data") or {}).get("downloadUrl")
        if not url:
            raise RuntimeError(f"upload_no_url:{r.text[:120]}")
        return url

    def _run(self, original_path: Path, out_path: Path) -> bool:
        src_url = self._upload(original_path)
        body = {"model": self.model,
                "input": {"prompt": PROMPT, "image_urls": [src_url], "output_format": "png"}}
        r = requests.post(f"{self.BASE}/createTask", json=body, headers=self._headers(), timeout=60)
        task_id = (r.json().get("data") or {}).get("taskId")
        if not task_id:
            raise RuntimeError(f"no_task:{r.text[:120]}")
        for _ in range(60):
            d = requests.get(f"{self.BASE}/recordInfo?taskId={task_id}",
                             headers=self._headers(), timeout=60).json().get("data", {})
            state = str(d.get("state", "")).lower()
            if state in ("success", "completed", "succeed"):
                rj = d.get("resultJson")
                url = None
                if isinstance(rj, str):
                    try:
                        url = (json.loads(rj).get("resultUrls") or [None])[0]
                    except Exception:
                        pass
                if not url:
                    m = re.search(r"https?://[^\s\"']+\.(png|jpg|jpeg|webp)", json.dumps(d))
                    url = m.group(0) if m else None
                if not url:
                    return False
                _download(url, out_path)
                return True
            if state in ("fail", "failed", "error"):
                return False
            time.sleep(5)
        return False


class NanoBananaProvider(ImageGenerationProvider, _KieGatewayMixin):
    """ОСНОВНОЙ. Nano Banana (google nano-banana-edit) — лучшее качество для карточек."""
    provider_name = "nanobanana"
    cost_per_generation = 0.02
    model = "google/nano-banana-edit"

    def _generate_once(self, original_path: Path, out_path: Path) -> bool:
        return self._run(original_path, out_path)


class KieProvider(ImageGenerationProvider, _KieGatewayMixin):
    """Второй провайдер (шлюз KIE.ai). Запас / иные модели KIE."""
    provider_name = "kie"
    cost_per_generation = 0.02
    model = "google/nano-banana-edit"

    def _generate_once(self, original_path: Path, out_path: Path) -> bool:
        return self._run(original_path, out_path)


class DarkBgProvider(ImageGenerationProvider):
    """Детерминированный (без ИИ, бесплатно): вырез фона + тёмный студийный градиент.
    Надёжно «вырезает товар и ставит на фон» — без двойного фона/рамок."""
    provider_name = "darkbg"
    cost_per_generation = 0.0

    def _generate_once(self, original_path: Path, out_path: Path) -> bool:
        tools_dir = PROJECT_ROOT / "tools"
        sys.path.insert(0, str(tools_dir))
        import dark_bg
        dark_bg.run(str(original_path), str(out_path))
        return out_path.exists()


PROVIDERS = {"nanobanana": NanoBananaProvider, "kie": KieProvider, "darkbg": DarkBgProvider}


def get_provider(budget: BudgetGuard | None = None) -> ImageGenerationProvider:
    """Фабрика по IMAGE_PROVIDER (.env). По умолчанию nanobanana."""
    name = (config.get("IMAGE_PROVIDER", "nanobanana") or "nanobanana").lower()
    cls = PROVIDERS.get(name)
    if not cls:
        raise RuntimeError(f"unknown IMAGE_PROVIDER: {name} (есть: {', '.join(PROVIDERS)})")
    return cls(budget)


def generate(image_url: str, stem: str, budget: BudgetGuard | None = None) -> GenerationResult:
    """Точка входа для pipeline — провайдер скрыт."""
    return get_provider(budget).generate(image_url, stem)


if __name__ == "__main__":
    log.info("IMAGE_PROVIDER=%s (по умолчанию nanobanana)", config.get("IMAGE_PROVIDER", "nanobanana"))
    log.info("Доступные провайдеры: %s", ", ".join(PROVIDERS))
    p = get_provider()
    log.info("Активный провайдер: %s | цена/ген $%.3f", p.provider_name, p.cost_per_generation)
