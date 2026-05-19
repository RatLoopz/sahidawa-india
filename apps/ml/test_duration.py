import requests
import io
import wave
import numpy as np

def make_test_wav(duration_seconds: int) -> bytes:
    """Generate test WAV file."""
    buffer = io.BytesIO()
    sample_rate = 16000
    samples = np.zeros(int(sample_rate * duration_seconds), dtype=np.int16)
    
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(samples.tobytes())
    
    return buffer.getvalue()

BASE_URL = "http://localhost:8000"

print("\n" + "="*60)
print(" TESTING 60-SECOND AUDIO DURATION LIMIT")
print("="*60)

# Test 1: 61 seconds (SHOULD FAIL)
print("\n[Test 1] Upload 61-second audio (should fail with 400)")
print("-" * 60)
response = requests.post(
    f"{BASE_URL}/asr/transcribe",
    files={"file": ("long_audio.wav", make_test_wav(61), "audio/wav")}
)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")

# Test 2: 60 seconds (SHOULD PASS)
print("\n[Test 2] Upload 60-second audio (should pass duration check)")
print("-" * 60)
response = requests.post(
    f"{BASE_URL}/asr/transcribe",
    files={"file": ("boundary.wav", make_test_wav(60), "audio/wav")}
)
print(f"Status: {response.status_code}")
if response.status_code == 400:
    print(f"❌ FAILED: {response.json()}")
else:
    print(f"✅ PASSED duration check")
    if response.status_code == 200:
        print(f"Transcription: {response.json()['transcription']}")

# Test 3: 30 seconds (SHOULD PASS)
print("\n[Test 3] Upload 30-second audio (should pass)")
print("-" * 60)
response = requests.post(
    f"{BASE_URL}/asr/transcribe",
    files={"file": ("short_audio.wav", make_test_wav(30), "audio/wav")}
)
print(f"Status: {response.status_code}")
if response.status_code == 400:
    print(f"❌ FAILED: {response.json()}")
else:
    print(f"✅ PASSED duration check")

# Test 4: 45 seconds (SHOULD PASS)
print("\n[Test 4] Upload 45-second audio (should pass)")
print("-" * 60)
response = requests.post(
    f"{BASE_URL}/asr/transcribe",
    files={"file": ("medium_audio.wav", make_test_wav(45), "audio/wav")}
)
print(f"Status: {response.status_code}")
if response.status_code == 400:
    print(f"❌ FAILED: {response.json()}")
else:
    print(f"✅ PASSED duration check")

print("\n" + "="*60)
print("✅ ALL TESTS COMPLETED")
print("="*60 + "\n")