from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from transformers import pipeline
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI Email Communication Service",
    description="AI service for email summarization and analysis",
    version="1.0.0"
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment & model configuration
PORT = int(os.getenv("PORT", 5000))
MODEL_NAME = os.getenv("MODEL_NAME", "facebook/bart-large-cnn")

# Initialize summarization model
try:
    summarizer = pipeline(
        "summarization",
        model=MODEL_NAME,
        device=-1  # Use CPU, change to 0 for GPU
    )
    logger.info(f"Successfully loaded summarization model: {MODEL_NAME}")
except Exception as e:
    logger.error(f"Failed to load summarization model {MODEL_NAME}: {str(e)}")
    raise

class ThreadMessage(BaseModel):
    text: str = Field(..., description="The text content to be summarized")
    from_: Optional[str] = Field(None, alias="from")

class SummarizeRequest(BaseModel):
    thread: List[ThreadMessage] = Field(
        ..., 
        description="List of messages to summarize",
        examples=[
            [
                {"from": "user@example.com", "text": "Hello, can we meet tomorrow?"},
                {"from": "me@example.com", "text": "Sure, what time works for you?"}
            ]
        ]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "thread": [
                        {"from": "user@example.com", "text": "Hello, can we meet tomorrow?"},
                        {"from": "me@example.com", "text": "Sure, what time works for you?"}
                    ]
                }
            ]
        }
    }

@app.get("/")
def root():
    """Health check endpoint"""
    return {"status": "AI service running", "model": "facebook/bart-large-cnn"}

@app.post("/summarize")
async def summarize(request: SummarizeRequest):
    """
    Summarize a thread of messages using BART model.
    
    Args:
        request: SummarizeRequest containing a list of messages to summarize
        
    Returns:
        dict: Contains the generated summary
        
    Raises:
        HTTPException: If summarization fails
    """
    try:
        # Combine all messages into a single text
        full_text = " ".join(msg.text for msg in request.thread)
        
        # Generate summary
        result = summarizer(
            full_text,
            max_length=130,
            min_length=30,
            do_sample=False
        )
        
        summary = result[0]['summary_text']
        
        # Log successful summarization
        logger.info(f"Successfully generated summary of length {len(summary)}")
        
        return {
            "summary": summary,
            "status": "success",
            "model": "facebook/bart-large-cnn"
        }
        
    except Exception as e:
        logger.error(f"Summarization failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate summary: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT)
