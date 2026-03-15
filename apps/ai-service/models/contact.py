from pydantic import BaseModel
from typing import List, Optional


class EnrichContactRequest(BaseModel):
    email: str
    name: Optional[str] = None
    conversation_snippet: Optional[str] = None
    user_email_domain: Optional[str] = None


class EnrichContactResponse(BaseModel):
    email: str
    display_name: Optional[str] = None
    org: Optional[str] = None
    language: Optional[str] = None
    category_suggestion: Optional[str] = None  # colleague|customer|spam|other|unknown


class ContactSnippet(BaseModel):
    contact_id: str
    email: str
    name: Optional[str] = None
    alternate_emails: List[str] = []
    sample_threads: List[str] = []


class MergeSuggestion(BaseModel):
    source_id: str
    target_id: str
    source_email: str
    target_email: str
    confidence: float
    reason: str


class SuggestMergeRequest(BaseModel):
    contacts: List[ContactSnippet]


class SuggestMergeResponse(BaseModel):
    suggestions: List[MergeSuggestion]
