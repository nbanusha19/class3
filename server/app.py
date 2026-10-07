from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge

from config import Config
from extensions import db, jwt, migrate
from logging_setup import configure_logging
from models import CocEditLock, CocReport, CocReportFile  # noqa: F401 — register model metadata
from routes import register_blueprints
from utils.db import init_db_engine
from utils.hiq_db import init_hiq_engine


def create_app(config_class=Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    configure_logging(app.config.get("DEBUG", False))

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
    )

    # Writable Class3Report app DB only.
    db.init_app(app)
    migrate.init_app(app, db, compare_type=True)
    jwt.init_app(app)

    # Read-only production DBs. Never migrate / write these.
    init_db_engine(app.config.get("DATABASE_URI"))
    init_hiq_engine(app.config.get("HIQ_DATABASE_URI"))

    register_blueprints(app)

    @app.errorhandler(RequestEntityTooLarge)
    def too_large(_error):
        return jsonify({"error": "File is too large (max 20 MB)."}), 413

    with app.app_context():
        # Create tables on the Class3Report DB if missing.
        db.create_all()

    return app


app = create_app()

if __name__ == "__main__":
    port = Config.PORT
    app.run(host="0.0.0.0", port=port, debug=Config.DEBUG)
