"""
Model Training and Temporal Evaluation Pipeline
Compares:
1. Linear Regression (Baseline)
2. Random Forest Regressor
3. Gradient Boosting Regressor

Evaluation Strategy:
- Temporal Split: Train on earlier years (2012-2019), Test on later years (2020-2023).
- Regression Metrics: MAE, RMSE, R²
- Exports best model pipeline and evaluation metadata.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

CATEGORICAL_FEATURES = ["District", "Crop", "Season", "Soil_Type"]
NUMERIC_FEATURES = ["Rainfall_mm", "Temperature_C", "Irrigation_Pct", "Fertilizer_kg_per_ha"]
ALL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES
TARGET = "Yield_kg_per_ha"

def train_and_evaluate(cleaned_csv_path, models_dir):
    print("=" * 60)
    print("Agricultural Yield Model Training & Temporal Evaluation")
    print("=" * 60)
    
    df = pd.read_csv(cleaned_csv_path)
    
    # Temporal Train/Test split: Train on 2012-2019, Test on 2020-2023
    train_mask = df["Year"] <= 2019
    test_mask = df["Year"] >= 2020
    
    train_df = df[train_mask].copy()
    test_df = df[test_mask].copy()
    
    print(f"Train period: 2012-2019 ({len(train_df)} samples)")
    print(f"Test period:  2020-2023 ({len(test_df)} samples)")
    
    X_train = train_df[ALL_FEATURES]
    y_train = train_df[TARGET]
    
    X_test = test_df[ALL_FEATURES]
    y_test = test_df[TARGET]
    
    # Calculate historical benchmarks (mean & std) by District and Crop across entire dataset
    historical_benchmarks = {}
    for (dist, crop), group in df.groupby(["District", "Crop"]):
        if dist not in historical_benchmarks:
            historical_benchmarks[dist] = {}
        historical_benchmarks[dist][crop] = {
            "mean_yield_kg_ha": round(float(group[TARGET].mean()), 1),
            "std_yield_kg_ha": round(float(group[TARGET].std()), 1),
            "mean_rainfall_mm": round(float(group["Rainfall_mm"].mean()), 1),
            "mean_temp_c": round(float(group["Temperature_C"].mean()), 1),
            "mean_irrigation_pct": round(float(group["Irrigation_Pct"].mean()), 1),
            "mean_fert_kg_ha": round(float(group["Fertilizer_kg_per_ha"].mean()), 1),
            "sample_count": int(len(group))
        }
        
    # Global crop averages
    crop_benchmarks = {}
    for crop, group in df.groupby("Crop"):
        crop_benchmarks[crop] = {
            "mean_yield_kg_ha": round(float(group[TARGET].mean()), 1),
            "min_yield_kg_ha": round(float(group[TARGET].min()), 1),
            "max_yield_kg_ha": round(float(group[TARGET].max()), 1),
            "std_yield_kg_ha": round(float(group[TARGET].std()), 1)
        }
    
    # Build preprocessor
    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
            ("num", StandardScaler(), NUMERIC_FEATURES)
        ]
    )
    
    models = {
        "Linear Regression (Baseline)": LinearRegression(),
        "Random Forest Regressor": RandomForestRegressor(
            n_estimators=120,
            max_depth=14,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        ),
        "Gradient Boosting Regressor": GradientBoostingRegressor(
            n_estimators=140,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.85,
            random_state=42
        )
    }
    
    results = {}
    fitted_pipelines = {}
    
    for name, model in models.items():
        print(f"\n--- Training {name} ---")
        pipeline = Pipeline(steps=[
            ("preprocessor", preprocessor),
            ("regressor", model)
        ])
        
        pipeline.fit(X_train, y_train)
        
        # Predictions
        train_preds = pipeline.predict(X_train)
        test_preds = pipeline.predict(X_test)
        
        # Metrics
        train_mae = float(mean_absolute_error(y_train, train_preds))
        train_rmse = float(root_mean_squared_error(y_train, train_preds))
        train_r2 = float(r2_score(y_train, train_preds))
        
        test_mae = float(mean_absolute_error(y_test, test_preds))
        test_rmse = float(root_mean_squared_error(y_test, test_preds))
        test_r2 = float(r2_score(y_test, test_preds))
        
        results[name] = {
            "train": {
                "mae": round(train_mae, 2),
                "rmse": round(train_rmse, 2),
                "r2": round(train_r2, 4)
            },
            "test": {
                "mae": round(test_mae, 2),
                "rmse": round(test_rmse, 2),
                "r2": round(test_r2, 4)
            }
        }
        
        fitted_pipelines[name] = pipeline
        
        print(f"Train - MAE: {train_mae:.2f} | RMSE: {train_rmse:.2f} | R²: {train_r2:.4f}")
        print(f"Test  - MAE: {test_mae:.2f} | RMSE: {test_rmse:.2f} | R²: {test_r2:.4f}")
        
    # Select best model based on Test R² score and Test RMSE
    best_model_name = max(results.keys(), key=lambda k: results[k]["test"]["r2"])
    best_pipeline = fitted_pipelines[best_model_name]
    print(f"\n>>> Selected Best Model: {best_model_name} (Test R²: {results[best_model_name]['test']['r2']}) <<<")
    
    # Save best model pipeline
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, "best_yield_model.pkl")
    joblib.dump(best_pipeline, model_path)
    print(f"Saved best model pipeline to {os.path.abspath(model_path)}")
    
    # Metadata structure
    metadata = {
        "model_version": "v1.0.0-hackathon-mvp",
        "selected_model": best_model_name,
        "region": "Tamil Nadu, India",
        "dataset_type": "SYNTHETIC / DEMO DATA (Modeled for Tamil Nadu Agro-Ecological Zones)",
        "disclaimer": "Predictions are demonstration results generated by models trained on synthetic demo data. They do NOT constitute guaranteed agricultural advice.",
        "training_period": "2012 - 2019",
        "test_period": "2020 - 2023",
        "evaluation_metrics": results,
        "target_variable": TARGET,
        "target_unit": "kg/ha (kilograms per hectare)",
        "supported_districts": sorted(list(df["District"].unique())),
        "supported_crops": sorted(list(df["Crop"].unique())),
        "supported_seasons": sorted(list(df["Season"].unique())),
        "supported_soils": sorted(list(df["Soil_Type"].unique())),
        "features": {
            "categorical": CATEGORICAL_FEATURES,
            "numeric": NUMERIC_FEATURES
        },
        "feature_ranges": {
            col: {
                "min": float(df[col].min()),
                "max": float(df[col].max()),
                "mean": round(float(df[col].mean()), 1)
            } for col in NUMERIC_FEATURES
        },
        "district_historical_benchmarks": historical_benchmarks,
        "crop_benchmarks": crop_benchmarks
    }
    
    metadata_path = os.path.join(models_dir, "model_metadata.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved model metadata to {os.path.abspath(metadata_path)}")
    
    return results, metadata

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    cleaned_csv = os.path.join(base_dir, "data", "processed", "cleaned_crop_yield.csv")
    models_path = os.path.join(base_dir, "ml", "models")
    train_and_evaluate(cleaned_csv, models_path)
