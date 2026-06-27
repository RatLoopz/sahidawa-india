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
    import tempfile
    
    with tempfile.TemporaryDirectory() as temp_dir:
        mock_cache_dir = Path(temp_dir)
        monkeypatch.setattr("routers.tts.CACHE_DIR", mock_cache_dir)
        monkeypatch.setattr("routers.tts.MAX_CACHE_FILES", 3)
        monkeypatch.setattr("routers.tts.MAX_CACHE_SIZE_MB", 100)
        
        file1 = mock_cache_dir / "test_1.mp3.gz"
        file2 = mock_cache_dir / "test_2.mp3.gz"
        file3 = mock_cache_dir / "test_3.mp3.gz"
        file4 = mock_cache_dir / "test_4.mp3.gz"
        
        file1.write_bytes(b"a" * 10)
        time.sleep(0.01)
        file2.write_bytes(b"b" * 10)
        time.sleep(0.01)
        file3.write_bytes(b"c" * 10)
        time.sleep(0.01)
        file4.write_bytes(b"d" * 10)
        
        prune_cache()
        
        assert not file1.exists()
        assert file2.exists()
        assert file3.exists()
        assert file4.exists()

def test_prune_cache_by_size(monkeypatch):
    import tempfile
    
    with tempfile.TemporaryDirectory() as temp_dir:
        mock_cache_dir = Path(temp_dir)
        monkeypatch.setattr("routers.tts.CACHE_DIR", mock_cache_dir)
        monkeypatch.setattr("routers.tts.MAX_CACHE_FILES", 100)
        monkeypatch.setattr("routers.tts.MAX_CACHE_SIZE_MB", 0.00003)
        
        file1 = mock_cache_dir / "test_size_1.mp3.gz"
        file2 = mock_cache_dir / "test_size_2.mp3.gz"
        file3 = mock_cache_dir / "test_size_3.mp3.gz"
        
        file1.write_bytes(b"a" * 15)
        time.sleep(0.01)
        file2.write_bytes(b"b" * 15)
        time.sleep(0.01)
        file3.write_bytes(b"c" * 10)
        
        prune_cache()
        
        assert not file1.exists()
        assert file2.exists()
        assert file3.exists()
