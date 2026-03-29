# Portfolio With Secure Admin Control Plane

This project now runs as a full web application:

- Public portfolio site reads all dynamic content from API (`GET /api/content`)
- Admin control plane lives at `/admin`
- Content updates happen through authenticated admin endpoints with CSRF protection and audit logs

## Architecture

- Frontend: static portfolio (`index.html`, `styles.css`, `script.js`)
- API server: Node.js + Express (`server/app.js`)
- Secure content storage: server-side JSON (`server/data/content.json`)
- Admin UI: multi-section editor (`server/public/admin`)

## Security Controls Implemented

- `helmet` security headers + CSP
- HttpOnly signed JWT session cookie for admin auth
- CSRF protection with signed double-submit token
- Login rate limiting and admin API throttling
- Input validation (Zod schema)
- Atomic content writes (`.tmp` + rename)
- Audit event logging (`server/data/audit-log.json`)
- Sensitive static path blocking (`/server`, `/data.js`, env and package files)

## Routes

### Public

- `GET /` -> portfolio
- `GET /api/health` -> health check
- `GET /api/content` -> public content payload used by portfolio renderer

### Admin Auth

- `GET /admin/auth/csrf`
- `POST /admin/auth/login`
- `POST /admin/auth/logout`
- `GET /admin/auth/session`

### Admin Content API (authenticated)

- `GET /admin/api/content`
- `PUT /admin/api/content` (full content replace)
- `PATCH /admin/api/content/:section` (single section update)
- `GET /admin/api/audit`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`.

3. Generate a bcrypt hash for admin password:

```bash
npm run admin:hash -- YourStrongPasswordHere
```

4. Put that hash into `ADMIN_PASSWORD_HASH` in `.env`.

5. Set long random values for `JWT_SECRET` and `CSRF_SECRET`.

6. Start server:

```bash
npm run dev
```

7. Open:

- Portfolio: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

## Admin Usage

1. Login with `ADMIN_USERNAME` and the password matching `ADMIN_PASSWORD_HASH`.
2. Choose a section from left navigation.
3. Edit JSON for that section.
4. Save section or publish full snapshot.
5. Review audit timeline on dashboard.

## Notes

- The frontend no longer relies on a public `data.js` content file.
- Content is now ingested from secured backend endpoints.
- If API is temporarily unavailable, renderer gracefully handles missing payload.

## Project Structure

```text
.
├── index.html
├── styles.css
├── script.js
├── server
│   ├── app.js
│   ├── auth.js
│   ├── config.js
│   ├── contentSchema.js
│   ├── contentStore.js
│   ├── auditStore.js
│   ├── data
│   │   ├── content.json
│   │   └── audit-log.json
│   └── public
│       └── admin
│           ├── index.html
│           ├── styles.css
│           └── app.js
├── package.json
└── .env.example
```
