from flask import jsonify


def health():
    return jsonify({"status": "ok", "service": "class3-report-api"})
