import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from playwright.async_api import Error, TimeoutError as PlaywrightTimeoutError

# Ensure src.* imports resolve when running pytest from apps/etl/
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.scrapers.jan_aushadhi import JanAushadhiScraper


class AwaitableMock:
    """A helper to mock objects that are directly awaited (like Playwright Futures/Events)

    without triggering event loop errors during synchronous initialization.
    """
    def __init__(self, value):
        self._value = value

    def __await__(self):
        async def dummy():
            return self._value
        return dummy().__await__()


@pytest.fixture
def mock_playwright():
    with patch("src.scrapers.jan_aushadhi.async_playwright") as mock_ap:
        # Mocking the async context manager returned by async_playwright()
        mock_p_instance = MagicMock()
        mock_ap.return_value.__aenter__.return_value = mock_p_instance

        # Mock browser, context, and page
        mock_browser = MagicMock()
        mock_p_instance.chromium.launch = AsyncMock(return_value=mock_browser)
        mock_browser.close = AsyncMock()

        mock_context = MagicMock()
        mock_browser.new_context = AsyncMock(return_value=mock_context)

        mock_page = MagicMock()
        mock_context.new_page = AsyncMock(return_value=mock_page)

        # Mock page.goto response status code (default to 200 OK)
        mock_response = MagicMock()
        mock_response.status = 200
        mock_page.goto = AsyncMock(return_value=mock_response)

        # Mock selector and timeout methods
        mock_page.wait_for_selector = AsyncMock()
        mock_page.wait_for_timeout = AsyncMock()

        # Mock locator and count (locator is synchronous, count is async)
        mock_locator = MagicMock()
        mock_page.locator = MagicMock(return_value=mock_locator)
        mock_locator.count = AsyncMock(return_value=10)

        # Mock click methods (get_by_text is synchronous, click is async)
        mock_locator_get = MagicMock()
        mock_page.get_by_text = MagicMock(return_value=mock_locator_get)
        mock_locator_get.click = AsyncMock()

        # Mock download object and expect_download context manager
        mock_download = MagicMock()

        async def dummy_save_as(path):
            p = Path(path)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text("dummy CSV content")

        mock_download.save_as = AsyncMock(side_effect=dummy_save_as)

        # download_info.value is awaited, so make it a completed AwaitableMock
        mock_download_info = MagicMock()
        mock_download_info.value = AwaitableMock(mock_download)

        mock_page.expect_download.return_value.__aenter__.return_value = mock_download_info

        yield {
            "ap": mock_ap,
            "browser": mock_browser,
            "context": mock_context,
            "page": mock_page,
            "response": mock_response,
            "download": mock_download,
        }

        # Teardown: Cleanup any dummy CSV files created during test
        from src.scrapers.jan_aushadhi import RAW_DATA_DIR
        for f in RAW_DATA_DIR.glob("janaushadhi_raw_*.csv"):
            try:
                f.unlink()
            except Exception:
                pass


@pytest.mark.asyncio
@patch("src.scrapers.jan_aushadhi.asyncio.sleep")
@patch("src.scrapers.jan_aushadhi.logger")
async def test_scrape_success_no_retry(mock_logger, mock_sleep, mock_playwright):
    """Verifies that a successful request returns the save path directly without retrying or sleeping."""
    scraper = JanAushadhiScraper()
    save_path = await scraper.scrape()

    assert isinstance(save_path, Path)
    assert "janaushadhi_raw_" in save_path.name

    mock_playwright["page"].goto.assert_called_once()
    mock_playwright["browser"].close.assert_called_once()
    mock_sleep.assert_not_called()
    mock_logger.warning.assert_not_called()
    mock_logger.error.assert_not_called()


@pytest.mark.asyncio
@patch("src.scrapers.jan_aushadhi.asyncio.sleep")
@patch("src.scrapers.jan_aushadhi.logger")
async def test_scrape_retry_on_playwright_timeout(mock_logger, mock_sleep, mock_playwright):
    """Verifies that a Playwright TimeoutError triggers a retry and eventually succeeds."""
    mock_response = mock_playwright["response"]
    # First attempt raises PlaywrightTimeoutError, second succeeds
    mock_playwright["page"].goto.side_effect = [
        PlaywrightTimeoutError("Playwright timeout"),
        mock_response,
    ]

    scraper = JanAushadhiScraper()
    save_path = await scraper.scrape()

    assert isinstance(save_path, Path)
    assert mock_playwright["page"].goto.call_count == 2
    # Ensure browser close is called on each attempt to release resources
    assert mock_playwright["browser"].close.call_count == 2

    # Verify correct backoff delay (2 seconds for first retry)
    mock_sleep.assert_called_once_with(2)

    # Verify warning log was printed before retry
    mock_logger.warning.assert_called_once()
    warning_args = mock_logger.warning.call_args[0][0]
    assert "Attempt 1 failed: Playwright timeout" in warning_args
    assert "Retrying in 2s" in warning_args

    mock_logger.error.assert_not_called()


@pytest.mark.asyncio
@patch("src.scrapers.jan_aushadhi.asyncio.sleep")
@patch("src.scrapers.jan_aushadhi.logger")
async def test_scrape_retry_on_builtin_timeout(mock_logger, mock_sleep, mock_playwright):
    """Verifies that a standard Python built-in TimeoutError triggers a retry and eventually succeeds."""
    mock_response = mock_playwright["response"]
    # First attempt raises built-in TimeoutError, second succeeds
    mock_playwright["page"].goto.side_effect = [
        TimeoutError("Built-in timeout"),
        mock_response,
    ]

    scraper = JanAushadhiScraper()
    save_path = await scraper.scrape()

    assert isinstance(save_path, Path)
    assert mock_playwright["page"].goto.call_count == 2
    assert mock_playwright["browser"].close.call_count == 2

    mock_sleep.assert_called_once_with(2)

    mock_logger.warning.assert_called_once()
    warning_args = mock_logger.warning.call_args[0][0]
    assert "Attempt 1 failed: Built-in timeout" in warning_args
    assert "Retrying in 2s" in warning_args

    mock_logger.error.assert_not_called()


@pytest.mark.asyncio
@patch("src.scrapers.jan_aushadhi.asyncio.sleep")
@patch("src.scrapers.jan_aushadhi.logger")
async def test_scrape_retry_on_5xx(mock_logger, mock_sleep, mock_playwright):
    """Verifies that an HTTP 5xx response status code triggers a retry and eventually succeeds."""
    # First attempt returns a 503 response, second returns 200 response
    resp_503 = MagicMock()
    resp_503.status = 503
    resp_200 = mock_playwright["response"]
    mock_playwright["page"].goto.side_effect = [resp_503, resp_200]

    scraper = JanAushadhiScraper()
    save_path = await scraper.scrape()

    assert isinstance(save_path, Path)
    assert mock_playwright["page"].goto.call_count == 2
    assert mock_playwright["browser"].close.call_count == 2
    mock_sleep.assert_called_once_with(2)

    mock_logger.warning.assert_called_once()
    warning_args = mock_logger.warning.call_args[0][0]
    assert "HTTP 503 Server Error" in warning_args

    mock_logger.error.assert_not_called()


@pytest.mark.asyncio
@patch("src.scrapers.jan_aushadhi.asyncio.sleep")
@patch("src.scrapers.jan_aushadhi.logger")
async def test_scrape_retry_on_none_response(mock_logger, mock_sleep, mock_playwright):
    """Verifies that a None response from page.goto triggers a retry and eventually succeeds."""
    # First attempt returns None, second returns 200 response
    resp_200 = mock_playwright["response"]
    mock_playwright["page"].goto.side_effect = [None, resp_200]

    scraper = JanAushadhiScraper()
    save_path = await scraper.scrape()

    assert isinstance(save_path, Path)
    assert mock_playwright["page"].goto.call_count == 2
    assert mock_playwright["browser"].close.call_count == 2
    mock_sleep.assert_called_once_with(2)

    mock_logger.warning.assert_called_once()
    warning_args = mock_logger.warning.call_args[0][0]
    assert "No response received from server" in warning_args

    mock_logger.error.assert_not_called()


@pytest.mark.asyncio
@patch("src.scrapers.jan_aushadhi.asyncio.sleep")
@patch("src.scrapers.jan_aushadhi.logger")
async def test_scrape_retries_exhausted(mock_logger, mock_sleep, mock_playwright):
    """Verifies that when all 4 attempts fail, final error is logged and the original exception propagates."""
    # All 4 attempts raise a Playwright Error
    mock_playwright["page"].goto.side_effect = [
        Error("Network error 1"),
        Error("Network error 2"),
        Error("Network error 3"),
        Error("Network error 4"),
    ]

    scraper = JanAushadhiScraper()
    with pytest.raises(Error, match="Network error 4"):
        await scraper.scrape()

    assert mock_playwright["page"].goto.call_count == 4
    assert mock_playwright["browser"].close.call_count == 4

    # Verify backoff delays of 2s, 4s, and 8s
    assert mock_sleep.call_count == 3
    mock_sleep.assert_any_call(2)
    mock_sleep.assert_any_call(4)
    mock_sleep.assert_any_call(8)

    # Verify warning and final error logging
    assert mock_logger.warning.call_count == 3
    mock_logger.error.assert_called_once()
    error_args = mock_logger.error.call_args[0][0]
    assert "All 4 attempts exhausted" in error_args
    assert "Final failure reason: Network error 4" in error_args


@pytest.mark.asyncio
@patch("src.scrapers.jan_aushadhi.asyncio.sleep")
@patch("src.scrapers.jan_aushadhi.logger")
async def test_scrape_4xx_no_retry(mock_logger, mock_sleep, mock_playwright):
    """Verifies that an HTTP 4xx response immediately raises ValueError without sleeping or retrying."""
    resp_404 = MagicMock()
    resp_404.status = 404
    mock_playwright["page"].goto.side_effect = [resp_404]

    scraper = JanAushadhiScraper()
    with pytest.raises(ValueError, match="HTTP 404 Client Error"):
        await scraper.scrape()

    assert mock_playwright["page"].goto.call_count == 1
    # Browser must still be closed on failure to prevent resource leaks
    assert mock_playwright["browser"].close.call_count == 1
    mock_sleep.assert_not_called()
    mock_logger.warning.assert_not_called()
    mock_logger.error.assert_not_called()
