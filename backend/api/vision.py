import os
import shutil
from fastapi import APIRouter, HTTPException, UploadFile, File
from backend.services.vision_service import vision_service

router = APIRouter(prefix="/api/vision", tags=["Image Vision AI"])

@router.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        raise HTTPException(status_code=400, detail="Only PNG and JPEG images are supported")
        
    temp_path = f"temp_{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        result = vision_service.analyze(temp_path)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
            
        return {
            "classification": result["classification"],
            "confidence": result["confidence"],
            "dataset_used": result["dataset_used"]
        }
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
