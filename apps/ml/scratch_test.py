import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        # Monitor all network requests to see what is hanging
        page.on("request", lambda req: print(f"🚀 Request: {req.url[:100]}"))
        page.on("requestfailed", lambda req: print(f"❌ Request Failed: {req.url[:100]} - {req.failure}"))
        page.on("console", lambda msg: print(f"💬 Console: {msg.text[:100]}"))
        
        print("Starting page.goto...")
        try:
            await page.goto("https://janaushadhi.gov.in/productportfolio/ProductmrpList", wait_until="domcontentloaded", timeout=30000)
            print("Page.goto finished!")
            
            # Let's wait a bit to see if elements render
            await asyncio.sleep(5)
            print("Current HTML length:", len(await page.content()))
        except Exception as e:
            print("ERROR occurred:", e)
        finally:
            await browser.close()

asyncio.run(main())
