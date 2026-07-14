import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env")

# Send the key in a header instead of the query string so it never lands in a
# URL that could be echoed back in an error message or CI log.
url = "https://generativelanguage.googleapis.com/v1beta/models"

response = requests.get(url, headers={"x-goog-api-key": API_KEY}, timeout=30)

if response.status_code == 200:
    models = response.json().get("models", [])

    print("Available Gemini Models:\n")

    for model in models:
        if "generateContent" in model.get("supportedGenerationMethods", []):
            print(f"- {model['name'].replace('models/', '')}")
else:
    # Never print the raw response body — an auth failure can echo the API key
    # back in clear text. The HTTP status line alone is enough to debug with.
    print(f"Error: request failed with status {response.status_code} {response.reason}")
