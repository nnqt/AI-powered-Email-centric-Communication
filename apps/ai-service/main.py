import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import summarize as summarize_routes
from routes import reply as reply_routes
from routes import contact as contact_routes
from routes import urgent as urgent_routes
from routes import thread_category as thread_category_routes
from routes import topic_label as topic_label_routes
from routes import chat as chat_routes

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
app.include_router(contact_routes.router)
app.include_router(urgent_routes.router)
app.include_router(thread_category_routes.router)
app.include_router(topic_label_routes.router)
app.include_router(chat_routes.router)
