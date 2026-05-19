# Offline PWA

Lightweight offline-first medicine history app with SMS-based verification.

## Features

- Offline medicine history saved in the browser
- Service worker cache for PWA behavior
- SMS verification API with Twilio support
- Lightweight HTML/CSS/JavaScript UI for rural users

## Run locally

1. Open a terminal in `offline-pwa`
2. Run `npm install`
3. Copy `.env.example` to `.env` and set optional Twilio credentials:

```env
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+1234567890
```

4. If Twilio is not configured, the app will use mock SMS mode and display the OTP directly for offline-friendly testing.

5. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3001`

## Notes

- If Twilio is not configured, the app will use mock SMS mode and return the OTP in the response for offline-friendly testing.
- The medicine history is persisted locally, so users can add and view reports even without connectivity.
