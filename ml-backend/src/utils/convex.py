import os
from urllib.parse import urlparse
from convex import ConvexClient
from src.utils.logger import logger
from dotenv import load_dotenv

load_dotenv()
CONVEX_URL = os.getenv("NEXT_PUBLIC_CONVEX_URL", "mock_url")
convex_client = None

def _is_mock_convex_url(url: str) -> bool:
    return (not url) or ("mock" in url.lower())

def get_convex_client() -> ConvexClient | None:
    global convex_client

    if convex_client is not None:
        return convex_client

    if _is_mock_convex_url(CONVEX_URL):
        return None

    parsed = urlparse(CONVEX_URL)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        logger.warning(
            "Invalid NEXT_PUBLIC_CONVEX_URL for Convex: %r. Running without Convex.",
            CONVEX_URL,
        )
        return None

    try:
        convex_client = ConvexClient(CONVEX_URL)
        return convex_client
    except Exception:
        logger.exception("Failed to initialize ConvexClient")
        return None
