"""
Tamil Nadu Crop Yield Synthetic Data Generator
Generates realistic demonstration records (2012-2023) for hackathon MVP.
Clearly labeled as DEMO / SYNTHETIC DATA.
"""

import os
import random
import numpy as np
import pandas as pd

# Set random seed for reproducibility
np.random.seed(42)
random.seed(42)

DISTRICTS = [
    "Thanjavur",
    "Tiruchirappalli",
    "Nagapattinam",
    "Tiruvarur",
    "Coimbatore",
    "Erode",
    "Salem",
    "Madurai",
    "Dindigul",
    "Villupuram"
]

CROPS = ["Rice (Paddy)", "Maize", "Groundnut", "Pulses"]

SEASONS = ["Kuruvai", "Samba", "Navarai"]

SOIL_TYPES = ["Alluvial", "Red Loamy", "Clayey", "Sandy Loam", "Black Soil"]

# Typical soil affinity per district
DISTRICT_SOIL_PREFERENCES = {
    "Thanjavur": ["Alluvial", "Clayey"],
    "Tiruvarur": ["Alluvial", "Clayey"],
    "Nagapattinam": ["Alluvial", "Sandy Loam"],
    "Tiruchirappalli": ["Alluvial", "Red Loamy"],
    "Coimbatore": ["Red Loamy", "Black Soil"],
    "Erode": ["Red Loamy", "Black Soil"],
    "Salem": ["Red Loamy", "Sandy Loam"],
    "Madurai": ["Red Loamy", "Clayey", "Black Soil"],
    "Dindigul": ["Red Loamy", "Sandy Loam"],
    "Villupuram": ["Red Loamy", "Sandy Loam", "Clayey"]
}

# Crop parameters: (base_yield_kg_ha, ideal_water_mm, temp_optimum, base_npk)
CROP_AGRONOMY = {
    "Rice (Paddy)": {
        "base_yield": 4200,
        "yield_std": 450,
        "ideal_water_mm": 1100,
        "water_sens": 0.35,
        "temp_opt": 28.0,
        "ideal_fert": 140,
        "seasons": ["Kuruvai", "Samba", "Navarai"],
        "preferred_soils": ["Alluvial", "Clayey"]
    },
    "Maize": {
        "base_yield": 5200,
        "yield_std": 500,
        "ideal_water_mm": 550,
        "water_sens": 0.40,
        "temp_opt": 27.0,
        "ideal_fert": 160,
        "seasons": ["Kuruvai", "Samba"],
        "preferred_soils": ["Red Loamy", "Black Soil", "Alluvial"]
    },
    "Groundnut": {
        "base_yield": 2200,
        "yield_std": 250,
        "ideal_water_mm": 450,
        "water_sens": 0.30,
        "temp_opt": 29.0,
        "ideal_fert": 70,
        "seasons": ["Samba", "Navarai"],
        "preferred_soils": ["Sandy Loam", "Red Loamy"]
    },
    "Pulses": {
        "base_yield": 850,
        "yield_std": 120,
        "ideal_water_mm": 350,
        "water_sens": 0.25,
        "temp_opt": 30.0,
        "ideal_fert": 35,
        "seasons": ["Samba", "Navarai", "Kuruvai"],
        "preferred_soils": ["Clayey", "Black Soil", "Red Loamy", "Alluvial"]
    }
}

YEARS = list(range(2012, 2024))

def generate_record(year, district, crop, season):
    agro = CROP_AGRONOMY[crop]
    
    # Select realistic soil based on district preference
    soils = DISTRICT_SOIL_PREFERENCES.get(district, SOIL_TYPES)
    soil = random.choice(soils)
    
    # Historical weather trend with year-specific climate shocks
    # e.g., 2016 was a major drought year in Tamil Nadu; 2021 had heavy excess rain
    drought_factor = 0.55 if year == 2016 else (1.30 if year == 2021 else 1.0)
    
    # Base seasonal rainfall based on season
    if season == "Kuruvai":
        base_rain = 350 + np.random.normal(0, 50)
        base_temp = 32.0 + np.random.normal(0, 1.2)
    elif season == "Samba":
        base_rain = 650 + np.random.normal(0, 90)
        base_temp = 27.5 + np.random.normal(0, 1.0)
    else: # Navarai
        base_rain = 220 + np.random.normal(0, 40)
        base_temp = 30.5 + np.random.normal(0, 1.5)
        
    rainfall = max(50.0, round(float(base_rain * drought_factor + np.random.normal(0, 30)), 1))
    temperature = max(20.0, round(float(base_temp + (year - 2012) * 0.05 + np.random.normal(0, 0.8)), 1))
    
    # Irrigation: Delta districts (Thanjavur, Tiruvarur) have higher canal access
    delta_districts = ["Thanjavur", "Tiruvarur", "Nagapattinam", "Tiruchirappalli"]
    base_irrigation = 85.0 if district in delta_districts else 55.0
    irrigation_pct = min(100.0, max(10.0, round(float(base_irrigation + np.random.normal(0, 12)), 1)))
    
    # Fertilizer application (NPK kg/ha)
    fert = round(max(10.0, float(np.random.normal(agro["ideal_fert"], agro["ideal_fert"] * 0.18))), 1)
    
    # Agronomic Response Calculation
    # Effective water = Rainfall + (Irrigation contribution)
    effective_water = rainfall + (irrigation_pct / 100.0) * (agro["ideal_water_mm"] * 0.7)
    water_ratio = effective_water / agro["ideal_water_mm"]
    # Diminishing returns & penalty for severe water deficit or severe flooding
    if water_ratio < 0.6:
        water_impact = 0.60 + (water_ratio - 0.6) * 0.8
    elif water_ratio <= 1.2:
        water_impact = 0.85 + (water_ratio - 0.6) * 0.25
    else:
        # mild excess water penalty for pulses/groundnut
        water_impact = 1.0 - (0.15 if crop in ["Pulses", "Groundnut"] else 0.05)
    
    # Temperature stress
    temp_diff = abs(temperature - agro["temp_opt"])
    temp_impact = max(0.70, 1.0 - (temp_diff * 0.035))
    
    # Fertilizer response with diminishing returns
    fert_ratio = fert / agro["ideal_fert"]
    fert_impact = 0.75 + 0.35 * (1 - np.exp(-1.5 * fert_ratio))
    
    # Soil suitability bonus
    soil_bonus = 1.08 if soil in agro["preferred_soils"] else 0.95
    
    # Final modeled yield
    simulated_yield = agro["base_yield"] * water_impact * temp_impact * fert_impact * soil_bonus
    # Add random biological/field variability
    simulated_yield += np.random.normal(0, agro["yield_std"] * 0.5)
    
    # Physical floor and ceiling per crop
    simulated_yield = max(agro["base_yield"] * 0.25, round(float(simulated_yield), 1))
    
    return {
        "Year": year,
        "District": district,
        "Crop": crop,
        "Season": season,
        "Soil_Type": soil,
        "Rainfall_mm": rainfall,
        "Temperature_C": temperature,
        "Irrigation_Pct": irrigation_pct,
        "Fertilizer_kg_per_ha": fert,
        "Yield_kg_per_ha": simulated_yield
    }

def main():
    records = []
    
    for year in YEARS:
        for district in DISTRICTS:
            for crop, agro in CROP_AGRONOMY.items():
                for season in agro["seasons"]:
                    # Create 2 to 3 micro-cluster records per district/crop/season/year
                    reps = random.choice([2, 3])
                    for _ in range(reps):
                        rec = generate_record(year, district, crop, season)
                        records.append(rec)
                        
    df = pd.DataFrame(records)
    
    # Introduce small number of intentional dirty records to test preprocessing pipeline:
    # 1. A few duplicate rows
    duplicates = df.sample(n=8, random_state=42)
    df = pd.concat([df, duplicates], ignore_index=True)
    
    # 2. A couple of missing values in non-critical columns
    df.loc[12, "Fertilizer_kg_per_ha"] = np.nan
    df.loc[45, "Irrigation_Pct"] = np.nan
    
    out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "tamil_nadu_crop_yield_demo.csv")
    
    df.to_csv(out_path, index=False)
    print(f"Generated {len(df)} synthetic records saved to {os.path.abspath(out_path)}")
    print(df.head())
    print("\nSummary statistics by Crop:")
    print(df.groupby("Crop")["Yield_kg_per_ha"].describe())

if __name__ == "__main__":
    main()
