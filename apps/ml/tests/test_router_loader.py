import importlib
import os
import sys

from fastapi import FastAPI

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def test_include_optional_router_skips_missing_modules(monkeypatch):
    from services import router_loader

    app = FastAPI()
    called = {"include_router": 0}

    def fake_import_module(module_path: str):
        if module_path == "routers.ocr":
            raise ModuleNotFoundError("No module named 'pytesseract'")
        return importlib.import_module(module_path)

    monkeypatch.setattr(router_loader.importlib, "import_module", fake_import_module)
    monkeypatch.setattr(app, "include_router", lambda router: called.__setitem__("include_router", 1))

    included = router_loader.include_router_if_available(app, "routers.ocr")

    assert included is False
    assert called["include_router"] == 0


def test_include_required_router_raises_missing_modules(monkeypatch):
    from services import router_loader

    app = FastAPI()

    def fake_import_module(module_path: str):
        raise ModuleNotFoundError("No module named 'faster_whisper'")

    monkeypatch.setattr(router_loader.importlib, "import_module", fake_import_module)

    try:
        router_loader.include_router_if_available(app, "routers.asr", required=True)
    except ModuleNotFoundError as error:
        assert "faster_whisper" in str(error)
    else:
        raise AssertionError("Expected ModuleNotFoundError for required router")


def test_include_optional_router_reraises_unrelated_import_bugs(monkeypatch):
    from services import router_loader

    app = FastAPI()

    def fake_import_module(module_path: str):
        error = ModuleNotFoundError("No module named 'matcer'")
        error.name = "matcer"
        raise error

    monkeypatch.setattr(router_loader.importlib, "import_module", fake_import_module)

    try:
        router_loader.include_router_if_available(app, "routers.ocr")
    except ModuleNotFoundError as error:
        assert error.name == "matcer"
    else:
        raise AssertionError("Expected unrelated ModuleNotFoundError to be re-raised")
