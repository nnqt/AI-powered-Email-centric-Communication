from fastapi import APIRouter, HTTPException
from pydantic import ValidationError
from typing import Any, Dict
import traceback

from models.chat_analysis import AnalyzeChatRequest, AnalyzeChatResponse
from core.llm_client import GeminiChatAnalyzerClient

router = APIRouter(prefix="/analyze-chat-chunk", tags=["chat-analysis"])

llm_client = GeminiChatAnalyzerClient()

@router.post("/", response_model=AnalyzeChatResponse)
async def analyze_chat_chunk(req: AnalyzeChatRequest) -> Any:
    try:
        if not req.text_chunk or not req.text_chunk.strip():
            # Return empty fragments if there is no text chunk
            return AnalyzeChatResponse(fragments=[])
            
        result = await llm_client.analyze_chat(req)
        return result
    except ValidationError as e:
        print(f"Validation error: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"Error in chat analysis: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail="Failed to analyze chat chunk with AI"
        )
