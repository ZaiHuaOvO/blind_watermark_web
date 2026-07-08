"""
Watermark API routes.

All interfaces implement "delete-after-use" temporary file strategy.
Embed endpoints return base64 image data, no files retained on server.
"""

from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException
from pydantic import BaseModel

from app.services import blind_service, file_service

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
            result = blind_service.embed(
                input_path=upload_path,
                watermark_text=text,
                password=password,
            )
            return result
        finally:
            file_service.cleanup(upload_path)


@router.post("/extract")
async def extract_watermark(
    request: Request,
    file: UploadFile = File(...),
    password: str = Form(""),
    wm_length: int = Form(None),
):
    async with _get_semaphore(request):
        try:
            upload_path = file_service.save_upload(file)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        try:
            params = blind_service.parse_params_from_filename(file.filename)
            length = wm_length or params.get("wm_length")

            if length is None:
                return blind_service.extract_auto(
                    input_path=upload_path,
                    password=password,
                )

            return blind_service.extract(
                input_path=upload_path,
                wm_length=length,
                password=password,
            )
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
                result = blind_service.embed(
                    input_path=upload_path,
                    watermark_text=text,
                    password=password,
                )
                results.append({
                    "file_name": file.filename,
                    "success": True,
                    "output_name": result["output_name"],
                    "image_data": result["image_data"],
                    "has_password": result["has_password"],
                })
            finally:
                file_service.cleanup(upload_path)

        except Exception as e:
            results.append({
                "file_name": file.filename,
                "success": False,
                "error": str(e),
            })

    return {"items": results}


@router.post("/extract/batch")
async def extract_batch(
    request: Request,
    files: list[UploadFile] = File(...),
    password: str = Form(""),
):
    results = []

    for file in files:
        try:
            upload_path = file_service.save_upload(file)
        except ValueError as e:
            results.append({
                "file_name": file.filename,
                "text": str(e),
                "success": False,
            })
            continue

        try:
            params = blind_service.parse_params_from_filename(file.filename)
            length = params.get("wm_length")

            if not length:
                result = blind_service.extract_auto(
                    input_path=upload_path,
                    password=password,
                )
                results.append({
                    "file_name": file.filename,
                    **result,
                })
                continue

            result = blind_service.extract(
                input_path=upload_path,
                wm_length=length,
                password=password,
            )
            results.append({
                "file_name": file.filename,
                **result,
            })
        finally:
            file_service.cleanup(upload_path)

    return {"items": results}


@router.post("/embed/from-url")
async def embed_watermark_from_url(
    request: Request,
    body: UrlEmbedRequest,
):
    """从 URL 下载图片并嵌入水印"""
    async with _get_semaphore(request):
        try:
            upload_path = file_service.download_from_url(body.url)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        try:
            result = blind_service.embed(
                input_path=upload_path,
                watermark_text=body.text,
                password=body.password,
            )
            return result
        finally:
            file_service.cleanup(upload_path)


@router.post("/extract/from-url")
async def extract_watermark_from_url(
    request: Request,
    body: UrlExtractRequest,
):
    """从 URL 下载图片并提取水印"""
    async with _get_semaphore(request):
        try:
            upload_path = file_service.download_from_url(body.url)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        try:
            params = blind_service.parse_params_from_filename(upload_path)
            length = body.wm_length or params.get("wm_length")

            if length is None:
                return blind_service.extract_auto(
                    input_path=upload_path,
                    password=body.password,
                )

            return blind_service.extract(
                input_path=upload_path,
                wm_length=length,
                password=body.password,
            )
        finally:
            file_service.cleanup(upload_path)


@router.post("/embed/batch-from-url")
async def embed_batch_from_url(
    request: Request,
    body: BatchUrlEmbedRequest,
):
    """从多个 URL 下载图片并批量嵌入水印"""
    results = []

    for url in body.urls:
        try:
            upload_path = file_service.download_from_url(url)
            try:
                result = blind_service.embed(
                    input_path=upload_path,
                    watermark_text=body.text,
                    password=body.password,
                )
                results.append({
                    "file_name": url,
                    "success": True,
                    "output_name": result["output_name"],
                    "image_data": result["image_data"],
                    "has_password": result["has_password"],
                })
            finally:
                file_service.cleanup(upload_path)

        except Exception as e:
            results.append({
                "file_name": url,
                "success": False,
                "error": str(e),
            })

    return {"items": results}


@router.post("/extract/batch-from-url")
async def extract_batch_from_url(
    request: Request,
    body: BatchUrlExtractRequest,
):
    """从多个 URL 下载图片并批量提取水印"""
    results = []

    for url in body.urls:
        try:
            upload_path = file_service.download_from_url(url)
        except ValueError as e:
            results.append({
                "file_name": url,
                "text": str(e),
                "success": False,
            })
            continue

        try:
            params = blind_service.parse_params_from_filename(upload_path)
            length = params.get("wm_length")

            if not length:
                result = blind_service.extract_auto(
                    input_path=upload_path,
                    password=body.password,
                )
                results.append({
                    "file_name": url,
                    **result,
                })
                continue

            result = blind_service.extract(
                input_path=upload_path,
                wm_length=length,
                password=body.password,
            )
            results.append({
                "file_name": url,
                **result,
            })
        finally:
            file_service.cleanup(upload_path)

    return {"items": results}
