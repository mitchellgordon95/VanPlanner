from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import app
from app.routes import web

app.include_router(web.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
