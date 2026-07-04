import logging
import os
from typing import Any

import requests
from dotenv import load_dotenv

from services.embedding import embed_query

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")


def retrieve_relevant_medicines(query: str, limit: int = 5,) -> list[dict[str, Any]]:
    """
    Retrieve medicines from the existing pgvector index using
    the match_medicines RPC.

    Flow:
        User Query
            ↓
        Gemini Embedding
            ↓
        match_medicines RPC
            ↓
        List of relevant medicines
    """
    query = query.strip()
    if not query:
        logging.warning("Empty retrieval query.")
        return []

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        logging.error("SUPABASE_URL or SUPABASE_ANON_KEY is missing.")
        return []

    embedding = embed_query(query)

    if embedding is None:
        logging.warning("Failed to generate embedding for query.")
        return []

    # Call the existing PostgREST RPC exposed by Supabase
    # This reuses the same match_medicines database function
    # already used by the TypeScript backend
    rpc_url = f"{SUPABASE_URL}/rest/v1/rpc/match_medicines"

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "query_embedding": embedding,
        "match_count": limit,
    }

    try:
        response = requests.post(rpc_url, headers=headers, json=payload, timeout=20,)

        logging.info(
            "match_medicines RPC returned status %s",
            response.status_code,
        )

        if response.status_code != 200:
            logging.warning(
                "match_medicines RPC failed.\nStatus: %s\nResponse: %s",
                response.status_code,
                response.text,
            )
            return []

        medicines = response.json()

        if not isinstance(medicines, list):
            logging.warning("Unexpected response format from match_medicines RPC.")
            return []

        logging.info(
            "Retrieved %d medicine(s) from pgvector search.",
            len(medicines),
        )

        return medicines

    except requests.RequestException:
        logging.exception("Network error while calling match_medicines RPC.")
        return []

    except Exception:
        logging.exception("Unexpected error during medicine retrieval.")
        return []