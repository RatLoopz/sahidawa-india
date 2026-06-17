import pytest
from unittest.mock import MagicMock, patch
from services.alert_extractor import extract_alerts_from_pdf_images, AlertInfo, AlertList

@patch("services.alert_extractor.ChatGoogleGenerativeAI")
@patch("fitz.open")
@patch("cloudinary.uploader.upload")
def test_extract_alerts_from_pdf_images_success(mock_cloudinary_upload, mock_fitz_open, mock_chat_llm):
    # Mock fitz document and pages
    mock_doc = MagicMock()
    mock_page = MagicMock()
    mock_pix = MagicMock()
    
    mock_fitz_open.return_value = mock_doc
    mock_doc.__len__.return_value = 1
    mock_doc.load_page.return_value = mock_page
    mock_page.get_pixmap.return_value = mock_pix
    mock_pix.tobytes.return_value = b"fake_png_bytes"
    
    # Mock LangChain ChatGoogleGenerativeAI and structured LLM invoke
    mock_llm_instance = MagicMock()
    mock_chat_llm.return_value = mock_llm_instance
    
    mock_structured_llm = MagicMock()
    mock_llm_instance.with_structured_output.return_value = mock_structured_llm
    
    # Mock AlertList response using the actual models
    mock_alert_info = AlertInfo(
        reported_brand_name="Mock Brand",
        batch_number="MB123",
        manufacturer="Mock Pharma",
        alert_type="NSQ",
        state="Delhi",
        district="North Delhi",
        reported_at="2026-06-12"
    )
    
    mock_alert_list = AlertList(alerts=[mock_alert_info])
    mock_structured_llm.invoke.return_value = mock_alert_list
    
    # Mock Cloudinary response
    mock_cloudinary_upload.return_value = {"secure_url": "https://res.cloudinary.com/fake-url.png"}
    
    # Run extractor
    pdf_bytes = b"fake_pdf_content"
    env_mock = {
        "GOOGLE_API_KEY": "fake_key",
        "CLOUDINARY_CLOUD_NAME": "fake_cloud",
        "CLOUDINARY_API_KEY": "fake_api",
        "CLOUDINARY_API_SECRET": "fake_secret"
    }
    with patch.dict("os.environ", env_mock):
        alerts = extract_alerts_from_pdf_images(pdf_bytes)
        
    assert len(alerts) == 1
    assert alerts[0]["reported_brand_name"] == "Mock Brand"
    assert alerts[0]["batch_number"] == "MB123"
    assert alerts[0]["manufacturer"] == "Mock Pharma"
    assert alerts[0]["alert_type"] == "NSQ"
    assert alerts[0]["proof_image_url"] == "https://res.cloudinary.com/fake-url.png"
    
    # Verify Cloudinary was called correctly
    mock_cloudinary_upload.assert_called_once()
