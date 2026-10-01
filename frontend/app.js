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

  // Smart API Base URL: auto-connects to http://127.0.0.1:5000 if opened via file:// or alternative local ports on localhost
  const isDirectFile = window.location.protocol === "file:" || !window.location.origin || window.location.origin === "null";
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const API_BASE = isDirectFile || (isLocalhost && window.location.port !== "5000")
    ? "http://127.0.0.1:5000"
    : "";

  // Safe JSON response parser
  async function safeJson(response) {
    const rawText = await response.text();
    if (!rawText || rawText.trim() === "") {
      throw new Error(`Empty response from server (Status ${response.status}). Ensure backend server is running on port 5000.`);
    }
    try {
      return JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Server returned non-JSON data (${response.status} ${response.statusText}): ${rawText.slice(0, 120)}`);
    }
  }

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
      const res = await fetch(`${API_BASE}/api/metadata`);
      if (res.ok) {
        const data = await safeJson(res);
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
      const response = await fetch(`${API_BASE}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await safeJson(response);

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
      let extra = `Ensure backend server is running on port 5000.`;
      if (isDirectFile) {
        extra += `<br><br>💡 <em>Tip: You opened index.html directly from your folder (file://). To access the complete app, open <a href="http://127.0.0.1:5000" target="_blank" style="color:#38bdf8;text-decoration:underline;">http://127.0.0.1:5000</a> in your browser.</em>`;
      }
      showError(`Network connection error: ${error.message}<br><small style="opacity:0.85">${extra}</small>`);
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

    // Farmer unit conversions (Tamil Nadu local units: Quintals & Bags/acre)
    const predQPerHa = (pred.yield_kg_per_ha / 100).toFixed(1);
    const predBagsAcre = (pred.yield_kg_per_ha / 75 / 2.47105).toFixed(1);
    const predictedFarmerUnits = document.getElementById("predictedFarmerUnits");
    if (predictedFarmerUnits) {
      predictedFarmerUnits.innerHTML = `≈ <strong>${predQPerHa}</strong> Quintals/ha • <strong>${predBagsAcre}</strong> Bags/acre (75kg)`;
    }

    // 2. Historical Baseline
    historicalYieldVal.textContent = hist.historical_avg_yield_kg_ha.toLocaleString();
    historicalYieldTonnes.textContent = `${hist.historical_avg_yield_t_ha} tonnes / hectare`;
    benchmarkDistrictBadge.textContent = `${hist.district} • ${hist.crop}`;

    const histQPerHa = (hist.historical_avg_yield_kg_ha / 100).toFixed(1);
    const histBagsAcre = (hist.historical_avg_yield_kg_ha / 75 / 2.47105).toFixed(1);
    const historicalFarmerUnits = document.getElementById("historicalFarmerUnits");
    if (historicalFarmerUnits) {
      historicalFarmerUnits.innerHTML = `≈ <strong>${histQPerHa}</strong> Quintals/ha (${histBagsAcre} bags/acre)`;
    }

    // 3. Delta
    const diffPct = hist.difference_percentage;
    const isPositive = diffPct >= 0;
    deltaVal.textContent = `${isPositive ? "+" : ""}${diffPct}%`;
    deltaKgVal.textContent = `${isPositive ? "+" : ""}${hist.difference_kg_ha.toLocaleString()} kg/ha vs historical`;

    statusPill.className = "status-indicator " + (isPositive ? "positive" : "negative");
    statusPill.textContent = isPositive ? "Favorable Outlook" : "Deficit Risk";

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
      const res = await fetch(`${API_BASE}/api/crop-comparison`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentPayload)
      });
      const data = await safeJson(res);
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

  // ==========================================================================
  // Gemini Agricultural Voice Assistant Chatbot (English & Tamil)
  // ==========================================================================
  const chatToggleBtn = document.getElementById("chatToggleBtn");
  const chatPanel = document.getElementById("chatPanel");
  const chatCloseBtn = document.getElementById("chatCloseBtn");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatMessages = document.getElementById("chatMessages");
  const micBtn = document.getElementById("micBtn");
  const voiceBanner = document.getElementById("voiceRecordingBanner");
  const voiceStatusText = document.getElementById("voiceStatusText");
  const chatLangEn = document.getElementById("chatLangEn");
  const chatLangTa = document.getElementById("chatLangTa");
  const chatTtsToggle = document.getElementById("chatTtsToggle");
  const ttsIcon = document.getElementById("ttsIcon");
  const chatSuggestions = document.getElementById("chatSuggestions");
  const welcomeGreeting = document.getElementById("welcomeGreeting");

  let currentChatLang = "en"; // 'en' or 'ta'
  let autoVoiceEnabled = true;
  let isListening = false;
  let recognition = null;
  let synth = window.speechSynthesis;

  const suggestionsData = {
    en: [
      "🌾 Tips for higher Samba rice yield",
      "💧 Water management during drought",
      "🐛 Pest control for Groundnut",
      "🌱 Optimum fertilizer for Maize",
      "📊 Explain my predicted yield"
    ],
    ta: [
      "🌾 அதிக சம்பா நெல் மகசூல் பெற வழிகள்",
      "💧 வறட்சி காலத்தில் நீர் மேலாண்மை",
      "🐛 நிலக்கடலை சுருள் பூச்சி கட்டுப்பாடு",
      "🌱 மக்காச்சோளத்திற்கு உகந்த உரம்",
      "📊 என் விளைச்சல் கணிப்பை விளக்கு"
    ]
  };

  const greetings = {
    en: "Vanakkam! I am <strong>உழவர் தோழன் (Farmer’s Friend)</strong>, your Tamil Nadu agronomic advisor. Ask me anything about crop cultivation, soil health, water management, or pest control across Tamil Nadu agro-climatic zones! Click the <strong>microphone (🎙️)</strong> to speak in English or தமிழ்.",
    ta: "வணக்கம்! நான் உங்கள் <strong>உழவர் தோழன்</strong>. தமிழ்நாட்டில் பயிர் சாகுபடி, மண் நலம், உரம், பூச்சி கட்டுப்பாடு குறித்து எதையும் கேளுங்கள்! <strong>மைக் (🎙️)</strong> பட்டனை அழுத்தி தமிழில் பேசலாம்."
  };

  const placeholders = {
    en: "Ask in English or click 🎙️ to speak...",
    ta: "கேள்வியை தட்டச்சு செய்யவும் அல்லது 🎙️ பேசி கேட்கவும்..."
  };

  // Toggle Chat Panel
  function toggleChat() {
    const isHidden = chatPanel.style.display === "none";
    chatPanel.style.display = isHidden ? "flex" : "none";
    if (isHidden) {
      chatInput.focus();
      renderSuggestions();
    }
  }

  if (chatToggleBtn) chatToggleBtn.addEventListener("click", toggleChat);
  if (chatCloseBtn) chatCloseBtn.addEventListener("click", toggleChat);

  // Switch Language
  function setChatLanguage(lang) {
    currentChatLang = lang;
    if (lang === "ta") {
      chatLangTa.classList.add("active");
      chatLangEn.classList.remove("active");
      welcomeGreeting.innerHTML = greetings.ta;
      chatInput.placeholder = placeholders.ta;
    } else {
      chatLangEn.classList.add("active");
      chatLangTa.classList.remove("active");
      welcomeGreeting.innerHTML = greetings.en;
      chatInput.placeholder = placeholders.en;
    }
    renderSuggestions();
  }

  if (chatLangEn) chatLangEn.addEventListener("click", () => setChatLanguage("en"));
  if (chatLangTa) chatLangTa.addEventListener("click", () => setChatLanguage("ta"));

  // Auto-TTS Toggle
  if (chatTtsToggle) {
    chatTtsToggle.addEventListener("click", () => {
      autoVoiceEnabled = !autoVoiceEnabled;
      chatTtsToggle.classList.toggle("active", autoVoiceEnabled);
      ttsIcon.textContent = autoVoiceEnabled ? "🔊" : "🔇";
      if (!autoVoiceEnabled && synth) {
        synth.cancel();
      }
    });
  }

  // Render Suggestion Chips
  function renderSuggestions() {
    if (!chatSuggestions) return;
    const items = suggestionsData[currentChatLang] || suggestionsData.en;
    chatSuggestions.innerHTML = items.map(text => `
      <button type="button" class="suggestion-chip">${escapeHtml(text)}</button>
    `).join("");

    chatSuggestions.querySelectorAll(".suggestion-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        chatInput.value = btn.textContent;
        sendMessage();
      });
    });
  }

  // Voice Assistant: Text-to-Speech (TTS)
  function speakText(text) {
    if (!synth || !autoVoiceEnabled) return;
    synth.cancel(); // Stop any previous speech

    // Clean markdown/symbols for natural voice reading
    const cleanText = text.replace(/[*_#`>-]/g, "").replace(/\n+/g, ". ");
    const utterance = new SpeechSynthesisUtterance(cleanText);

    utterance.lang = currentChatLang === "ta" ? "ta-IN" : "en-IN";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try finding specific Tamil voice if available
    const voices = synth.getVoices();
    if (currentChatLang === "ta") {
      const taVoice = voices.find(v => v.lang.includes("ta") || v.name.toLowerCase().includes("tamil"));
      if (taVoice) utterance.voice = taVoice;
    } else {
      const enVoice = voices.find(v => v.lang.includes("en-IN") || v.lang.includes("en"));
      if (enVoice) utterance.voice = enVoice;
    }

    synth.speak(utterance);
  }

  // Voice Assistant: Speech-to-Text (STT via Web Speech API)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add("listening");
      voiceBanner.style.display = "flex";
      voiceStatusText.textContent = currentChatLang === "ta"
        ? "🎙️ கேட்கிறது... தமிழில் பேசுங்கள்..."
        : "🎙️ Listening... Speak your question...";
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      chatInput.value = transcript;
      sendMessage();
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };
  }

  function startListening() {
    if (!recognition) {
      alert(currentChatLang === "ta"
        ? "உங்கள் உலாவியில் குரல் உள்ளீடு வசதி ஆதரிக்கப்படவில்லை. தயவுசெய்து Google Chrome உலாவியைப் பயன்படுத்தவும்."
        : "Voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    recognition.lang = currentChatLang === "ta" ? "ta-IN" : "en-IN";
    try {
      recognition.start();
    } catch (e) {
      stopListening();
    }
  }

  function stopListening() {
    isListening = false;
    if (micBtn) micBtn.classList.remove("listening");
    if (voiceBanner) voiceBanner.style.display = "none";
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
    }
  }

  if (micBtn) {
    micBtn.addEventListener("click", () => {
      if (isListening) {
        stopListening();
      } else {
        startListening();
      }
    });
  }

  // Append Chat Message Bubble
  function appendMessage(text, isUser = false) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-msg ${isUser ? "user-msg" : "bot-msg"}`;

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";

    const p = document.createElement("p");
    p.textContent = text;
    bubble.appendChild(p);

    if (!isUser) {
      const actions = document.createElement("div");
      actions.className = "msg-actions";
      const speakBtn = document.createElement("button");
      speakBtn.type = "button";
      speakBtn.className = "speak-msg-btn";
      speakBtn.title = "Read aloud (வாசித்துக் காட்டு)";
      speakBtn.textContent = "🔊";
      speakBtn.addEventListener("click", () => speakText(text));
      actions.appendChild(speakBtn);
      bubble.appendChild(actions);
    }

    msgDiv.appendChild(bubble);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgDiv;
  }

  // Send Message to Gemini REST API
  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(text, true);
    chatInput.value = "";

    // Typing placeholder indicator
    const typingDiv = appendMessage(currentChatLang === "ta" ? "சிந்திக்கிறது..." : "Thinking...", false);

    // Current Farm Context from Dashboard
    const farmContext = {
      district: districtSelect ? districtSelect.value : "Thanjavur",
      crop: cropSelect ? cropSelect.value : "Rice (Paddy)",
      season: seasonSelect ? seasonSelect.value : "Samba",
      predicted_yield_kg_ha: latestPredictionData ? latestPredictionData.prediction.yield_kg_per_ha : null,
      rainfall_mm: rainfallInput ? rainfallInput.value : null,
      temperature_c: tempInput ? tempInput.value : null
    };

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          language: currentChatLang,
          context: farmContext
        })
      });

      const data = await safeJson(res);
      typingDiv.remove();

      if (res.ok && data.success) {
        appendMessage(data.reply, false);
        if (autoVoiceEnabled) {
          speakText(data.reply);
        }
      } else {
        const errorText = data.error || (currentChatLang === "ta" ? "பதில் பெற முடியவில்லை." : "Failed to get reply.");
        appendMessage(`⚠️ ${errorText}`, false);
      }
    } catch (err) {
      typingDiv.remove();
      appendMessage(`⚠️ Network error: ${err.message}`, false);
    }
  }

  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage();
    });
  }

  // =========================================================================
  // THREE-STAGE ROUTING & 3D SIMULATION CONTROLLER
  // =========================================================================
  const landingStage = document.getElementById("landingStage");
  const dashboardStage = document.getElementById("dashboardStage");
  const simulationStage = document.getElementById("simulationStage");
  const sceneTransitionOverlay = document.getElementById("sceneTransitionOverlay");

  const exploreCtaBtn = document.getElementById("exploreCtaBtn");
  const navExploreBtn = document.getElementById("navExploreBtn");
  const returnLandingBtn = document.getElementById("returnLandingBtn");
  const previewInspectBtn = document.getElementById("previewInspectBtn");
  const openSimulationBtn = document.getElementById("openSimulationBtn");
  const tabLaunchSimBtn = document.getElementById("tabLaunchSimBtn");
  const backToDashboardBtn = document.getElementById("backToDashboardBtn");

  const storyStepBtns = document.querySelectorAll(".story-step-btn");
  const mapNodes = document.querySelectorAll(".map-node");

  let scene3D = null;        // Page 1 3D scene (Landing)
  let simScene3D = null;     // Page 3 3D scene (Simulation)

  function initLanding3DScene() {
    if (!scene3D && window.AgriField3DScene && document.getElementById("webglCanvasContainer")) {
      try {
        scene3D = new window.AgriField3DScene("webglCanvasContainer");
      } catch (err) {
        console.warn("Could not start landing 3D scene:", err);
      }
    }
  }

  function initSimulation3DScene() {
    if (!simScene3D && window.AgriSimulation3DScene && document.getElementById("simCanvasContainer")) {
      try {
        simScene3D = new window.AgriSimulation3DScene("simCanvasContainer");
      } catch (err) {
        console.warn("Could not start simulation 3D scene:", err);
      }
    }
  }

  function getCurrentRoute() {
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path.endsWith("/simulation") || hash === "#simulation") return "simulation";
    if (path.endsWith("/dashboard") || hash === "#dashboard") return "dashboard";
    return "landing";
  }

  function showLanding(smooth = true) {
    if (smooth && sceneTransitionOverlay) {
      sceneTransitionOverlay.classList.add("active");
      setTimeout(() => {
        applyStageVisibility("landing");
        setTimeout(() => sceneTransitionOverlay.classList.remove("active"), 150);
      }, 350);
    } else {
      applyStageVisibility("landing");
    }
  }

  function showDashboard(smooth = true) {
    if (smooth) {
      if (scene3D) scene3D.zoomIntoCore();
      if (sceneTransitionOverlay) sceneTransitionOverlay.classList.add("active");

      setTimeout(() => {
        applyStageVisibility("dashboard");
        if (chartInstance) {
          setTimeout(() => chartInstance.resize(), 100);
        }
        setTimeout(() => {
          if (sceneTransitionOverlay) sceneTransitionOverlay.classList.remove("active");
        }, 150);
      }, 500);
    } else {
      applyStageVisibility("dashboard");
      if (chartInstance) {
        setTimeout(() => chartInstance.resize(), 100);
      }
    }
  }

  function showSimulation(smooth = true) {
    if (smooth && sceneTransitionOverlay) {
      sceneTransitionOverlay.classList.add("active");
      setTimeout(() => {
        applyStageVisibility("simulation");
        syncSimulationWithDashboardData();
        setTimeout(() => sceneTransitionOverlay.classList.remove("active"), 150);
      }, 350);
    } else {
      applyStageVisibility("simulation");
      syncSimulationWithDashboardData();
    }
  }

  function applyStageVisibility(stage) {
    document.body.classList.remove("page-landing-mode", "page-dashboard-mode", "page-simulation-mode");

    if (stage === "landing") {
      if (landingStage) landingStage.style.display = "flex";
      if (dashboardStage) dashboardStage.style.display = "none";
      if (simulationStage) simulationStage.style.display = "none";
      document.body.classList.add("page-landing-mode");
      window.scrollTo(0, 0);

      updateHistoryRoute("/", "");
      initLanding3DScene();
      if (scene3D) {
        scene3D.isTransitioning = false;
        scene3D.targetCameraZ = 8.5;
        scene3D.targetCameraY = 1.45;
        scene3D.targetCameraX = 0;
      }
    } else if (stage === "dashboard") {
      if (landingStage) landingStage.style.display = "none";
      if (dashboardStage) dashboardStage.style.display = "block";
      if (simulationStage) simulationStage.style.display = "none";
      document.body.classList.add("page-dashboard-mode");
      window.scrollTo(0, 0);

      updateHistoryRoute("/dashboard", "#dashboard");
    } else if (stage === "simulation") {
      if (landingStage) landingStage.style.display = "none";
      if (dashboardStage) dashboardStage.style.display = "none";
      if (simulationStage) simulationStage.style.display = "flex";
      document.body.classList.add("page-simulation-mode");
      window.scrollTo(0, 0);

      updateHistoryRoute("/simulation", "#simulation");
      initSimulation3DScene();
      if (simScene3D) {
        simScene3D.onWindowResize();
      }
    }
  }

  function updateHistoryRoute(pathname, hashFallback) {
    if (!isDirectFile && window.location.pathname !== pathname) {
      try {
        history.pushState({ stage: pathname }, `Claudrix Agri TN`, pathname);
      } catch (e) {
        window.location.hash = hashFallback;
      }
    } else if (isDirectFile) {
      window.location.hash = hashFallback;
    }
  }

  // =========================================================================
  // PAGE 3: SIMULATION DATA SYNCHRONIZATION & INTERACTIVE SCENARIOS
  // =========================================================================
  function syncSimulationWithDashboardData() {
    initSimulation3DScene();

    const data = latestPredictionData;
    const currentCrop = cropSelect ? cropSelect.value : "Rice (Paddy)";
    const currentDistrict = districtSelect ? districtSelect.value : "Thanjavur";
    const currentSeason = seasonSelect ? seasonSelect.value : "Samba";
    const currentSoil = soilSelect ? soilSelect.value : "Alluvial";
    const currentRain = rainfallInput ? parseFloat(rainfallInput.value) : 680;
    const currentTemp = tempInput ? parseFloat(tempInput.value) : 27.5;
    const currentIrrig = irrigationInput ? parseFloat(irrigationInput.value) : 85;
    const currentFert = fertilizerInput ? parseFloat(fertilizerInput.value) : 135;

    // Header context text
    const simContextText = document.getElementById("simContextText");
    if (simContextText) {
      simContextText.textContent = `${currentDistrict} • ${currentCrop} • ${currentSeason} Season`;
    }

    // Default or model numbers
    const predYield = data?.prediction?.yield_kg_per_ha ?? 4387.7;
    const histYield = data?.historical_context?.historical_avg_yield_kg_ha ?? 3870.0;
    const diffKg = data?.historical_context?.difference_kg_ha ?? (predYield - histYield);
    const diffPct = data?.historical_context?.difference_percentage ?? ((diffKg / histYield) * 100);

    updateSimulationUI(predYield, histYield, diffKg, diffPct, currentCrop, currentRain, currentTemp, currentIrrig, currentSoil);

    // Update 3D Scene
    if (simScene3D) {
      simScene3D.updateScenarioData({
        currentYield: predYield,
        historicalYield: histYield,
        crop: currentCrop,
        scenario: "current"
      });
    }

    // Reset scenario buttons active state to 'Current Scenario'
    document.querySelectorAll(".scenario-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.scenario === "current");
    });

    // Reset crop plot buttons active state
    document.querySelectorAll(".crop-plot-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.crop === currentCrop);
    });
  }

  function updateSimulationUI(predYield, histYield, diffKg, diffPct, crop, rain, temp, irrig, soil) {
    const simCurrentYieldVal = document.getElementById("simCurrentYieldVal");
    const simHistoricalYieldVal = document.getElementById("simHistoricalYieldVal");
    const hudZoneAYield = document.getElementById("hudZoneAYield");
    const hudZoneBYield = document.getElementById("hudZoneBYield");
    const simDiffKgVal = document.getElementById("simDiffKgVal");
    const simDiffPctVal = document.getElementById("simDiffPctVal");
    const simCurrentBar = document.getElementById("simCurrentBar");
    const simHistoricalBar = document.getElementById("simHistoricalBar");
    const simRainVal = document.getElementById("simRainVal");
    const simTempVal = document.getElementById("simTempVal");
    const simIrrigationVal = document.getElementById("simIrrigationVal");
    const simSoilVal = document.getElementById("simSoilVal");
    const simExplainerText = document.getElementById("simExplainerText");

    if (simCurrentYieldVal) simCurrentYieldVal.textContent = `${predYield.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg/ha`;
    if (simHistoricalYieldVal) simHistoricalYieldVal.textContent = `${histYield.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg/ha`;
    if (hudZoneAYield) hudZoneAYield.textContent = `${predYield.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg/ha`;
    if (hudZoneBYield) hudZoneBYield.textContent = `${histYield.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg/ha`;

    const sign = diffKg >= 0 ? "+" : "";
    if (simDiffKgVal) {
      simDiffKgVal.textContent = `${sign}${diffKg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg/ha`;
      simDiffKgVal.className = `delta-number ${diffKg >= 0 ? "positive" : "negative"}`;
    }

    if (simDiffPctVal) {
      simDiffPctVal.textContent = `${sign}${diffPct.toFixed(1)}%`;
      simDiffPctVal.className = `delta-number ${diffPct >= 0 ? "positive" : "negative"}`;
    }

    // Relative bar widths (max benchmark ~6000 kg/ha)
    const maxScale = Math.max(predYield, histYield, 5000) * 1.15;
    if (simCurrentBar) simCurrentBar.style.width = `${Math.min(100, (predYield / maxScale) * 100)}%`;
    if (simHistoricalBar) simHistoricalBar.style.width = `${Math.min(100, (histYield / maxScale) * 100)}%`;

    if (simRainVal && rain !== undefined) simRainVal.textContent = `${Math.round(rain)} mm`;
    if (simTempVal && temp !== undefined) simTempVal.textContent = `${temp.toFixed(1)} °C`;
    if (simIrrigationVal && irrig !== undefined) simIrrigationVal.textContent = `${Math.round(irrig)}%`;
    if (simSoilVal && soil) simSoilVal.textContent = soil;

    if (simExplainerText) {
      if (diffKg >= 0) {
        simExplainerText.textContent = `Predicted scenario yield is ${Math.abs(diffPct).toFixed(1)}% above the 10-year historical baseline, reflecting optimal moisture and management support.`;
      } else {
        simExplainerText.textContent = `Predicted scenario yield is ${Math.abs(diffPct).toFixed(1)}% below historical average due to agro-climatic stress (reduced moisture or temperature variance).`;
      }
    }
  }

  // Interactive Scenario Buttons on Page 3
  async function runSimulationScenario(scenarioKey) {
    const baseDistrict = districtSelect ? districtSelect.value : "Thanjavur";
    const baseCrop = simScene3D?.currentCrop || (cropSelect ? cropSelect.value : "Rice (Paddy)");
    const baseSeason = seasonSelect ? seasonSelect.value : "Samba";
    const baseSoil = soilSelect ? soilSelect.value : "Alluvial";
    let rain = rainfallInput ? parseFloat(rainfallInput.value) : 680;
    let temp = tempInput ? parseFloat(tempInput.value) : 27.5;
    let irrig = irrigationInput ? parseFloat(irrigationInput.value) : 85;
    const fert = fertilizerInput ? parseFloat(fertilizerInput.value) : 135;

    // Apply scenario variations
    if (scenarioKey === "high-rain") {
      rain = Math.round(rain * 1.3);
    } else if (scenarioKey === "low-rain") {
      rain = Math.round(rain * 0.7);
    } else if (scenarioKey === "high-temp") {
      temp = parseFloat((temp + 2.0).toFixed(1));
    } else if (scenarioKey === "high-irrig") {
      irrig = Math.min(100, Math.round(irrig + 20));
    } else if (scenarioKey === "low-irrig") {
      irrig = Math.max(10, Math.round(irrig - 25));
    } else if (scenarioKey === "historical") {
      // Historical baseline match
      const histYield = latestPredictionData?.historical_context?.historical_avg_yield_kg_ha ?? 3870.0;
      updateSimulationUI(histYield, histYield, 0, 0, baseCrop, rain, temp, irrig, baseSoil);
      if (simScene3D) {
        simScene3D.updateScenarioData({
          currentYield: histYield,
          historicalYield: histYield,
          crop: baseCrop,
          scenario: "historical"
        });
      }
      return;
    }

    try {
      const payload = {
        district: baseDistrict,
        crop: baseCrop,
        season: baseSeason,
        soil_type: baseSoil,
        rainfall_mm: rain,
        temperature_c: temp,
        irrigation_pct: irrig,
        fertilizer_kg_per_ha: fert
      };

      const res = await fetch(`${API_BASE}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await safeJson(res);

      if (res.ok && data.success) {
        const predYield = data.prediction.yield_kg_per_ha;
        const histYield = data.historical_context.historical_avg_yield_kg_ha;
        const diffKg = data.historical_context.difference_kg_ha;
        const diffPct = data.historical_context.difference_percentage;

        updateSimulationUI(predYield, histYield, diffKg, diffPct, baseCrop, rain, temp, irrig, baseSoil);

        if (simScene3D) {
          simScene3D.updateScenarioData({
            currentYield: predYield,
            historicalYield: histYield,
            crop: baseCrop,
            scenario: scenarioKey
          });
        }
      }
    } catch (err) {
      console.warn("Could not calculate live scenario prediction:", err);
    }
  }

  // Multi-Crop Comparison Buttons on Page 3
  async function selectSimulationCrop(cropName) {
    const baseDistrict = districtSelect ? districtSelect.value : "Thanjavur";
    const baseSeason = seasonSelect ? seasonSelect.value : "Samba";
    const baseSoil = soilSelect ? soilSelect.value : "Alluvial";
    const rain = rainfallInput ? parseFloat(rainfallInput.value) : 680;
    const temp = tempInput ? parseFloat(tempInput.value) : 27.5;
    const irrig = irrigationInput ? parseFloat(irrigationInput.value) : 85;
    const fert = fertilizerInput ? parseFloat(fertilizerInput.value) : 135;

    // Update active crop button state
    document.querySelectorAll(".crop-plot-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.crop === cropName);
    });

    const simContextText = document.getElementById("simContextText");
    if (simContextText) {
      simContextText.textContent = `${baseDistrict} • ${cropName} • ${baseSeason} Season`;
    }

    try {
      const payload = {
        district: baseDistrict,
        crop: cropName,
        season: baseSeason,
        soil_type: baseSoil,
        rainfall_mm: rain,
        temperature_c: temp,
        irrigation_pct: irrig,
        fertilizer_kg_per_ha: fert
      };

      const res = await fetch(`${API_BASE}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await safeJson(res);

      if (res.ok && data.success) {
        const predYield = data.prediction.yield_kg_per_ha;
        const histYield = data.historical_context.historical_avg_yield_kg_ha;
        const diffKg = data.historical_context.difference_kg_ha;
        const diffPct = data.historical_context.difference_percentage;

        updateSimulationUI(predYield, histYield, diffKg, diffPct, cropName, rain, temp, irrig, baseSoil);

        if (simScene3D) {
          simScene3D.updateScenarioData({
            currentYield: predYield,
            historicalYield: histYield,
            crop: cropName,
            scenario: "current"
          });
        }
      }
    } catch (err) {
      console.warn("Could not calculate crop comparison prediction:", err);
    }
  }

  // Event Listeners for Navigation
  exploreCtaBtn?.addEventListener("click", () => showDashboard(true));
  navExploreBtn?.addEventListener("click", () => showDashboard(true));
  returnLandingBtn?.addEventListener("click", () => showLanding(true));

  openSimulationBtn?.addEventListener("click", () => showSimulation(true));
  tabLaunchSimBtn?.addEventListener("click", () => showSimulation(true));
  backToDashboardBtn?.addEventListener("click", () => showDashboard(true));

  // Scenario Buttons
  document.querySelectorAll(".scenario-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".scenario-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const scenario = btn.dataset.scenario;
      runSimulationScenario(scenario);
    });
  });

  // Multi-crop buttons
  document.querySelectorAll(".crop-plot-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const crop = btn.dataset.crop;
      selectSimulationCrop(crop);
    });
  });

  // View toggle buttons (Side-by-side / Current / Historical)
  document.querySelectorAll(".sim-view-toggle .view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sim-view-toggle .view-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.dataset.view;
      if (simScene3D) {
        simScene3D.setViewMode(mode);
      }
    });
  });

  previewInspectBtn?.addEventListener("click", () => {
    applyPreset("presetCoimbatoreMaize");
    showDashboard(true);
  });

  // Story Sequence Pointers
  storyStepBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.dataset.step, 10);
      storyStepBtns.forEach(b => b.classList.toggle("active", b.dataset.step === String(step)));

      if (!scene3D) return;
      if (step === 1) {
        scene3D.targetCameraY = 1.45;
        scene3D.targetCameraZ = 8.5;
        scene3D.targetCameraX = 0;
      } else if (step === 2) {
        scene3D.targetCameraY = 1.7;
        scene3D.targetCameraZ = 7.5;
        scene3D.targetCameraX = -1.0;
      } else if (step === 3) {
        scene3D.targetCameraY = 1.6;
        scene3D.targetCameraZ = 5.5;
        scene3D.targetCameraX = 0;
      } else if (step === 4) {
        scene3D.targetCameraY = 1.4;
        scene3D.targetCameraZ = 6.5;
        scene3D.targetCameraX = 0.8;
      } else if (step === 5) {
        scene3D.targetCameraY = 2.2;
        scene3D.targetCameraZ = 9.0;
        scene3D.targetCameraX = -0.5;
      }
    });
  });

  mapNodes.forEach(node => {
    node.style.cursor = "pointer";
    node.addEventListener("click", () => {
      const district = node.dataset.district;
      if (district && districtSelect) {
        districtSelect.value = district;
        triggerPrediction();
      }
      showDashboard(true);
    });
  });

  // Browser Navigation History Popstate
  window.addEventListener("popstate", () => {
    const route = getCurrentRoute();
    if (route === "simulation") {
      showSimulation(false);
    } else if (route === "dashboard") {
      showDashboard(false);
    } else {
      showLanding(false);
    }
  });

  // Initial Route Check & Stage Setup
  const initialRoute = getCurrentRoute();
  if (initialRoute === "simulation") {
    showSimulation(false);
  } else if (initialRoute === "dashboard") {
    showDashboard(false);
  } else {
    showLanding(false);
  }

  // Initial load
  loadMetadata();
  triggerPrediction();
  renderSuggestions();
});

