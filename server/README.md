# Class3Report Flask REST API

Read-only Flask backend for the Class 3 PCB Report Suite.

## Stack

Flask 3 · SQLAlchemy 2 (engine only) · Flask-JWT-Extended · Flask-CORS · python-dotenv · pyodbc

Database: **Microsoft SQL Server** `TrackingKannan` via `mssql+pyodbc://...?driver=ODBC+Driver+17+for+SQL+Server`

## Important

- Production DB is **read-only**
- **No migrations**
- **No writes** to TrackingKannan
- Auth validates `UID` + `UserPassword` against `dbo.[User]`

## Folder layout

```
server/
  app.py
  config.py
  extensions.py
  logging_setup.py
  requirements.txt
  routes/          # Blueprints → /api/...
  controllers/     # HTTP handlers
  services/        # Business logic / SQL reads
  models/          # Read-only domain objects (not Alembic models)
  middlewares/     # JWT helpers
  utils/           # DB engine helpers
```

## Setup

```powershell
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

## Run

```powershell
python app.py
# or: flask run --port 5000
```

Default port: **5000**

## Auth (JWT)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login with `{ "uid", "password" }` |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/health` | Health check |
| POST/GET | `/api/coc/lookup` | Lookup traveler/COC by TRAVNUMBER (JWT) |
