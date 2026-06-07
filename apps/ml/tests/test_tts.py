import os
import tempfile
import time
from pathlib import Path
from fastapi.testclient import TestClient
from main import app
from routers.tts import CACHE_DIR, prune_cache, MAX_CACHE_FILES, MAX_CACHE_SIZE_MB

client = TestClient(app)

def test_tts_health():
    res = client.get("/voice/tts/health")
    assert res.status_code == 200
    assert "status" in res.json()

def test_prune_cache_by_file_count(monkeypatch):
    # Setup temporary configurations
    monkeypatch.setattr("routers.tts.MAX_CACHE_FILES", 3)
    monkeypatch.setattr("routers.tts.MAX_CACHE_SIZE_MB", 100)
    
    # Clean up existing tts cache files for testing
    for p in CACHE_DIR.glob("*.mp3"):
        p.unlink(missing_ok=True)
        
    # Write 4 mock files with different creation/access times
    file1 = CACHE_DIR / "test_1.mp3"
    file2 = CACHE_DIR / "test_2.mp3"
    file3 = CACHE_DIR / "test_3.mp3"
    file4 = CACHE_DIR / "test_4.mp3"
    
    # Write file 1 (oldest)
    file1.write_bytes(b"a" * 10)
    time.sleep(0.01)
    
    # Write file 2
    file2.write_bytes(b"b" * 10)
    time.sleep(0.01)
    
    # Write file 3
    file3.write_bytes(b"c" * 10)
    time.sleep(0.01)
    
    # Write file 4 (trigger pruning)
    file4.write_bytes(b"d" * 10)
    
    prune_cache()
    
    # Verify file 1 is deleted, but files 2, 3, 4 remain (max 3 files limit)
    assert not file1.exists()
    assert file2.exists()
    assert file3.exists()
    assert file4.exists()
    
    # Cleanup
    for p in [file2, file3, file4]:
        p.unlink(missing_ok=True)

def test_prune_cache_by_size(monkeypatch):
    # Setup temporary configurations (max size: 30 bytes budget -> 0.0000286 MB)
    monkeypatch.setattr("routers.tts.MAX_CACHE_FILES", 100)
    monkeypatch.setattr("routers.tts.MAX_CACHE_SIZE_MB", 0.00003)
    
    # Clean up existing tts cache files for testing
    for p in CACHE_DIR.glob("*.mp3"):
        p.unlink(missing_ok=True)
        
    # Write 3 mock files (10-15 bytes each)
    file1 = CACHE_DIR / "test_size_1.mp3"
    file2 = CACHE_DIR / "test_size_2.mp3"
    file3 = CACHE_DIR / "test_size_3.mp3"
    
    file1.write_bytes(b"a" * 15) # 15 bytes
    time.sleep(0.01)
    file2.write_bytes(b"b" * 15) # 15 bytes
    time.sleep(0.01)
    file3.write_bytes(b"c" * 10) # 10 bytes -> total 40 bytes (exceeds ~31 bytes limit)
    
    prune_cache()
    
    # Since total size is 40 bytes, and limit is ~31 bytes, file1 (oldest) should be pruned.
    assert not file1.exists()
    assert file2.exists()
    assert file3.exists()
    
    # Cleanup
    for p in [file2, file3]:
        p.unlink(missing_ok=True)
