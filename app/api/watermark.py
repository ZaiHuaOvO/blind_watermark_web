"""
水印 API 路由。

所有接口均实现"用完即删"的临时文件策略。
嵌入接口返回 base64 图片数据，不保留文件在服务器上。
"""

from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException

from app.services import blind_service, file_service

router = APIRouter()


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
        upload_path = file_service.save_upload(file)

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
        upload_path = file_service.save_upload(file)

        try:
            params = blind_service.parse_params_from_filename(file.filename)
            length = wm_length or params.get("wm_length")

            if length is None:
                return {
                    "text": "无法确定水印长度，请手动输入预计水印字符数，或确认该图片是否通过本工具生成",
                    "success": False,
                }

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

            try:
                params = blind_service.parse_params_from_filename(file.filename)
                length = params.get("wm_length")

                if not length:
                    results.append({
                        "file_name": file.filename,
                        "text": "无法确定水印长度",
                        "success": False,
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

        except Exception as e:
            results.append({
                "file_name": file.filename,
                "text": str(e),
                "success": False,
            })

    return {"items": results}
