# PCFind Authentication Backend

Node.js + Express authentication server with OTP verification via Email/SMS.

## Setup

1. Install dependencies:
```bash
cd auth-backend
npm install
```

2. Configure email/SMS services (for production):

Create a `.env` file in this directory:
```env
# Email (Brevo) - Free 300 transactional emails/day at https://www.brevo.com/
BREVO_API_KEY=your_brevo_api_key
BREVO_FROM_EMAIL=noreply@yourdomain.com
BREVO_FROM_NAME=PCFind Support

# SMS - Vonage (preferred, no verification needed) or Twilio (fallback)
# Option 1: Vonage (recommended - can send to any number on trial)
VONAGE_API_KEY=your_vonage_api_key
VONAGE_API_SECRET=your_vonage_api_secret
VONAGE_BRAND_NAME=PCFind
# OR use a virtual number:
# VONAGE_PHONE_NUMBER=+1234567890

# Option 2: Twilio (fallback - requires number verification on trial)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

PORT=3000
```

**Note**: For development/testing without email/SMS services, OTPs will be shown in console logs and returned in API responses.

3. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

4. Open http://localhost:3000 in your browser

## Deployment

To use this with your GitHub Pages site (https://domodesu.github.io/):

1. Deploy this backend to a service like:
   - Render (https://render.com)
   - Railway (https://railway.app)
   - Heroku
   - Vercel

2. Update your frontend (site/index.html) to use the backend API:
   - Replace localStorage-based auth with fetch() calls to your deployed backend
   - Update API_URL in script.js to your deployed backend URL

## API Endpoints

- `POST /register` - Create new user
  - Body: `{ username, email?, password }`
  - Returns: `{ success, message, username }`

- `POST /login` - Authenticate user
  - Body: `{ username, password }`
  - Returns: `{ success, message, user: { id, username, email } }`

- `GET /dashboard` - Protected dashboard page

## Security Notes

- Passwords are hashed with bcrypt (10 rounds)
- CORS enabled for GitHub Pages integration
- Users stored in `users.json` (not recommended for production - use a database)

