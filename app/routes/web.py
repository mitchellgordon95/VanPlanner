from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List
from app import templates
from app.config import settings
from app.services.google_maps import maps_service

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
    try:
        # For now, just return a simple route per van
        # This will be replaced with the actual routing library later
        routes = []
        for van in request.vans:
            # Get drive time from depot to first location (as an example)
            if request.locations:
                time = await maps_service.get_drive_time(
                    request.depot,
                    request.locations[0]
                )
                estimated_minutes = time if time is not None else 60
            else:
                estimated_minutes = 60

            routes.append({
                "vanNumber": van.vanNumber,
                "seatCount": van.seatCount,
                "locations": [loc.dict() for loc in request.locations],
                "totalPassengers": sum(loc.passengerCount for loc in request.locations),
                "estimatedMinutes": estimated_minutes
            })
        
        return JSONResponse({"routes": routes})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
