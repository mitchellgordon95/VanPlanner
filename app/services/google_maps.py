from googlemaps import Client
from app.config import settings

class GoogleMapsService:
    def __init__(self):
        self.client = Client(key=settings.google_maps_api_key)

    async def get_drive_time(self, origin, destination):
        try:
            result = self.client.distance_matrix(
                origins=[origin['name']],
                destinations=[destination['name']],
                mode="driving",
                units="metric"
            )
            
            if result['status'] == 'OK':
                duration = result['rows'][0]['elements'][0]['duration']['value']
                return duration / 60  # Convert seconds to minutes
            return None
        except Exception as e:
            print(f"Error getting drive time: {e}")
            return None

maps_service = GoogleMapsService()
