
"""
Application entry point.

Session-based authentication:
  1. Access key authentication via session cookie (no URL params)
  2. Concurrency control (Semaphore 2)
  3. No file persistence
"""

import os
import asyncio

from fastapi import FastAPI, Request, Form, HTTPException, Depends
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.api import watermark

ACCESS_KEY = os.environ.get("ACCESS_KEY", "20230412")
SESSION_SECRET = os.environ.get("SESSION_SECRET", os.urandom(24).hex())
process_semaphore = asyncio.Semaphore(2)

app = FastAPI(
    title="Blind Watermark Web",
    description="Blind watermark tool - session based auth",
    version="0.2.0",
)

app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, max_age=86400)


def is_authenticated(request: Request) -> bool:
    try:
        return request.session.get("authenticated") == True
    except Exception:
        return False


async def require_auth(request: Request):
    if not is_authenticated(request):
        raise HTTPException(status_code=403, detail="Not authenticated")


app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.include_router(watermark.router, prefix="/api/watermark", dependencies=[Depends(require_auth)])
app.state.process_semaphore = process_semaphore


@app.get("/api/login")
async def login_page():
    return FileResponse("app/templates/auth.html")


@app.post("/api/login")
async def login(request: Request, key: str = Form(...)):
    if key == ACCESS_KEY:
        request.session["authenticated"] = True
        return {"success": True}
    return JSONResponse(status_code=403, content={"success": False, "detail": "Invalid key"})


@app.post("/api/logout")
async def logout(request: Request):
    request.session.clear()
    return {"success": True}


@app.get("/")
async def index(request: Request):
    if is_authenticated(request):
        return FileResponse("app/templates/index.html")
    return FileResponse("app/templates/auth.html")


@app.get("/blind-watermark")
async def index_blind(request: Request):
    if is_authenticated(request):
        return FileResponse("app/templates/index.html")
    return FileResponse("app/templates/auth.html")


@app.get("/health")
async def health():
    return {"status": "ok"}
