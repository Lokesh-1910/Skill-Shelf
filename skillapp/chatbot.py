
"""
skillapp/chatbot.py
───────────────────
SkillShelf AI Assistant — powered by Claude (Anthropic).

Capabilities:
  - Read & answer questions about the logged-in user's uploaded documents
  - Extract text from PDFs
  - Analyse images (govt IDs, certificates, photos)
  - Warn about expiring documents
  - General document Q&A
"""

import os
import base64
import mimetypes
from datetime import date, timedelta

import fitz                  # PyMuPDF — pip install pymupdf
from groq import Groq
            # pip install anthropic

from django.conf import settings
from .models import Document

# ── Configure Claude client ───────────────────────────────────────────────────
_CLIENT = Groq(api_key=settings.GROQ_API_KEY)
_MODEL  = "llama-3.1-8b-instant" 

_SYSTEM = (
    "You are ShelfBot, the smart AI assistant built into SkillShelf — "
    "a personal document management app. "
    "You help users understand, find, and manage their uploaded documents. "
    "Be concise, friendly, and precise. "
    "When you don't know something from the provided context, say so honestly."
)


# ── PDF text extraction ───────────────────────────────────────────────────────

def extract_pdf_text(file_path, max_chars=3000):
    """Return plain text from a PDF."""
    try:
        doc   = fitz.open(file_path)
        parts = [page.get_text() for page in doc]
        doc.close()
        return "\n".join(parts)[:max_chars]
    except Exception as e:
        return f"[Could not extract PDF text: {e}]"


# ── Image encoding ────────────────────────────────────────────────────────────

def encode_image(file_path):
    """Return a Claude-compatible image dict for vision analysis."""
    mime, _ = mimetypes.guess_type(file_path)
    if not mime or not mime.startswith("image/"):
        return None
    try:
        with open(file_path, "rb") as f:
            data = base64.standard_b64encode(f.read()).decode("utf-8")
        return {
            "type": "image",
            "source": {
                "type":       "base64",
                "media_type": mime,
                "data":       data,
            },
        }
    except Exception:
        return None


# ── Build context from user's documents ──────────────────────────────────────

def build_document_context(user, target_doc_id=None):
    """
    Returns (text_context, image_blocks).

    text_context  — string describing all user documents + PDF excerpts.
    image_blocks  — list of Claude image content blocks for vision.
    """
    docs         = Document.objects.filter(owner=user).order_by("-uploaded_at")
    text_parts   = []
    image_blocks = []
    today        = date.today()

    for doc in docs:
        # ── Expiry info ──
        expiry_str = ""
        if hasattr(doc, "expiry_date") and doc.expiry_date:
            days_left = (doc.expiry_date - today).days
            if days_left < 0:
                expiry_str = f" EXPIRED {abs(days_left)} days ago"
            elif days_left <= 30:
                expiry_str = f" EXPIRES IN {days_left} DAYS ({doc.expiry_date})"
            else:
                expiry_str = f" (expires {doc.expiry_date})"

        # ── Basic metadata ──
        meta = (
            f"[Doc #{doc.id}] {doc.title} | "
            f"Category: {doc.category_display} | "
            f"Tag: {doc.tags} | "
            f"Uploaded: {doc.uploaded_at.strftime('%Y-%m-%d')} | "
            f"Type: {doc.file_type.upper()}{expiry_str}"
        )
        if doc.description:
            meta += f" | Description: {doc.description}"

        # ── File content ──
        file_path = None
        try:
            file_path = doc.file.path
        except Exception:
            pass

        if file_path and os.path.exists(file_path):
            is_target = (target_doc_id is not None and doc.id == target_doc_id)

            if doc.file_type == "pdf":
                if is_target or docs.count() <= 10:
                    text  = extract_pdf_text(file_path)
                    meta += f"\n  PDF content:\n{text}"

            elif doc.is_image:
                if is_target or docs.count() <= 5:
                    img = encode_image(file_path)
                    if img:
                        image_blocks.append(img)
                        meta += "\n  [Image attached for visual analysis]"

        text_parts.append(meta)

    text_context = (
        "USER'S DOCUMENTS:\n" + "\n\n".join(text_parts)
        if text_parts
        else "No documents uploaded yet."
    )
    return text_context, image_blocks


# ── Expiry warnings ───────────────────────────────────────────────────────────

def get_expiry_warnings(user):
    """Return list of dicts for docs expiring within 60 days or already expired."""
    today = date.today()
    soon  = today + timedelta(days=60)

    try:
        docs = Document.objects.filter(
            owner=user,
            expiry_date__isnull=False,
            expiry_date__lte=soon,
        ).order_by("expiry_date")
    except Exception:
        return []

    warnings = []
    for doc in docs:
        days_left = (doc.expiry_date - today).days
        if days_left < 0:
            status, label = "expired",  f"Expired {abs(days_left)} days ago"
        elif days_left == 0:
            status, label = "today",    "Expires TODAY"
        elif days_left <= 7:
            status, label = "critical", f"Expires in {days_left} day{'s' if days_left != 1 else ''}"
        elif days_left <= 30:
            status, label = "warning",  f"Expires in {days_left} days"
        else:
            status, label = "notice",   f"Expires in {days_left} days"

        warnings.append({
            "id":       doc.id,
            "title":    doc.title,
            "category": doc.category_display,
            "date":     str(doc.expiry_date),
            "days":     days_left,
            "status":   status,
            "label":    label,
        })
    return warnings


# ── Main chat function ────────────────────────────────────────────────────────

def chat(user, message, history, target_doc_id=None):
    """
    Send a message to Claude and return the reply string.

    Parameters
    ----------
    user          : Django user object
    message       : the user's latest message
    history       : list of previous messages
    target_doc_id : if chatting about a specific document, pass its id

    Returns
    -------
    str — the assistant's reply
    """
    # Build document context
    text_context, image_blocks = build_document_context(user, target_doc_id)

    # Build expiry note
    expiry_warnings = get_expiry_warnings(user)
    expiry_note     = ""
    if expiry_warnings:
        lines       = [f"  - {w['title']} - {w['label']}" for w in expiry_warnings[:5]]
        expiry_note = "\n\nEXPIRY ALERTS:\n" + "\n".join(lines)

    # Build the text prompt
    text_prompt = (
        f"[Document Context]\n{text_context[:3000]}{expiry_note}\n\n"
        f"[User Message]\n{message}"
    )

    # Build Claude content blocks — images first, then text
    content = []
    for img in image_blocks:
        content.append(img)
    content.append({"type": "text", "text": text_prompt})

    try:
        response = _CLIENT.chat.completions.create(
            model=_MODEL,
            max_tokens=1024,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user",   "content": text_prompt},
            ],
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Sorry, I couldn't process that right now. Error: {e}"