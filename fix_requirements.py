with open("apps/ml/requirements.txt", "r") as f:
    content = f.read()

fixed = content.replace("<<<<<<< HEAD\n# Testing\npytest>=8.0\npytest-timeout>=2.3.0\n=======\n# TTS (Text-to-Speech) - Optional\n# Google Cloud TTS\ngoogle-cloud-texttospeech>=2.14.0  # For cloud-based high-quality speech synthesis\n>>>>>>> pr-1242",
"# TTS (Text-to-Speech) - Optional\n# Google Cloud TTS\ngoogle-cloud-texttospeech>=2.14.0  # For cloud-based high-quality speech synthesis\n\n# Testing\npytest>=8.0\npytest-timeout>=2.3.0")

with open("apps/ml/requirements.txt", "w") as f:
    f.write(fixed)
