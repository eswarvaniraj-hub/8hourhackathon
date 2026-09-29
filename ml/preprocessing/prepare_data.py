"""
Data Preparation & Cleaning Pipeline
Cleans and standardizes raw agricultural dataset for model training.
Checks:
- Missing values & imputation
- Duplicate rows removal
- Location and season integrity
- Physical outlier checks (negative rainfall/yields, extreme temperatures)
- Target alignment (Yield_kg_per_ha)
"""

import os
import json
import pandas as pd
import numpy as np

VALID_DISTRICTS = {
    "Thanjavur", "Tiruchirappalli", "Nagapattinam", "Tiruvarur",
    "Coimbatore", "Erode", "Salem", "Madurai", "Dindigul", "Villupuram"
}

VALID_CROPS = {"Rice (Paddy)", "Maize", "Groundnut", "Pulses"}
VALID_SEASONS = {"Kuruvai", "Samba", "Navarai"}
VALID_SOILS = {"Alluvial", "Red Loamy", "Clayey", "Sandy Loam", "Black Soil"}

PHYSICAL_LIMITS = {
    "Rainfall_mm": (10.0, 3000.0),
    "Temperature_C": (10.0, 50.0),
    "Irrigation_Pct": (0.0, 100.0),
    "Fertilizer_kg_per_ha": (0.0, 500.0),
    "Yield_kg_per_ha": (100.0, 15000.0)
}

def clean_data(raw_csv_path, output_csv_path, report_path=None):
    print("=" * 60)
    print("Starting Agricultural Data Preparation Pipeline")
    print("=" * 60)
    
    if not os.path.exists(raw_csv_path):
        raise FileNotFoundError(f"Raw data file not found: {raw_csv_path}")
        
    df = pd.read_csv(raw_csv_path)
    initial_rows = len(df)
    report = {
        "initial_row_count": initial_rows,
        "duplicates_removed": 0,
        "missing_values_imputed": {},
        "invalid_locations_dropped": 0,
        "invalid_seasons_dropped": 0,
        "outliers_dropped": 0,
        "final_row_count": 0
    }
    
    # 1. Check and drop duplicate rows
    duplicates_count = df.duplicated().sum()
    if duplicates_count > 0:
        df = df.drop_duplicates().reset_index(drop=True)
    report["duplicates_removed"] = int(duplicates_count)
    print(f"Duplicates removed: {duplicates_count}")
    
    # 2. Check and handle missing values
    missing_counts = df.isnull().sum().to_dict()
    report["missing_values_detected"] = {k: int(v) for k, v in missing_counts.items() if v > 0}
    
    # Impute continuous features with group medians (by District & Crop)
    numeric_cols = ["Rainfall_mm", "Temperature_C", "Irrigation_Pct", "Fertilizer_kg_per_ha"]
    for col in numeric_cols:
        if df[col].isnull().any():
            missing_before = df[col].isnull().sum()
            df[col] = df.groupby(["District", "Crop"])[col].transform(lambda x: x.fillna(x.median()))
            # Global fallback
            if df[col].isnull().any():
                df[col] = df[col].fillna(df[col].median())
            report["missing_values_imputed"][col] = int(missing_before)
            print(f"Imputed {missing_before} missing values in '{col}' using District-Crop group medians.")
            
    # Drop rows if target (Yield) is missing
    if df["Yield_kg_per_ha"].isnull().any():
        drop_target_missing = df["Yield_kg_per_ha"].isnull().sum()
        df = df.dropna(subset=["Yield_kg_per_ha"]).reset_index(drop=True)
        print(f"Dropped {drop_target_missing} rows with missing target yield.")
        
    # 3. Check categorical validity
    initial_cat_rows = len(df)
    df = df[df["District"].isin(VALID_DISTRICTS)]
    report["invalid_locations_dropped"] = int(initial_cat_rows - len(df))
    
    initial_season_rows = len(df)
    df = df[df["Season"].isin(VALID_SEASONS)]
    report["invalid_seasons_dropped"] = int(initial_season_rows - len(df))
    
    df = df[df["Crop"].isin(VALID_CROPS)]
    df = df[df["Soil_Type"].isin(VALID_SOILS)]
    
    # 4. Outlier & Physical Boundaries check
    pre_outlier_count = len(df)
    for col, (min_val, max_val) in PHYSICAL_LIMITS.items():
        df = df[(df[col] >= min_val) & (df[col] <= max_val)]
    report["outliers_dropped"] = int(pre_outlier_count - len(df))
    print(f"Outliers outside realistic agronomic bounds removed: {report['outliers_dropped']}")
    
    # 5. Unit standardizations & Target alignment
    df["Yield_kg_per_ha"] = df["Yield_kg_per_ha"].round(1)
    df["Yield_tonnes_per_ha"] = (df["Yield_kg_per_ha"] / 1000.0).round(3)
    
    # Sort chronologically by Year, District, Crop
    df = df.sort_values(by=["Year", "District", "Crop", "Season"]).reset_index(drop=True)
    report["final_row_count"] = len(df)
    
    # Save cleaned data
    os.makedirs(os.path.dirname(output_csv_path), exist_ok=True)
    df.to_csv(output_csv_path, index=False)
    print(f"Cleaned dataset saved successfully to {os.path.abspath(output_csv_path)}")
    print(f"Final records count: {len(df)} (Retained {len(df)/initial_rows*100:.1f}%)")
    
    # Save report
    if report_path:
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"Cleaning report saved to {os.path.abspath(report_path)}")
        
    return df, report

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    raw_path = os.path.join(base_dir, "data", "raw", "tamil_nadu_crop_yield_demo.csv")
    cleaned_path = os.path.join(base_dir, "data", "processed", "cleaned_crop_yield.csv")
    rep_path = os.path.join(base_dir, "data", "processed", "cleaning_report.json")
    clean_data(raw_path, cleaned_path, rep_path)
