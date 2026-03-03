from fastapi import APIRouter, HTTPException

from models.contact import (
    EnrichContactRequest,
    EnrichContactResponse,
    SuggestMergeRequest,
    SuggestMergeResponse,
)
from services.contact_enricher import enrich_contact
from services.merge_suggester import suggest_merges

router = APIRouter()


@router.post("/enrich-contact", response_model=EnrichContactResponse)
async def enrich_contact_route(request: EnrichContactRequest):
    try:
        return await enrich_contact(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/suggest-merge", response_model=SuggestMergeResponse)
async def suggest_merge_route(request: SuggestMergeRequest):
    try:
        return await suggest_merges(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
