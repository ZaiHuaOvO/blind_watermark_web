"""
Watermark API routes.
"""

import asyncio
import logging
import time
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException, Query
from pydantic import BaseModel

from app.services import blind_service, file_service

_logger = logging.getLogger("watermark_api")
_logger.setLevel(logging.INFO)
if not _logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    _logger.addHandler(_handler)

router = APIRouter()


class UrlEmbedRequest(BaseModel):
    url: str
    text: str
    password: str = ""

class UrlExtractRequest(BaseModel):
    url: str
    password: str = ""
    wm_length: Optional[int] = None

class BatchUrlEmbedRequest(BaseModel):
    urls: list[str]
    text: str
    password: str = ""

class BatchUrlExtractRequest(BaseModel):
    urls: list[str]
    password: str = ""

def _get_semaphore(request: Request):
    return request.app.state.process_semaphore


@router.post("/embed")
async def embed_watermark(
    request: Request,
    file: UploadFile = File(...),
    text: str = Form(...),
    password: str = Form(""),
):
    t0 = time.time()
    _logger.info(f"[TIMING] /embed file={file.filename}")
    async with _get_semaphore(request):
        try:
            file_service.validate_image_type(file.filename)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        try:
            upload_path = file_service.save_upload(file)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        try:
            result = await asyncio.to_thread(
                blind_service.embed,
                input_path=upload_path,
                watermark_text=text,
                password=password,
            )
            _logger.info(f"[TIMING] /embed done {time.time()-t0:.2f}s")
            return result
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            _logger.error(f"/embed unexpected: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"server error: {str(e)[:200]}")
        finally:
            file_service.cleanup(upload_path)


@router.post("/extract")
async def extract_watermark(
    request: Request,
    file: UploadFile = File(...),
    password: str = Form(""),
    wm_length: int = Form(None),
    channel_id: str = Query("extract", description="log channel"),
):
    t0 = time.time()
    _logger.info(f"[TIMING] /extract file={file.filename} channel={channel_id}")
    async with _get_semaphore(request):
        try:
            upload_path = await asyncio.to_thread(file_service.save_upload, file)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        try:
            params = blind_service.parse_params_from_filename(file.filename)
            length = wm_length or params.get("wm_length")
            if length is None:
                result = await asyncio.to_thread(
                    blind_service.extract_auto,
                    input_path=upload_path,
                    password=password,
                    channel_id=channel_id,
                )
            else:
                result = await asyncio.to_thread(
                    blind_service.extract,
                    input_path=upload_path,
                    wm_length=length,
                    password=password,
                )
            _logger.info(f"[TIMING] /extract done {time.time()-t0:.2f}s success={result.get('success')}")
            return result
        finally:
            file_service.cleanup(upload_path)


@router.post("/embed/batch")
async def embed_batch(
    request: Request,
    files: list[UploadFile] = File(...),
    text: str = Form(...),
    password: str = Form(""),
):
    results = []
    for file in files:
        try:
            file_service.validate_image_type(file.filename)
            upload_path = file_service.save_upload(file)
            try:
                result = blind_service.embed(input_path=upload_path, watermark_text=text, password=password)
                results.append({
                    "file_name": file.filename, "success": True,
                    "output_name": result["output_name"], "image_data": result["image_data"],
                    "has_password": result["has_password"],
                })
            finally:
                file_service.cleanup(upload_path)
        except ValueError as e:
            results.append({"file_name": file.filename, "success": False, "error": str(e)})
        except Exception as e:
            results.append({"file_name": file.filename, "success": False, "error": f"server error: {str(e)[:200]}"})
    return {"items": results}


@router.post("/extract/batch")
async def extract_batch(
    request: Request,
    files: list[UploadFile] = File(...),
    password: str = Form(""),
    channel_id: str = Query("extractBatch", description="log channel"),
):
    results = []
    for file in files:
        try:
            upload_path = file_service.save_upload(file)
        except ValueError as e:
            results.append({"file_name": file.filename, "text": str(e), "success": False})
            continue
        try:
            params = blind_service.parse_params_from_filename(file.filename)
            length = params.get("wm_length")
            if not length:
                result = blind_service.extract_auto(input_path=upload_path, password=password, channel_id=channel_id)
            else:
                result = blind_service.extract(input_path=upload_path, wm_length=length, password=password)
            results.append({"file_name": file.filename, **result})
        finally:
            file_service.cleanup(upload_path)
    return {"items": results}


@router.post("/embed/from-url")
async def embed_watermark_from_url(request: Request, body: UrlEmbedRequest):
    async with _get_semaphore(request):
        try:
            upload_path = file_service.download_from_url(body.url)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        try:
            result = blind_service.embed(input_path=upload_path, watermark_text=body.text, password=body.password)
            return result
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            _logger.error(f"/embed/from-url unexpected: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"server error: {str(e)[:200]}")
        finally:
            file_service.cleanup(upload_path)


@router.post("/extract/from-url")
async def extract_watermark_from_url(
    request: Request,
    body: UrlExtractRequest,
    channel_id: str = Query("extract", description="log channel"),
):
    async with _get_semaphore(request):
        try:
            upload_path = await asyncio.to_thread(file_service.download_from_url, body.url)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        try:
            params = blind_service.parse_params_from_filename(upload_path)
            length = body.wm_length or params.get("wm_length")
            if length is None:
                result = await asyncio.to_thread(
                    blind_service.extract_auto, input_path=upload_path, password=body.password, channel_id=channel_id)
            else:
                result = await asyncio.to_thread(
                    blind_service.extract, input_path=upload_path, wm_length=length, password=body.password)
            return result
        finally:
            file_service.cleanup(upload_path)


@router.post("/embed/batch-from-url")
async def embed_batch_from_url(request: Request, body: BatchUrlEmbedRequest):
    results = []
    for url in body.urls:
        try:
            upload_path = file_service.download_from_url(url)
            try:
                result = blind_service.embed(input_path=upload_path, watermark_text=body.text, password=body.password)
                results.append({
                    "file_name": url, "success": True,
                    "output_name": result["output_name"], "image_data": result["image_data"],
                    "has_password": result["has_password"],
                })
            finally:
                file_service.cleanup(upload_path)
        except ValueError as e:
            results.append({"file_name": url, "success": False, "error": str(e)})
        except Exception as e:
            results.append({"file_name": url, "success": False, "error": f"server error: {str(e)[:200]}"})
    return {"items": results}


@router.post("/extract/batch-from-url")
async def extract_batch_from_url(
    request: Request,
    body: BatchUrlExtractRequest,
    channel_id: str = Query("extractBatch", description="log channel"),
):
    results = []
    for url in body.urls:
        try:
            upload_path = file_service.download_from_url(url)
        except ValueError as e:
            results.append({"file_name": url, "text": str(e), "success": False})
            continue
        try:
            params = blind_service.parse_params_from_filename(upload_path)
            length = params.get("wm_length")
            if not length:
                result = blind_service.extract_auto(input_path=upload_path, password=body.password, channel_id=channel_id)
            else:
                result = blind_service.extract(input_path=upload_path, wm_length=length, password=body.password)
            results.append({"file_name": url, **result})
        finally:
            file_service.cleanup(upload_path)
    return {"items": results}


@router.post("/embed/multi-text")
async def embed_multi_text(
    request: Request,
    files: list[UploadFile] = File(...),
    texts: str = Form(...),
    password: str = Form(""),
):
    import json
    try:
        text_list = json.loads(texts)
    except Exception:
        raise HTTPException(status_code=400, detail="texts format error, need JSON array")
    if len(files) != len(text_list):
        raise HTTPException(status_code=400, detail="file count != text count")
    results = []
    for idx, file in enumerate(files):
        try:
            file_service.validate_image_type(file.filename)
            upload_path = file_service.save_upload(file)
            try:
                wm_text = text_list[idx]
                result = blind_service.embed(input_path=upload_path, watermark_text=wm_text, password=password)
                output_name = blind_service.build_output_name_with_text(
                    file.filename, wm_text, result["wm_length"], password)
                result["output_name"] = output_name
                results.append({
                    "file_name": file.filename, "watermark_text": wm_text, "success": True,
                    "output_name": output_name, "image_data": result["image_data"],
                    "has_password": result["has_password"],
                })
            finally:
                file_service.cleanup(upload_path)
        except ValueError as e:
            results.append({"file_name": file.filename, "success": False, "error": str(e)})
        except Exception as e:
            results.append({"file_name": file.filename, "success": False, "error": f"server error: {str(e)[:200]}"})
    return {"items": results}


@router.post("/embed/one-to-multi")
async def embed_one_to_multi(
    request: Request,
    file: UploadFile = File(...),
    texts: str = Form(...),
    password: str = Form(""),
):
    import json
    try:
        text_list = json.loads(texts)
    except Exception:
        raise HTTPException(status_code=400, detail="texts format error, need JSON array")
    if not text_list:
        raise HTTPException(status_code=400, detail="at least one text required")
    results = []
    upload_path = None
    try:
        file_service.validate_image_type(file.filename)
        upload_path = file_service.save_upload(file)
        for wm_text in text_list:
            try:
                result = blind_service.embed(input_path=upload_path, watermark_text=wm_text, password=password)
                output_name = blind_service.build_output_name_with_text(
                    file.filename, wm_text, result["wm_length"], password)
                result["output_name"] = output_name
                results.append({
                    "file_name": file.filename, "watermark_text": wm_text, "success": True,
                    "output_name": output_name, "image_data": result["image_data"],
                    "has_password": result["has_password"],
                })
            except Exception as e:
                results.append({
                    "file_name": file.filename, "watermark_text": wm_text,
                    "success": False, "error": str(e),
                })
    except ValueError as e:
        results.append({"file_name": file.filename, "success": False, "error": str(e)})
    except Exception as e:
        results.append({"file_name": file.filename, "success": False, "error": f"server error: {str(e)[:200]}"})
    finally:
        if upload_path:
            file_service.cleanup(upload_path)
    return {"items": results}


@router.get("/logs")
async def get_extract_logs(
    channel_id: str = Query("extract", description="log channel id"),
    since: int = Query(0, description="last consumed position"),
):
    from app.services.blind_service import get_recent_logs
    events, total = get_recent_logs(channel_id, since)
    return {"logs": events, "total": total, "channel_id": channel_id}
