import logging
import os
from typing import Any

import requests
from dotenv import load_dotenv

from services.embedding import embed_query

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

PGVECTOR_MATCH_COUNT = int(os.getenv("PGVECTOR_MATCH_COUNT", "5"))
PGVECTOR_DISTANCE_THRESHOLD = float(os.getenv("PGVECTOR_DISTANCE_THRESHOLD", "0.5"))


def retrieve_relevant_medicines(query: str, limit: int = PGVECTOR_MATCH_COUNT,) -> list[dict[str, Any]]:
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

    similarity_threshold = 1.0 - PGVECTOR_DISTANCE_THRESHOLD

    payload = {
        "query_embedding": embedding,
        "match_count": limit,
        "similarity_threshold": similarity_threshold,
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

        # Filter out results exceeding the distance threshold (safety net
        # in case the RPC's similarity_threshold was not applied / differs).
        filtered = [
            m for m in medicines
            if (1.0 - m.get("similarity", 0.0)) <= PGVECTOR_DISTANCE_THRESHOLD
        ]

        if len(filtered) < len(medicines):
            logging.info(
                "Filtered out %d result(s) exceeding PGVECTOR_DISTANCE_THRESHOLD=%.2f.",
                len(medicines) - len(filtered),
                PGVECTOR_DISTANCE_THRESHOLD,
            )

        return filtered

    except requests.RequestException:
        logging.exception("Network error while calling match_medicines RPC.")
        return []

    except Exception:
        logging.exception("Unexpected error during medicine retrieval.")
        return []