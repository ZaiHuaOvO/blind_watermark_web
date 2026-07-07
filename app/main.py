"""
Application entry point.

Stateless server:
  1. Access key authentication
  2. Concurrency control (Semaphore 2)
  3. No file persistence
"""

import os
import asyncio

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import watermark

ACCESS_KEY = os.environ.get("ACCESS_KEY", "20230412")
process_semaphore = asyncio.Semaphore(2)

app = FastAPI(
    title="Blind Watermark Web",
    description="Blind watermark tool - stateless server",
    version="0.1.0",
)

@app.middleware("http")
async def access_key_middleware(request: Request, call_next):
    if request.url.path in ("/", "/health") and request.method == "GET":
        return await call_next(request)
    if request.url.path.startswith("/static/"):
        return await call_next(request)

    key = request.query_params.get("key", "")
    if not key:
        key = request.headers.get("X-Access-Key", "")

    if key != ACCESS_KEY:
        return JSONResponse(status_code=403, content={"detail": "Invalid access key"})

    return await call_next(request)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.include_router(watermark.router, prefix="/api/watermark")
app.state.process_semaphore = process_semaphore


@app.get("/")
async def index(request: Request):
    key = request.query_params.get("key", "")

    if not key:
        return FileResponse("app/templates/auth.html")

    if key != ACCESS_KEY:
        return FileResponse("app/templates/auth.html?error=1")

    return FileResponse("app/templates/index.html")


@app.get("/health")
async def health():
    return {"status": "ok"}
