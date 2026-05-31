import importlib
import logging
import re

from fastapi import FastAPI


logger = logging.getLogger(__name__)

OPTIONAL_ROUTER_ALLOWED_MISSING_MODULES = {
    "routers.ocr": {"routers.ocr", "PIL", "pytesseract", "thefuzz"},
}


def should_suppress_optional_import_error(module_path: str, error: ModuleNotFoundError) -> bool:
    missing_module = getattr(error, "name", None)

    if not missing_module:
        match = re.search(r"No module named '([^']+)'", str(error))
        if match:
            missing_module = match.group(1)

    if missing_module == module_path:
        return True

    return missing_module in OPTIONAL_ROUTER_ALLOWED_MISSING_MODULES.get(module_path, set())


def include_router_if_available(
    app: FastAPI,
    module_path: str,
    *,
    router_name: str = "router",
    required: bool = False,
) -> bool:
    try:
        module = importlib.import_module(module_path)
    except ModuleNotFoundError as error:
        if required or not should_suppress_optional_import_error(module_path, error):
            raise

        logger.warning("Skipping optional router %s because its dependencies are unavailable", module_path)
        return False

    app.include_router(getattr(module, router_name))
    return True
