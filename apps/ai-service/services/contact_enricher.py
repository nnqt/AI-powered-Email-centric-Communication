from models.contact import EnrichContactRequest, EnrichContactResponse
from core.llm_client import get_contact_enrich_client


async def enrich_contact(request: EnrichContactRequest) -> EnrichContactResponse:
    client = get_contact_enrich_client()
    result = await client.enrich_contact(request)
    return EnrichContactResponse(
        email=request.email,
        display_name=result.get("display_name"),
        org=result.get("org"),
        language=result.get("language"),
    )
