/**
 * AgriYield Tamil Nadu Frontend Logic
 * Connects UI inputs to backend REST API, renders Chart.js charts,
 * manages quick presets, and handles agronomic advisory displays.
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const form = document.getElementById("predictionForm");
  const predictBtn = document.getElementById("predictBtn");
  const btnSpinner = document.getElementById("btnSpinner");
  const errorAlert = document.getElementById("errorAlert");
  const errorMessage = document.getElementById("errorMessage");

  // Input Elements
  const districtSelect = document.getElementById("districtSelect");
  const cropSelect = document.getElementById("cropSelect");
  const seasonSelect = document.getElementById("seasonSelect");
  const soilSelect = document.getElementById("soilSelect");

  const rainfallRange = document.getElementById("rainfallRange");
  const rainfallInput = document.getElementById("rainfallInput");
  const rainfallVal = document.getElementById("rainfallVal");

  const tempRange = document.getElementById("tempRange");
  const tempInput = document.getElementById("tempInput");
  const tempVal = document.getElementById("tempVal");

  const irrigationRange = document.getElementById("irrigationRange");
  const irrigationInput = document.getElementById("irrigationInput");
  const irrigationVal = document.getElementById("irrigationVal");

  const fertilizerRange = document.getElementById("fertilizerRange");
  const fertilizerInput = document.getElementById("fertilizerInput");
  const fertilizerVal = document.getElementById("fertilizerVal");

  // Output Elements
  const predictedYieldVal = document.getElementById("predictedYieldVal");
  const predictedYieldTonnes = document.getElementById("predictedYieldTonnes");
  const uncertaintyText = document.getElementById("uncertaintyText");
  const historicalYieldVal = document.getElementById("historicalYieldVal");
  const historicalYieldTonnes = document.getElementById("historicalYieldTonnes");
  const benchmarkDistrictBadge = document.getElementById("benchmarkDistrictBadge");
  const deltaVal = document.getElementById("deltaVal");
  const deltaKgVal = document.getElementById("deltaKgVal");
  const statusPill = document.getElementById("statusPill");
  const recommendationsList = document.getElementById("recommendationsList");
  const chartContextTag = document.getElementById("chartContextTag");

  // Tabs
  const tabHistChart = document.getElementById("tabHistChart");
  const tabCropChart = document.getElementById("tabCropChart");
  let activeTab = "hist"; // 'hist' or 'crop'
  let latestPredictionData = null;
  let chartInstance = null;

  // Sync Sliders
  function setupSlider(rangeEl, inputEl, displayEl, unit = "") {
    rangeEl.addEventListener("input", (e) => {
      inputEl.value = e.target.value;
      displayEl.textContent = e.target.value;
    });
  }

  setupSlider(rainfallRange, rainfallInput, rainfallVal);
  setupSlider(tempRange, tempInput, tempVal);
  setupSlider(irrigationRange, irrigationInput, irrigationVal);
  setupSlider(fertilizerRange, fertilizerInput, fertilizerVal);

  function setSliderValue(rangeEl, inputEl, displayEl, val) {
    rangeEl.value = val;
    inputEl.value = val;
    displayEl.textContent = val;
  }

  // Presets definition
  const presets = {
    presetDeltaRice: {
      district: "Thanjavur",
      crop: "Rice (Paddy)",
      season: "Samba",
      soil_type: "Alluvial",
      rainfall_mm: 680,
      temperature_c: 27.5,
      irrigation_pct: 85,
      fertilizer_kg_per_ha: 135
    },
    presetCoimbatoreMaize: {
      district: "Coimbatore",
      crop: "Maize",
      season: "Samba",
      soil_type: "Red Loamy",
      rainfall_mm: 480,
      temperature_c: 27.0,
      irrigation_pct: 75,
      fertilizer_kg_per_ha: 155
    },
    presetDroughtRisk: {
      district: "Madurai",
      crop: "Rice (Paddy)",
      season: "Kuruvai",
      soil_type: "Clayey",
      rainfall_mm: 120,
      temperature_c: 34.5,
      irrigation_pct: 25,
      fertilizer_kg_per_ha: 90
    },
    presetNavaraiGroundnut: {
      district: "Villupuram",
      crop: "Groundnut",
      season: "Navarai",
      soil_type: "Sandy Loam",
      rainfall_mm: 220,
      temperature_c: 29.5,
      irrigation_pct: 65,
      fertilizer_kg_per_ha: 65
    }
  };

  function applyPreset(presetKey) {
    const p = presets[presetKey];
    if (!p) return;

    districtSelect.value = p.district;
    cropSelect.value = p.crop;
    seasonSelect.value = p.season;
    soilSelect.value = p.soil_type;

    setSliderValue(rainfallRange, rainfallInput, rainfallVal, p.rainfall_mm);
    setSliderValue(tempRange, tempInput, tempVal, p.temperature_c);
    setSliderValue(irrigationRange, irrigationInput, irrigationVal, p.irrigation_pct);
    setSliderValue(fertilizerRange, fertilizerInput, fertilizerVal, p.fertilizer_kg_per_ha);

    // Update active preset button style
    document.querySelectorAll(".preset-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(presetKey);
    if (activeBtn) activeBtn.classList.add("active");

    triggerPrediction();
  }

  // Bind Preset Buttons
  Object.keys(presets).forEach(key => {
    const btn = document.getElementById(key);
    if (btn) {
      btn.addEventListener("click", () => applyPreset(key));
    }
  });

  // Fetch API Metadata on load
  async function loadMetadata() {
    try {
      const res = await fetch("/api/metadata");
      if (res.ok) {
        const data = await res.json();
        const meta = data.metadata;
        if (meta) {
          const badge = document.getElementById("headerModelBadge");
          if (badge && meta.selected_model) {
            badge.textContent = `Model: ${meta.selected_model} (${meta.model_version})`;
          }
          const infoR2 = document.getElementById("infoModelR2");
          const infoMAE = document.getElementById("infoModelMAE");
          const infoModel = document.getElementById("infoModelName");
          if (infoR2) infoR2.textContent = meta.evaluation_metrics[meta.selected_model].test.r2;
          if (infoMAE) infoMAE.textContent = `${meta.evaluation_metrics[meta.selected_model].test.mae} kg/ha`;
          if (infoModel) infoModel.textContent = meta.selected_model;
        }
      }
    } catch (err) {
      console.warn("Could not load backend metadata:", err);
    }
  }

  // Prediction Request Handler
  async function triggerPrediction() {
    errorAlert.style.display = "none";
    predictBtn.classList.add("loading");
    predictBtn.disabled = true;

    const payload = {
      district: districtSelect.value,
      crop: cropSelect.value,
      season: seasonSelect.value,
      soil_type: soilSelect.value,
      rainfall_mm: parseFloat(rainfallInput.value),
      temperature_c: parseFloat(tempInput.value),
      irrigation_pct: parseFloat(irrigationInput.value),
      fertilizer_kg_per_ha: parseFloat(fertilizerInput.value)
    };

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errs = result.errors ? result.errors.join("<br>") : "Prediction request failed.";
        showError(errs);
        return;
      }

      latestPredictionData = result;
      renderResults(result);

      if (activeTab === "crop") {
        renderCropComparison(payload);
      } else {
        renderHistoricalChart(result);
      }

    } catch (error) {
      showError(`Network connection error: ${error.message}. Ensure backend server is running.`);
    } finally {
      predictBtn.classList.remove("loading");
      predictBtn.disabled = false;
    }
  }

  function showError(msg) {
    errorMessage.innerHTML = msg;
    errorAlert.style.display = "flex";
  }

  function renderResults(data) {
    const pred = data.prediction;
    const hist = data.historical_context;

    // 1. Predicted Yield
    predictedYieldVal.textContent = pred.yield_kg_per_ha.toLocaleString();
    predictedYieldTonnes.textContent = `${pred.yield_tonnes_per_ha} tonnes / hectare`;
    uncertaintyText.textContent = `Uncertainty: ±${pred.uncertainty_range.margin_kg_ha} kg/ha (${pred.uncertainty_range.lower_bound_kg_ha.toLocaleString()} - ${pred.uncertainty_range.upper_bound_kg_ha.toLocaleString()})`;

    // 2. Historical Baseline
    historicalYieldVal.textContent = hist.historical_avg_yield_kg_ha.toLocaleString();
    historicalYieldTonnes.textContent = `${hist.historical_avg_yield_t_ha} tonnes / hectare`;
    benchmarkDistrictBadge.textContent = `${hist.district} • ${hist.crop}`;

    // 3. Delta
    const diffPct = hist.difference_percentage;
    const isPositive = diffPct >= 0;
    deltaVal.textContent = `${isPositive ? "+" : ""}${diffPct}%`;
    deltaKgVal.textContent = `${isPositive ? "+" : ""}${hist.difference_kg_ha.toLocaleString()} kg/ha vs historical`;

    statusPill.className = "status-indicator " + (isPositive ? "positive" : "negative");
    statusPill.textContent = isPositive ? "Favorable" : "Yield Deficit";

    chartContextTag.textContent = `${hist.district} • ${hist.crop} (${data.inputs_echo.Season})`;

    // 4. Recommendations
    renderRecommendations(data.recommendations);
  }

  function renderRecommendations(recs) {
    if (!recs || recs.length === 0) {
      recommendationsList.innerHTML = `<div class="empty-state"><p>No advisory alerts for this scenario.</p></div>`;
      return;
    }

    const iconMap = {
      warning: "⚠️",
      caution: "⚡",
      info: "ℹ️",
      success: "✅"
    };

    recommendationsList.innerHTML = recs.map(r => `
      <div class="rec-item ${r.type}">
        <span class="rec-icon">${iconMap[r.type] || "•"}</span>
        <div class="rec-content">
          <h4>${escapeHtml(r.title)} <small style="opacity:0.75; font-weight:normal;">[${escapeHtml(r.category)}]</small></h4>
          <p>${escapeHtml(r.message)}</p>
        </div>
      </div>
    `).join("");
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Chart Rendering
  function renderHistoricalChart(data) {
    const ctx = document.getElementById("yieldChart").getContext("2d");
    if (chartInstance) chartInstance.destroy();

    const predYield = data.prediction.yield_kg_per_ha;
    const histYield = data.historical_context.historical_avg_yield_kg_ha;
    const lowerBound = data.prediction.uncertainty_range.lower_bound_kg_ha;
    const upperBound = data.prediction.uncertainty_range.upper_bound_kg_ha;

    chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Current Scenario (Predicted)", "District 10-Yr Historical Mean"],
        datasets: [
          {
            label: "Yield (kg/ha)",
            data: [predYield, histYield],
            backgroundColor: [
              "rgba(16, 185, 129, 0.75)",
              "rgba(56, 189, 248, 0.65)"
            ],
            borderColor: [
              "#10b981",
              "#38bdf8"
            ],
            borderWidth: 2,
            borderRadius: 8,
            barThickness: 50
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: function(context) {
                if (context.dataIndex === 0) {
                  return `95% Confidence Range: ${lowerBound.toLocaleString()} - ${upperBound.toLocaleString()} kg/ha`;
                }
                return `District Sample Count: ${data.historical_context.sample_count} records`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255, 255, 255, 0.06)" },
            ticks: {
              color: "#94a3b8",
              callback: val => val + " kg/ha"
            }
          },
          x: {
            grid: { display: false },
            ticks: { color: "#e2e8f0", font: { weight: "600" } }
          }
        }
      }
    });
  }

  async function renderCropComparison(currentPayload) {
    const ctx = document.getElementById("yieldChart").getContext("2d");
    if (chartInstance) chartInstance.destroy();

    try {
      const res = await fetch("/api/crop-comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentPayload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) return;

      const crops = data.comparison.map(c => c.crop);
      const predictedYields = data.comparison.map(c => c.predicted_yield_kg_ha);
      const historicalYields = data.comparison.map(c => c.historical_avg_kg_ha);

      chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels: crops,
          datasets: [
            {
              label: "Predicted (kg/ha)",
              data: predictedYields,
              backgroundColor: "rgba(16, 185, 129, 0.75)",
              borderColor: "#10b981",
              borderWidth: 1.5,
              borderRadius: 6
            },
            {
              label: "Historical Baseline (kg/ha)",
              data: historicalYields,
              backgroundColor: "rgba(148, 163, 184, 0.45)",
              borderColor: "#94a3b8",
              borderWidth: 1.5,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              labels: { color: "#94a3b8" }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "rgba(255, 255, 255, 0.06)" },
              ticks: { color: "#94a3b8" }
            },
            x: {
              grid: { display: false },
              ticks: { color: "#e2e8f0" }
            }
          }
        }
      });
    } catch (err) {
      console.error("Error loading crop comparison:", err);
    }
  }

  // Tab switching
  tabHistChart.addEventListener("click", () => {
    tabHistChart.classList.add("active");
    tabCropChart.classList.remove("active");
    activeTab = "hist";
    if (latestPredictionData) renderHistoricalChart(latestPredictionData);
  });

  tabCropChart.addEventListener("click", () => {
    tabCropChart.classList.add("active");
    tabHistChart.classList.remove("active");
    activeTab = "crop";
    const payload = {
      district: districtSelect.value,
      crop: cropSelect.value,
      season: seasonSelect.value,
      soil_type: soilSelect.value,
      rainfall_mm: parseFloat(rainfallInput.value),
      temperature_c: parseFloat(tempInput.value),
      irrigation_pct: parseFloat(irrigationInput.value),
      fertilizer_kg_per_ha: parseFloat(fertilizerInput.value)
    };
    renderCropComparison(payload);
  });

  // Form submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    triggerPrediction();
  });

  // Initial load
  loadMetadata();
  triggerPrediction();
});
