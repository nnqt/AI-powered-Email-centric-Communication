from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import summarize as summarize_routes
from routes import reply as reply_routes


app = FastAPI(
    title="AI Email Communication Service",
    description="AI service for email summarization and smart replies",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "AI service running"}


app.include_router(summarize_routes.router)
app.include_router(reply_routes.router)

