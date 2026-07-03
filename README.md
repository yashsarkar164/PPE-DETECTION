# Site Compliance — PPE Detection Management System

A full-stack, production-oriented system for detecting Personal Protective
Equipment (PPE) compliance from images, videos, and live webcam streams,
powered by a custom YOLOv8 model.

- **Frontend:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · shadcn/ui · Framer Motion · Recharts
- **Backend:** FastAPI · Ultralytics YOLOv8 · OpenCV · SQLAlchemy (async)
- **Database:** PostgreSQL
- **Auth:** JWT (access + refresh tokens), two roles: `operator` and `staff`
- **Storage:** local disk today, designed to swap to S3 with a one-file change

---

## 1. Project Structure

```
project/
├── frontend/           Next.js app
│   ├── app/             App Router pages (route groups: (auth), (dashboard))
│   ├── components/      UI primitives, layout, detection, gallery, charts
│   ├── lib/              API client, types, auth store, utils
│   └── hooks/            useRequireAuth, useWebcamDetection
│
├── backend/            FastAPI app
│   ├── api/              Route modules (auth, detection, webcam, gallery, ...)
│   ├── core/              config, database, models (ORM), security, deps
│   ├── services/          detection_service.py (YOLO), storage_service.py
│   ├── models/            iocl_ppe.pt goes here
│   ├── uploads/           original uploaded media (local storage)
│   └── results/           annotated output media (local storage)
│
├── database/
│   ├── schema.sql         Full Postgres schema
│   └── seed.sql            Sample operator + staff accounts
│
├── docker-compose.yml
└── README.md (this file)
```

---

## 2. The YOLO Model

The backend loads your trained model from `backend/models/iocl_ppe.pt` at
startup. **This repo ships with your actual model already in place** —
inspected classes:

```
0: Hardhat        3: NO-Mask          6: Safety Cone
1: Mask           4: NO-Safety Vest   7: Safety Vest
2: NO-Hardhat     5: Person           8: machinery
                                       9: vehicle
```

The detection service (`backend/services/detection_service.py`) reads class
names **directly from the model** at load time — nothing is hardcoded. Any
class beginning with `NO-` (or `NO_`) is automatically treated as a PPE
violation indicator, and the corresponding item name (`Hardhat`, `Mask`,
`Safety Vest`) is derived from it. This means:

- **Replacing the `.pt` file and restarting the server is all that's needed**
  to pick up a retrained or expanded model — no code changes.
- If you add new violation classes (e.g. `NO-Gloves`), they'll automatically
  show up in violation cards, the Violations page, and statistics.

There is no mock detection logic anywhere in the codebase.

---

## 3. Quick Start (Docker — recommended)

```bash
# 1. Confirm the model is in place
ls backend/models/iocl_ppe.pt

# 2. Set a real JWT secret (or edit docker-compose.yml directly)
export JWT_SECRET_KEY=$(openssl rand -hex 32)

# 3. Build and start everything (Postgres + backend + frontend)
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs
- Backend health check: http://localhost:8000/health (shows model load status + classes)

The Postgres container automatically runs `database/schema.sql` and
`database/seed.sql` on first startup, creating two accounts:

| Username   | Password      | Role     |
|------------|---------------|----------|
| `operator` | `operator123` | operator |
| `staff`    | `staff123`    | staff    |

**Change these credentials immediately in any real deployment** — update
directly in the `users` table (there is no registration page, by design).

---

## 4. Manual Setup (without Docker)

### Database
```bash
createdb ppe_detection
psql -d ppe_detection -f database/schema.sql
psql -d ppe_detection -f database/seed.sql
```

### Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit DATABASE_URL, JWT_SECRET_KEY, etc.
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL can stay empty in dev
npm run dev
```

Visit http://localhost:3000 — the dev server proxies `/api/*` to
`http://localhost:8000` automatically (see `next.config.mjs`).

---

## 5. Roles & Permissions

| Capability                    | Operator | Staff |
|--------------------------------|:--------:|:-----:|
| Login                          | ✅ | ✅ |
| Upload images / videos         | ✅ | ✅ |
| Webcam detection                | ✅ | ✅ |
| View own detection history      | ✅ | ✅ |
| View gallery                    | ✅ (all) | ✅ (own) |
| View violations                 | ✅ (all) | ✅ (own) |
| View statistics / analytics     | ✅ | ❌ |
| Manage staff accounts           | ✅ | ❌ |

There is no self-service registration. Accounts are created by an operator
via the **Manage Staff** page, or directly in the database.

---

## 6. Storage: Local Today, S3-Ready

All file I/O goes through `backend/services/storage_service.py`'s
`StorageBackend` abstraction. `LocalStorageBackend` is used by default
(`STORAGE_PROVIDER=local`). To migrate to S3 later:

1. Implement the `TODO`s in `S3StorageBackend` using `boto3`.
2. Set `STORAGE_PROVIDER=s3` and fill in the `AWS_*` variables in `.env`.
3. No other code changes are required — `storage_key` values are already
   provider-agnostic relative paths, and every route calls `storage.*`
   rather than touching the filesystem directly.

---

## 7. API Overview

Full interactive docs at `/docs` (Swagger) once the backend is running.
Key endpoint groups:

- `POST /api/auth/login`, `/refresh`, `/logout`, `/change-password`
- `POST /api/detection/image`, `/api/detection/video` — run YOLO inference, persist results
- `GET /api/detection/history` — role-scoped detection history
- `WS /api/webcam/stream/{session_id}?token=...` — live frame-by-frame detection
- `GET/POST/DELETE /api/gallery` — saved results, search/filter/paginate
- `GET /api/statistics/dashboard` — role-scoped dashboard summary
- `GET /api/statistics` — full analytics (operator only)
- `GET/PATCH /api/violations` — violation review queue
- `GET/POST/PATCH/DELETE /api/users` — staff management (operator only)

---

## 8. Design Notes

- **Palette:** black/graphite base, safety-yellow for primary actions and
  compliant states, safety-orange reserved specifically for violations —
  so color itself carries meaning, matching real hazard signage.
- **Violation logic:** driven entirely by the model's own class names
  (`NO-*` convention), not a fixed enum — see §2.
- **Webcam streaming:** the browser captures frames to canvas, sends JPEG
  frames over a WebSocket at ~3–4 fps (configurable in
  `hooks/use-webcam-detection.ts`), and the backend runs the same YOLO
  pipeline as image detection. Only violation frames are persisted to avoid
  flooding the database.
- **Auth:** short-lived access tokens (30 min default) + rotating refresh
  tokens (7 days default), stored hashed server-side so they can be revoked.

---

## 9. Production Checklist

- [ ] Set a strong, random `JWT_SECRET_KEY`
- [ ] Change default `operator`/`staff` passwords
- [ ] Put the backend behind HTTPS (reverse proxy / load balancer)
- [ ] Set `DEVICE=cuda:0` in backend `.env` if a GPU is available (large speedup for video)
- [ ] Migrate storage to S3 for horizontal scaling (§6)
- [ ] Set `MAX_UPLOAD_SIZE_MB` and reverse-proxy body-size limits consistently
- [ ] Back up the Postgres volume
