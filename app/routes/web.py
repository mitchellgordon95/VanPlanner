from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List
from app import templates
from app.config import settings

router = APIRouter()

class Location(BaseModel):
    id: str
    name: str
    passengerCount: int

class Van(BaseModel):
    id: str
    seatCount: int
    vanNumber: int

class RouteRequest(BaseModel):
    depot: dict
    vans: List[Van]
    locations: List[Location]

@router.get("/")
async def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "google_maps_api_key": settings.google_maps_api_key
        }
    )

@router.post("/api/calculate-routes")
async def calculate_routes(request: RouteRequest):
    # Stub response - this will be replaced with actual routing library
    return JSONResponse({
        "routes": [
            {
                "vanNumber": van.vanNumber,
                "seatCount": van.seatCount,
                "locations": [loc.dict() for loc in request.locations],
                "totalPassengers": sum(loc.passengerCount for loc in request.locations),
                "estimatedMinutes": 60  # placeholder
            }
            for van in request.vans
        ]
    })
