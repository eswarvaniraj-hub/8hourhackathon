# AgriYield Tamil Nadu: System Architecture

## 1. High-Level Flow Diagram

```
+-------------------------------------------------------------------------------+
|                             CLIENT / USER LAYER                               |
|   Modern Responsive Web Dashboard (HTML5, Vanilla CSS Glassmorphism, JS)       |
|   - District & Crop Selectors (Tamil Nadu focus)                              |
|   - Real-time Sliders (Rainfall, Temp, Irrigation, Fertilizer)                |
|   - 1-Click Scenario Presets (Cauvery Delta, Coimbatore, Drought, Navarai)    |
|   - Interactive Chart.js Visuals (Historical comparison & Crop Feasibility)   |
+---------------------------------------+---------------------------------------+
                                        | HTTP REST (JSON)
                                        v
+-------------------------------------------------------------------------------+
|                             APPLICATION API LAYER                             |
|                        Flask REST Server (backend/app.py)                     |
|                                                                               |
|   - GET  /api/health           -> Server & model health status                |
|   - GET  /api/metadata         -> Supported districts, crops, metric bounds   |
|   - POST /api/predict          -> Input validation, prediction & advisory     |
|   - POST /api/crop-comparison  -> Multi-crop comparative yield simulation     |
|   - Serves Static Web Assets   -> http://127.0.0.1:5000/                      |
+---------------------------------------+---------------------------------------+
                                        | In-Memory Pipeline Call
                                        v
+-------------------------------------------------------------------------------+
|                          PREDICTION & ADVISORY ENGINE                         |
|                   (ml/inference/predict_service.py)                           |
|                                                                               |
|   1. Input Guard: Range checks (e.g. 0-3000 mm rain, 10-55 C temp, 0-100% irr)|
|   2. Pipeline Inference: ColumnTransformer + Gradient Boosting Regressor     |
|   3. Uncertainty Interval: 95% Confidence Empirical Interval (+- 1.96 * RMSE)  |
|   4. Historical Context: Compares against 10-year District Crop Mean          |
|   5. Rule-Based Agronomic Advisory: Moisture deficit, Heat stress, NPK bounds |
+---------------------------------------+---------------------------------------+
                                        ^
                                        | Model & Benchmark Artifacts
+---------------------------------------+---------------------------------------+
|                       OFFLINE MACHINE LEARNING PIPELINE                       |
|                                                                               |
|   [Raw Synthetic Data] -> [ml/preprocessing/prepare_data.py]                  |
|                           - Imputes missing values, strips duplicates         |
|                           - Standardizes units (kg/ha, t/ha)                  |
|                           - Validates Tamil Nadu district-crop pairs          |
|                                       |                                       |
|                                       v                                       |
|                        [Cleaned Dataset (3,009 rows)]                         |
|                                       |                                       |
|                                       v                                       |
|                        [ml/training/train_models.py]                          |
|                        - Temporal Split: Train 2012-2019, Test 2020-2023      |
|                        - Evaluates Linear Regression, Random Forest, GBDT     |
|                        - Produces best_yield_model.pkl & model_metadata.json  |
+-------------------------------------------------------------------------------+
```

## 2. Component Design & Modularity
The codebase is designed with clean separation of concerns:
- **`data/`**: Storage for raw and cleaned datasets. Swapping synthetic data with real ICAR/TNAU datasets requires only placing a new CSV in `data/raw/` and running the preprocessing script.
- **`ml/`**: Self-contained machine learning lifecycle (preprocessing, training, evaluation, inference).
- **`backend/`**: Lightweight web service exposing typed JSON APIs.
- **`frontend/`**: Zero-dependency, lightweight static web app using standard HTML5/CSS3/ES6 and Chart.js for data visualization.
