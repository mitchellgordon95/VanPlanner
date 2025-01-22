from fastapi import APIRouter, Request
from app import templates
from app.config import settings

router = APIRouter()

@router.get("/")
async def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "google_maps_api_key": settings.google_maps_api_key
        }
    )
