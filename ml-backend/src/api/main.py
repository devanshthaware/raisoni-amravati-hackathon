"""
FastAPI main application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import traceback
from src.api.routes_login import router as login_router
from src.api.routes_auth import router as auth_router
from src.api.routes_session import router as session_router
from src.api.routes_device import router as device_router
from src.api.routes_baseline import router as baseline_router
from src.api.routes_global import router as global_router
from src.api.routes_risk import router as risk_router
from src.api.routes_support import router as support_router
from src.api.schemas import HealthResponse
from src.inference.model_loader import get_models
from src.config.settings import API_HOST, API_PORT, API_RELOAD
from src.utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    Loads models on startup.
    """
    # Startup
    logger.info("=" * 60)
    logger.info("Starting ML Backend Service")
    logger.info("=" * 60)
    
    try:
        logger.info("Loading ML models...")
        models = get_models()
        logger.info(f"Successfully loaded {len(models)} models: {list(models.keys())}")
        logger.info("Service ready to accept requests")
    except Exception as e:
        logger.error(f"Failed to load models: {e}")
        logger.error(traceback.format_exc())
        raise
    
    logger.info("=" * 60)
    
    yield
    
    # Shutdown
    logger.info("Shutting down ML Backend Service")


# Create FastAPI app
app = FastAPI(
    title="Adaptive Auth ML Backend",
    description="ML Backend Service for Adaptive Authentication Risk Assessment",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
# Setting allowed origins to the frontend application URL
ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:8000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key & Origin Middleware
@app.middleware("http")
async def validate_api_key_and_origin(request: Request, call_next):
    # Skip validation for health and root
    if request.url.path in ["/health", "/", "/docs", "/openapi.json"]:
        return await call_next(request)
    
    # Origin validation
    origin = request.headers.get("origin")
    if origin and origin not in ALLOWED_ORIGINS:
        return JSONResponse(
            status_code=403,
            content={"detail": f"Forbidden: Invalid Origin {origin}"}
        )
    
    api_key = request.headers.get("x-api-key")
    expected_key = os.getenv("ML_API_KEY", "aegis_master_key_2024")
    
    if not api_key or api_key != expected_key:
        return JSONResponse(
            status_code=401,
            content={"detail": "Unauthorized: Invalid or missing API key"}
        )
    
    return await call_next(request)

# Include routers
app.include_router(login_router)
app.include_router(auth_router)
app.include_router(session_router)
app.include_router(device_router)
app.include_router(baseline_router)
app.include_router(global_router)
app.include_router(risk_router)
app.include_router(support_router)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error": str(exc),
        },
    )


# Health check endpoint
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        Health status and model loading status
    """
    try:
        models = get_models()
        return HealthResponse(
            status="healthy",
            models_loaded=True,
            models_count=len(models),
            message=f"Service is healthy. {len(models)} models loaded.",
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            models_loaded=False,
            models_count=0,
            message=f"Service is unhealthy: {str(e)}",
        )


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "service": "Adaptive Auth ML Backend",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "src.api.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=API_RELOAD,
        log_level="info",
    )
