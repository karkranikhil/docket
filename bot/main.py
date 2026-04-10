from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("docket")

REQUIRED_ENV_VARS = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_NUMBER",
    "STRIPE_SECRET_KEY",
]


def _validate_env() -> None:
    missing = [v for v in REQUIRED_ENV_VARS if not os.getenv(v)]
    if missing:
        logger.error("Missing required environment variables: %s", ", ".join(missing))
        logger.error("Bot will start but webhook processing will fail until these are set.")


app = FastAPI(title="Docket Bot", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://docket.com.au"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    _validate_env()
    logger.info("Docket bot started — all env vars validated")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


from webhook import router as webhook_router  # noqa: E402

app.include_router(webhook_router)
