import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "dhan"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    google_vision_api_key: str | None = None

    # Udhaar links point here (the frontend URL customers open).
    app_base_url: str = os.environ.get("RENDER_EXTERNAL_URL", "http://localhost:5173")  # Render sets this automatically
    reminders_enabled: bool = True

    # Optional integrations. Unset = simulated (messages go to the in-app outbox instead of the network).
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    whatsapp_token: str | None = None  # Meta WhatsApp Cloud API
    whatsapp_phone_id: str | None = None
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_webhook_secret: str | None = None

    # DHAN AI (Groq, OpenAI-compatible API). Unset = built-in rules engine answers from the same data tools.
    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-120b"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_stt_model: str = "whisper-large-v3-turbo"  # speech-to-text (Hindi/Marathi/English voice)
    groq_vision_model: str = "qwen/qwen3.8-27b"  # reads bill photos

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    render_url = os.environ.get("RENDER_EXTERNAL_URL")
    if render_url and any(h in s.app_base_url for h in ("localhost", "127.0.0.1")):  # a local .env value copied to Render
        s.app_base_url = render_url
    return s
