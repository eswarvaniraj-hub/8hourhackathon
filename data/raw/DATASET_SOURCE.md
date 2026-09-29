# Dataset Documentation: Tamil Nadu Agricultural Yield (Demo Dataset)

> **IMPORTANT DISCLAIMER**: This dataset contains **SYNTHETIC / DEMO DATA** generated for the hackathon MVP demonstration. It is designed to model realistic agricultural dynamics (rainfall-yield response curves, seasonal variations, and district soil profiles) in Tamil Nadu, India. It **does NOT** represent official field census data and is **NOT** published by ICAR, ICRISAT, or the Tamil Nadu Department of Agriculture. Predictions are for demonstration purposes only and should not be used as real-world agronomic advice.

---

## 1. Dataset Overview
- **Region**: Tamil Nadu, India
- **Focus Districts**: 10 representative agro-ecological districts:
  - *Cauvery Delta Zone*: Thanjavur, Tiruvarur, Nagapattinam, Tiruchirappalli
  - *Western Zone*: Coimbatore, Erode, Salem
  - *Southern Zone*: Madurai, Dindigul
  - *Northern Zone*: Villupuram
- **Timeframe**: 2012 to 2023 (12 annual seasonal cycles)
- **Supported Crops**:
  1. `Rice (Paddy)`
  2. `Maize`
  3. `Groundnut`
  4. `Pulses (Black Gram / Green Gram)`
- **Supported Seasons**:
  - `Kuruvai` (Short duration / Southwest Monsoon: Jun–Sep)
  - `Samba` (Main season / Northeast Monsoon: Aug–Jan)
  - `Navarai` (Rabi / Winter-Summer: Dec–May)
- **Soil Types**: `Alluvial`, `Red Loamy`, `Clayey`, `Sandy Loam`, `Black Soil`

---

## 2. Features and Schema

| Column Name | Type | Unit / Format | Description |
| :--- | :--- | :--- | :--- |
| `Year` | Integer | YYYY (2012–2023) | Crop year |
| `District` | String | Categorical | Tamil Nadu District |
| `Crop` | String | Categorical | Crop type |
| `Season` | String | Categorical | Agro-climatic cropping season |
| `Soil_Type` | String | Categorical | Predominant soil texture in plot |
| `Rainfall_mm` | Float | Millimeters (mm) | Cumulative seasonal rainfall |
| `Temperature_C` | Float | Degrees Celsius (°C) | Mean seasonal temperature |
| `Irrigation_Pct` | Float | Percentage (0–100%) | Extent of assured irrigation access |
| `Fertilizer_kg_per_ha` | Float | kg/ha | Combined NPK fertilizer application |
| `Yield_kg_per_ha` | Float | kg/ha | **Prediction Target**: Crop yield per hectare |

---

## 3. Agronomic Logic Modeled in Synthetic Data
1. **Rice (Paddy)**: Highly water-intensive (requires 900–1400 mm equivalent via rain + irrigation). Best performance in Alluvial / Clayey soils during Samba season in Delta districts.
2. **Maize**: Moderate water requirement (400–600 mm), sensitive to waterlogging, thrives in Red Loamy and Black soils (Western/Southern zones).
3. **Groundnut**: Thrives in well-drained Sandy Loam / Red Loamy soils with moderate moisture (350–550 mm). Excess moisture causes pod rot.
4. **Pulses**: Drought-hardy leguminous crops, lower fertilizer requirement (nitrogen fixing), lower base yield (500–1100 kg/ha), sensitive to heavy deluge.

---

## 4. Swapping with Real Historical Data
To transition this MVP to production:
1. Replace `data/raw/tamil_nadu_crop_yield_demo.csv` with official district-level crop statistics (e.g., from `data.gov.in` Directorate of Economics and Statistics or TNAU Agritech Portal).
2. Ensure columns match the standardized schema above.
3. Re-run `python ml/preprocessing/prepare_data.py` and `python ml/training/train_models.py`.
