# PCFind Authentication Backend

Node.js + Express authentication server with local JSON file storage.

## Setup

1. Install dependencies:
```bash
cd auth-backend
npm install
```

2. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

3. Open http://localhost:3000 in your browser

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

