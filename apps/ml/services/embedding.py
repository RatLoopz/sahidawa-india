import os
import requests
from typing import Optional
from dotenv import load_dotenv
import logging

load_dotenv()

EMBEDDING_MODEL = "gemini-embedding-2"
EMBEDDING_DIMENSIONS = 768

EMBEDDING_ENDPOINT = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{EMBEDDING_MODEL}:embedContent"
)


def embed_query(text: str) -> Optional[list[float]]:
    """
    Generate an embedding for a user query using Gemini's REST API.
    Returns a 768-dimensional embedding or None if generation fails.
    """

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        return None

    try:
        response = requests.post(
            EMBEDDING_ENDPOINT,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json={
                "model": f"models/{EMBEDDING_MODEL}",
                "content": {
                    "parts": [
                        {
                            "text": text
                        }
                    ]
                },
                "outputDimensionality": EMBEDDING_DIMENSIONS,
            },
            timeout=10,
        )

        if response.status_code != 200:
            logging.warning("Embedding API failed with status code %s.", response.status_code,)
            return None

        body = response.json()

        embedding = body.get("embedding", {}).get("values")

        if (
            isinstance(embedding, list)
            and len(embedding) == EMBEDDING_DIMENSIONS
            and all(isinstance(x, (int, float)) for x in embedding)
        ):
            return embedding
        return None

    except requests.RequestException:
        logging.exception("Network error while generating embedding.")
        return None

    except Exception:
        logging.exception("Unexpected embedding error.")
        return None