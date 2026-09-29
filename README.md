# AgriYield Tamil Nadu: Agricultural Crop Yield Prediction & Decision Support System

> **HACKATHON MVP NOTICE & SYNTHETIC DATA DISCLAIMER**:  
> This project is a functional demonstration prototype built for the 8-hour hackathon. The machine learning models in this version are trained on a **SYNTHETIC / DEMO DATASET** modeled to reflect the agro-ecological parameters of **Tamil Nadu, India**. The dataset does **not** originate from ICAR, ICRISAT, or the Tamil Nadu Department of Agriculture, and no official citations are claimed. Model outputs and rule-based recommendations are intended strictly for **demonstration and decision-support modeling**, not real-world agronomic instructions.

---

## 1. Project Overview
AgriYield Tamil Nadu is a full-stack, machine learning-powered decision support platform that predicts agricultural crop yield (in **kg/ha** and **tonnes/ha**) based on seasonal, regional, and climate scenarios.

The system features:
- **Regional Specialization**: Focused on 10 prominent agro-ecological districts in Tamil Nadu across the Cauvery Delta, Western, Southern, and Northern belts.
- **Explainable Predictions**: Quantifies empirical uncertainty bounds (95% prediction intervals) and compares scenario outputs against 10-year historical district baselines.
- **Rule-Based Agronomic Advisories**: Flags moisture deficits, thermal anomalies, and excessive fertilizer applications using transparent agricultural logic.
- **Modular Pipeline**: Cleanly separates data ingestion, preprocessing, training, and API layers to allow seamless drop-in replacement with real government datasets.

---

## 2. Supported Scope (Tamil Nadu)

| Category | Supported Options |
| :--- | :--- |
| **Districts** | Thanjavur, Tiruvarur, Nagapattinam, Tiruchirappalli, Coimbatore, Erode, Salem, Madurai, Dindigul, Villupuram |
| **Crops** | Rice (Paddy), Maize, Groundnut, Pulses (Black Gram / Green Gram) |
| **Seasons** | Samba (Aug–Jan), Kuruvai (Jun–Sep), Navarai (Dec–May) |
| **Soil Types** | Alluvial, Red Loamy, Clayey, Sandy Loam, Black Soil |
| **Target Variable** | `Yield_kg_per_ha` ($\text{kg/ha}$) & `Yield_tonnes_per_ha` ($\text{t/ha}$) |

---

## 3. Machine Learning & Temporal Evaluation

Models were evaluated using a strict **Temporal Train/Test Split** to measure real generalization to future agricultural seasons rather than random shuffle:
- **Training Period**: 2012 – 2019 (2,010 records)
- **Testing Period**: 2020 – 2023 (999 records)

### Model Comparison Results

| Model Architecture | Train MAE | Train RMSE | Train $R^2$ | Test MAE | Test RMSE | Test $R^2$ | Selected Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Linear Regression (Baseline)** | 330.91 | 438.97 | 0.9175 | 324.50 | 422.47 | 0.9247 | Baseline |
| **Random Forest Regressor** | 78.29 | 123.15 | 0.9935 | 153.14 | 221.90 | 0.9792 | Candidate |
| **Gradient Boosting Regressor** | **93.23** | **124.05** | **0.9934** | **155.65** | **219.06** | **0.9798** | **Selected Best Model** |

*(Note: High $R^2$ scores reflect synthetic demo distributions; metrics will adapt naturally when real field census data is loaded).*

---

## 4. System Architecture

```text
Claudrix Agri/
├── data/
│   ├── raw/
│   │   ├── DATASET_SOURCE.md                   # Source citation, schema, and limitations
│   │   └── tamil_nadu_crop_yield_demo.csv      # Synthetic demo dataset (2012-2023)
│   └── processed/
│       ├── cleaned_crop_yield.csv              # Sanitized dataset (duplicates & outliers removed)
│       └── cleaning_report.json                # Preprocessing audit trail
├── ml/
│   ├── preprocessing/
│   │   ├── generate_synthetic_data.py          # Script to generate realistic Tamil Nadu demo data
│   │   └── prepare_data.py                     # Data cleaning, outlier removal & validation
│   ├── training/
│   │   └── train_models.py                     # Model comparison & temporal evaluation
│   ├── models/
│   │   ├── best_yield_model.pkl                # Trained scikit-learn pipeline
│   │   └── model_metadata.json                 # Model metrics, feature encoders, and baselines
│   └── inference/
│       └── predict_service.py                  # Prediction service, uncertainty & rule advisories
├── backend/
│   ├── app.py                                  # Flask REST API + Static Dashboard Host
│   └── requirements.txt                        # Backend dependencies
├── frontend/
│   ├── index.html                              # Responsive dashboard UI
│   ├── styles.css                              # Glassmorphic, modern responsive styling
│   └── app.js                                  # Chart.js visualization & interactive controls
├── docs/
│   └── architecture.md                         # Architecture diagrams & component flows
└── README.md
```

---

## 5. Quickstart: How to Run Locally

### Prerequisites
- Python 3.10+
- Installed packages: `pip install -r backend/requirements.txt`

### Step 1: (Optional) Re-run Data Ingestion and Training
If you modify data or add real datasets:
```powershell
python ml/preprocessing/prepare_data.py
python ml/training/train_models.py
```

### Step 2: Start the Web Application
```powershell
python backend/app.py
```

### Step 3: Open in Browser
Navigate to:
```
http://127.0.0.1:5000
```
The Flask backend serves both the REST API and the responsive frontend web application on port 5000.

---

## 6. REST API Endpoints

### 1. `GET /api/health`
Checks server and model status.
- **Response**:
```json
{
  "status": "healthy",
  "service": "Tamil Nadu Agricultural Yield Prediction API",
  "model_loaded": true,
  "region": "Tamil Nadu, India"
}
```

### 2. `GET /api/metadata`
Returns supported districts, crops, feature limits, and model evaluation metrics.

### 3. `POST /api/predict`
Validates input scenarios, runs model inference, calculates uncertainty intervals, compares against historical district means, and returns agronomic alerts.

- **Example Request Body**:
```json
{
  "district": "Thanjavur",
  "crop": "Rice (Paddy)",
  "season": "Samba",
  "soil_type": "Alluvial",
  "rainfall_mm": 680,
  "temperature_c": 27.5,
  "irrigation_pct": 85,
  "fertilizer_kg_per_ha": 135
}
```

- **Example Response**:
```json
{
  "success": true,
  "prediction": {
    "yield_kg_per_ha": 4393.2,
    "yield_tonnes_per_ha": 4.39,
    "yield_unit": "kg/ha (kilograms per hectare)",
    "uncertainty_range": {
      "confidence_level": "95% empirical prediction interval",
      "lower_bound_kg_ha": 3963.8,
      "upper_bound_kg_ha": 4822.6,
      "margin_kg_ha": 429.4
    }
  },
  "historical_context": {
    "district": "Thanjavur",
    "crop": "Rice (Paddy)",
    "historical_avg_yield_kg_ha": 3871.4,
    "historical_avg_yield_t_ha": 3.87,
    "difference_kg_ha": 521.8,
    "difference_percentage": 13.5
  },
  "recommendations": [
    {
      "category": "General Advisory",
      "title": "Balanced Agronomic Scenario",
      "type": "success",
      "message": "Selected input parameters align well with historical baseline conditions for this district and crop."
    }
  ]
}
```

---

## 7. Known Limitations & Future Improvements
1. **Synthetic Data**: The current dataset was procedurally generated for demonstration. In production, this can be swapped with verified field records from TNAU / DES.
2. **Satellite & Remote Sensing Integration**: Future versions can ingest real-time NDVI and soil moisture via Copernicus / Sentinel-2 APIs.
3. **Pest & Disease Modeling**: Subsequent iterations could incorporate pest incidence models for Tamil Nadu's monsoon transitions.
