"""
Agricultural Yield Prediction & Advisory API
Backend server built with Flask and Flask-CORS.
Provides endpoints for health checks, metadata, prediction, and multi-crop comparison.
Also serves the frontend web dashboard directly.
"""

import os
import sys
from flask import Flask, request, jsonify, send_from_directory
try:
    from flask_cors import CORS
    has_cors = True
except ImportError:
    has_cors = False

# Add root directory to sys.path so ml package can be imported
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from ml.inference.predict_service import PredictionService
from backend.gemini_service import gemini_service

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "frontend"), static_url_path="")
if has_cors:
    CORS(app, resources={r"/*": {"origins": "*"}})

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response

# Initialize Prediction Service singleton
try:
    predict_service = PredictionService()
    print("Prediction Service initialized successfully.")
except Exception as e:
    print(f"Warning: Could not initialize PredictionService: {e}")
    predict_service = None

@app.route("/")
def serve_index():
    """Serve frontend index.html."""
    return send_from_directory(app.static_folder, "index.html")

@app.route("/dashboard")
def serve_dashboard():
    """Serve frontend index.html for the /dashboard route."""
    return send_from_directory(app.static_folder, "index.html")

@app.route("/simulation")
def serve_simulation():
    """Serve frontend index.html for the /simulation route."""
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    """Serve static frontend files."""
    return send_from_directory(app.static_folder, path)

@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "Tamil Nadu Agricultural Yield Prediction API",
        "model_loaded": predict_service is not None,
        "region": "Tamil Nadu, India"
    }), 200

@app.route("/api/metadata", methods=["GET"])
def get_metadata():
    """Return model metadata, supported options, and dataset disclaimers."""
    if not predict_service:
        return jsonify({"error": "Prediction service unavailable"}), 503
        
    return jsonify({
        "status": "success",
        "metadata": predict_service.metadata
    }), 200

@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Main prediction endpoint.
    Accepts scenario JSON payload, validates inputs, and returns predicted yield,
    uncertainty bounds, historical comparison, and agronomic recommendations.
    """
    if not predict_service:
        return jsonify({"error": "Prediction service not loaded"}), 503
        
    data = request.get_json(silent=True)
    if not data:
        return jsonify({
            "success": False,
            "errors": ["Invalid JSON payload in request body."]
        }), 400
        
    result = predict_service.predict(data)
    
    if not result.get("success"):
        return jsonify(result), 400
        
    return jsonify(result), 200

from backend.gemini_service import gemini_service

@app.route("/api/crop-comparison", methods=["POST", "OPTIONS"])
def crop_comparison():
    if request.method == "OPTIONS":
        return "", 204
    """
    Simulate predicted yields across all supported crops under identical conditions.
    """
    if not predict_service:
        return jsonify({"error": "Prediction service not loaded"}), 503
        
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "errors": ["Invalid JSON payload."]}), 400
        
    comparison = predict_service.compare_crops_for_scenario(data)
    return jsonify({
        "success": True,
        "comparison": comparison
    }), 200

@app.route("/api/chat/status", methods=["GET"])
def chat_status():
    """Returns Gemini assistant readiness status without leaking key values."""
    return jsonify({
        "available": gemini_service.is_available(),
        "supported_languages": ["en", "ta"],
        "voice_supported": True
    }), 200

@app.route("/api/chat", methods=["POST", "OPTIONS"])
def chat():
    """
    Agricultural AI Chatbot endpoint powered by Gemini.
    Accepts: { message: str, language: 'en' | 'ta', context: dict }
    Returns: { success: bool, reply: str, language: str, model_used: str }
    """
    if request.method == "OPTIONS":
        return "", 204

    data = request.get_json(silent=True)
    if not data or "message" not in data:
        return jsonify({
            "success": False,
            "error": "Missing 'message' in request body."
        }), 400

    user_msg = str(data.get("message", "")).strip()
    language = str(data.get("language", "en")).strip().lower()
    context = data.get("context", None)

    response = gemini_service.generate_chat_response(
        user_message=user_msg,
        language=language,
        context=context
    )

    status_code = 200 if response.get("success") else 500
    return jsonify(response), status_code

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Agricultural Yield API on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)

