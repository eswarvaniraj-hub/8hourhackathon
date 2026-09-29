"""
Inference & Advisory Service
Handles:
- Loading model artifacts & metadata
- Validating incoming user payloads
- Executing predictions (with uncertainty interval)
- Comparing against historical district benchmarks
- Generating explainable, transparent agronomic recommendations
"""

import os
import json
import joblib
import pandas as pd
import numpy as np

class PredictionService:
    def __init__(self, models_dir=None):
        if models_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            models_dir = os.path.join(base_dir, "ml", "models")
            
        self.models_dir = models_dir
        self.model_path = os.path.join(models_dir, "best_yield_model.pkl")
        self.metadata_path = os.path.join(models_dir, "model_metadata.json")
        
        if not os.path.exists(self.model_path) or not os.path.exists(self.metadata_path):
            raise FileNotFoundError(f"Model artifacts missing in {models_dir}. Please train models first.")
            
        self.pipeline = joblib.load(self.model_path)
        with open(self.metadata_path, "r", encoding="utf-8") as f:
            self.metadata = json.load(f)
            
        # Model uncertainty estimate from test RMSE
        best_model_name = self.metadata["selected_model"]
        self.test_rmse = self.metadata["evaluation_metrics"][best_model_name]["test"]["rmse"]

    def validate_inputs(self, payload):
        errors = []
        
        # Check required fields
        required_fields = [
            "district", "crop", "season", "soil_type",
            "rainfall_mm", "temperature_c", "irrigation_pct", "fertilizer_kg_per_ha"
        ]
        for field in required_fields:
            if field not in payload or payload[field] is None or payload[field] == "":
                errors.append(f"Missing required field: '{field}'")
                
        if errors:
            return None, errors
            
        district = str(payload["district"]).strip()
        crop = str(payload["crop"]).strip()
        season = str(payload["season"]).strip()
        soil_type = str(payload["soil_type"]).strip()
        
        if district not in self.metadata["supported_districts"]:
            errors.append(f"Unsupported district '{district}'. Supported: {', '.join(self.metadata['supported_districts'])}")
            
        if crop not in self.metadata["supported_crops"]:
            errors.append(f"Unsupported crop '{crop}'. Supported: {', '.join(self.metadata['supported_crops'])}")
            
        if season not in self.metadata["supported_seasons"]:
            errors.append(f"Unsupported season '{season}'. Supported: {', '.join(self.metadata['supported_seasons'])}")
            
        if soil_type not in self.metadata["supported_soils"]:
            errors.append(f"Unsupported soil type '{soil_type}'. Supported: {', '.join(self.metadata['supported_soils'])}")
            
        # Numeric validations
        try:
            rainfall = float(payload["rainfall_mm"])
            if rainfall < 0 or rainfall > 3000:
                errors.append("Rainfall must be between 0 and 3000 mm.")
        except (ValueError, TypeError):
            errors.append("Rainfall must be a valid number.")
            rainfall = 0
            
        try:
            temperature = float(payload["temperature_c"])
            if temperature < 10 or temperature > 55:
                errors.append("Temperature must be between 10°C and 55°C.")
        except (ValueError, TypeError):
            errors.append("Temperature must be a valid number.")
            temperature = 0
            
        try:
            irrigation = float(payload["irrigation_pct"])
            if irrigation < 0 or irrigation > 100:
                errors.append("Irrigation percentage must be between 0% and 100%.")
        except (ValueError, TypeError):
            errors.append("Irrigation percentage must be a valid number.")
            irrigation = 0
            
        try:
            fertilizer = float(payload["fertilizer_kg_per_ha"])
            if fertilizer < 0 or fertilizer > 600:
                errors.append("Fertilizer usage must be between 0 and 600 kg/ha.")
        except (ValueError, TypeError):
            errors.append("Fertilizer usage must be a valid number.")
            fertilizer = 0
            
        if errors:
            return None, errors
            
        validated_data = {
            "District": district,
            "Crop": crop,
            "Season": season,
            "Soil_Type": soil_type,
            "Rainfall_mm": rainfall,
            "Temperature_C": temperature,
            "Irrigation_Pct": irrigation,
            "Fertilizer_kg_per_ha": fertilizer
        }
        return validated_data, []

    def generate_recommendations(self, inputs, predicted_yield, historical_avg):
        recommendations = []
        flags = []
        
        hist_rain = historical_avg.get("mean_rainfall_mm", 450)
        hist_temp = historical_avg.get("mean_temp_c", 28)
        hist_fert = historical_avg.get("mean_fert_kg_ha", 100)
        hist_irr = historical_avg.get("mean_irrigation_pct", 60)
        
        crop = inputs["Crop"]
        rain = inputs["Rainfall_mm"]
        temp = inputs["Temperature_C"]
        fert = inputs["Fertilizer_kg_per_ha"]
        irr = inputs["Irrigation_Pct"]
        
        # 1. Moisture & Rainfall Evaluation
        if rain < hist_rain * 0.70:
            if irr < 65:
                recommendations.append({
                    "category": "Water Management",
                    "type": "warning",
                    "title": "Moisture Deficit Risk",
                    "message": f"Scenario rainfall ({rain} mm) is well below the historical seasonal average ({hist_rain} mm) for {crop}. Assured irrigation is currently {irr}%. Consider scheduling supplemental furrow/drip irrigation during critical flowering stages."
                })
                flags.append("rainfall_deficit")
            else:
                recommendations.append({
                    "category": "Water Management",
                    "type": "info",
                    "title": "Low Rainfall Offset by Irrigation",
                    "message": f"Rainfall is below average ({rain} mm vs {hist_rain} mm), but your high irrigation coverage ({irr}%) helps stabilize crop yield."
                })
        elif rain > hist_rain * 1.45:
            recommendations.append({
                "category": "Water Management",
                "type": "warning",
                "title": "Excess Moisture / Waterlogging Alert",
                "message": f"Rainfall ({rain} mm) is significantly higher than historical average ({hist_rain} mm). Ensure adequate drainage channels, especially for {crop} which is susceptible to root aeration loss and fungal blight."
            })
            flags.append("excess_rainfall")
            
        # 2. Temperature Stress
        temp_delta = temp - hist_temp
        if abs(temp_delta) > 3.0:
            recommendations.append({
                "category": "Thermal Condition",
                "type": "warning",
                "title": "Temperature Deviation",
                "message": f"Input temperature ({temp}°C) differs by {temp_delta:+.1f}°C from the historical district average ({hist_temp}°C). Thermal stress may affect vegetative elongation or pollen viability."
            })
            flags.append("temperature_anomaly")
            
        # 3. Fertilizer Evaluation
        if fert > hist_fert * 1.50:
            recommendations.append({
                "category": "Nutrient Management",
                "type": "caution",
                "title": "High Fertilizer Flag",
                "message": f"Fertilizer application ({fert} kg/ha) exceeds typical regional practices ({hist_fert} kg/ha). Agronomic yield shows diminishing returns beyond optimal NPK thresholds; verify soil test reports before heavy application."
            })
            flags.append("excess_fertilizer")
        elif fert < hist_fert * 0.55:
            recommendations.append({
                "category": "Nutrient Management",
                "type": "info",
                "title": "Low Fertilizer Input",
                "message": f"Fertilizer input ({fert} kg/ha) is notably lower than historical district norms ({hist_fert} kg/ha), which may limit vegetative biomass."
            })
            flags.append("low_fertilizer")
            
        # 4. Overall yield comparison insight
        hist_yield = historical_avg.get("mean_yield_kg_ha", 0)
        if hist_yield > 0:
            pct_diff = ((predicted_yield - hist_yield) / hist_yield) * 100
            if pct_diff < -15:
                recommendations.append({
                    "category": "Yield Comparison",
                    "type": "warning",
                    "title": "Below-Average Expected Yield",
                    "message": f"Predicted yield is {abs(pct_diff):.1f}% lower than historical demo district average ({hist_yield} kg/ha), driven primarily by moisture/nutrient constraints."
                })
            elif pct_diff > 15:
                recommendations.append({
                    "category": "Yield Comparison",
                    "type": "success",
                    "title": "Favorable Yield Conditions",
                    "message": f"Predicted yield is {pct_diff:.1f}% above historical demo district average ({hist_yield} kg/ha), reflecting optimal input alignment."
                })
                
        # If no alerts triggered
        if not recommendations:
            recommendations.append({
                "category": "General Advisory",
                "type": "success",
                "title": "Balanced Agronomic Scenario",
                "message": "Selected input parameters align well with historical baseline conditions for this district and crop."
            })
            
        return recommendations, flags

    def predict(self, raw_payload):
        validated_inputs, errors = self.validate_inputs(raw_payload)
        if errors:
            return {"success": False, "errors": errors}
            
        # Format DataFrame for model
        input_df = pd.DataFrame([validated_inputs])
        
        # Inference
        raw_pred = float(self.pipeline.predict(input_df)[0])
        predicted_yield = max(100.0, round(raw_pred, 1))
        
        # Uncertainty Interval (using 1.96 * Test RMSE for ~95% confidence bounds)
        # Bounded at 0 minimum
        uncertainty_margin = round(float(1.96 * self.test_rmse), 1)
        lower_bound = max(0.0, round(predicted_yield - uncertainty_margin, 1))
        upper_bound = round(predicted_yield + uncertainty_margin, 1)
        
        # Fetch matching historical district benchmark
        district = validated_inputs["District"]
        crop = validated_inputs["Crop"]
        
        historical_dict = self.metadata.get("district_historical_benchmarks", {})
        historical_avg = historical_dict.get(district, {}).get(crop, {
            "mean_yield_kg_ha": self.metadata.get("crop_benchmarks", {}).get(crop, {}).get("mean_yield_kg_ha", 0),
            "mean_rainfall_mm": 450,
            "mean_temp_c": 28,
            "mean_irrigation_pct": 60,
            "mean_fert_kg_ha": 100,
            "sample_count": 0
        })
        
        hist_yield = historical_avg.get("mean_yield_kg_ha", 0)
        if hist_yield > 0:
            diff_kg = round(predicted_yield - hist_yield, 1)
            diff_pct = round(((predicted_yield - hist_yield) / hist_yield) * 100, 1)
        else:
            diff_kg = 0.0
            diff_pct = 0.0
            
        # Generate agronomic advisory
        recommendations, flags = self.generate_recommendations(validated_inputs, predicted_yield, historical_avg)
        
        return {
            "success": True,
            "prediction": {
                "yield_kg_per_ha": predicted_yield,
                "yield_tonnes_per_ha": round(predicted_yield / 1000.0, 2),
                "yield_unit": "kg/ha (kilograms per hectare)",
                "uncertainty_range": {
                    "margin_kg_ha": uncertainty_margin,
                    "lower_bound_kg_ha": lower_bound,
                    "upper_bound_kg_ha": upper_bound,
                    "confidence_level": "95% empirical prediction interval"
                }
            },
            "historical_context": {
                "historical_avg_yield_kg_ha": hist_yield,
                "historical_avg_yield_t_ha": round(hist_yield / 1000.0, 2),
                "difference_kg_ha": diff_kg,
                "difference_percentage": diff_pct,
                "district": district,
                "crop": crop,
                "sample_count": historical_avg.get("sample_count", 0),
                "historical_mean_rainfall_mm": historical_avg.get("mean_rainfall_mm"),
                "historical_mean_temp_c": historical_avg.get("mean_temp_c")
            },
            "recommendations": recommendations,
            "anomaly_flags": flags,
            "model_info": {
                "model_name": self.metadata.get("selected_model"),
                "model_version": self.metadata.get("model_version"),
                "test_r2": self.metadata.get("evaluation_metrics", {}).get(self.metadata.get("selected_model"), {}).get("test", {}).get("r2"),
                "test_mae_kg_ha": self.metadata.get("evaluation_metrics", {}).get(self.metadata.get("selected_model"), {}).get("test", {}).get("mae"),
                "training_period": self.metadata.get("training_period"),
                "test_period": self.metadata.get("test_period"),
                "region": self.metadata.get("region"),
                "dataset_type": self.metadata.get("dataset_type"),
                "disclaimer": self.metadata.get("disclaimer")
            },
            "inputs_echo": validated_inputs
        }

    def compare_crops_for_scenario(self, payload):
        """Simulate yield across all supported crops under identical environmental scenario."""
        results = []
        for crop in self.metadata["supported_crops"]:
            scenario = payload.copy()
            scenario["crop"] = crop
            # Default reasonable fertilizer if differing
            res = self.predict(scenario)
            if res.get("success"):
                results.append({
                    "crop": crop,
                    "predicted_yield_kg_ha": res["prediction"]["yield_kg_per_ha"],
                    "historical_avg_kg_ha": res["historical_context"]["historical_avg_yield_kg_ha"],
                    "difference_pct": res["historical_context"]["difference_percentage"]
                })
        return results
