import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    DEBUG = os.getenv("FLASK_ENV", "development") == "development"

    # App database (Class3Report) — read/write. Schema changes only here.
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "SQLALCHEMY_DATABASE_URI",
        "mssql+pyodbc://sa:hiqsql@192.168.10.39/Class3Report?driver=ODBC+Driver+17+for+SQL+Server",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 3600,
    }

    # Production TrackingKannan — read-only. Never migrate or write here.
    DATABASE_URI = os.getenv(
        "DATABASE_URI",
        "mssql+pyodbc://sa:hiqsql@192.168.10.19/TrackingKannan?driver=ODBC+Driver+17+for+SQL+Server",
    )

    # Production HIQ — read-only. Cross-database joins from TrackingKannan.
    HIQ_DATABASE_URI = os.getenv(
        "HIQ_DATABASE_URI",
        "mssql+pyodbc://sa:hiqsql@192.168.10.19/HIQ?driver=ODBC+Driver+17+for+SQL+Server",
    )

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", os.getenv("SECRET_KEY", "dev-secret-change-me"))
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS", "24")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30")))

    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]

    PORT = int(os.getenv("PORT", "5000"))

    # F3 CoC / report uploads live on the Flask server under server/uploads.
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads"))
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", str(20 * 1024 * 1024)))
