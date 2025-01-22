from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    google_maps_api_key: str

    class Config:
        env_file = ".env"

settings = Settings()
