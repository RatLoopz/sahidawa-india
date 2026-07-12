import os
from fastapi import Header, HTTPException, status

def verify_api_key(x_api_key: str = Header(...)):
    expected = os.getenv("ML_API_KEY")
    if not expected or x_api_key != expected:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing API key")