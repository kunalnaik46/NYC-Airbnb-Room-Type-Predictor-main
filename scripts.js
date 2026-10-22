/**
 * NYC AIRBNB ROOM TYPE PREDICTOR · INTERACTIVE APPLICATION LOGIC
 * Supports both local FastAPI backend and Render cloud deployment
 */

// ==========================================================================
// CONFIGURATION & STATE
// ==========================================================================
const DEFAULT_CLOUD_API = "https://nyc-airbnb-room-type-predictor.onrender.com";
let currentApiBase = determineInitialApiBase();

const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// NYC Boroughs Coordinates & Prominent Neighborhoods
const BOROUGH_DATA = {
  "Manhattan": {
    lat: 40.7549, lng: -73.9840,
    neighborhoods: [
      "Midtown", "Hell's Kitchen", "Harlem", "Chelsea", "East Village",
      "Upper West Side", "Upper East Side", "West Village", "Financial District",
      "East Harlem", "Lower East Side", "SoHo", "Washington Heights", "Chinatown",
      "Gramercy", "Morningside Heights", "Greenwich Village", "Inwood", "Tribeca",
      "Kips Bay", "Nolita", "NoHo", "Flatiron District", "Battery Park City",
      "Roosevelt Island", "Civic Center", "Stuyvesant Town", "Two Bridges"
    ]
  },
  "Brooklyn": {
    lat: 40.6782, lng: -73.9442,
    neighborhoods: [
      "Williamsburg", "Bedford-Stuyvesant", "Bushwick", "Crown Heights",
      "Greenpoint", "Flatbush", "Clinton Hill", "Prospect-Lefferts Gardens",
      "Park Slope", "Fort Greene", "Sunset Park", "East New York", "South Slope",
      "DUMBO", "Prospect Heights", "Boerum Hill", "Carroll Gardens", "Cobble Hill",
      "Gowanus", "Brooklyn Heights", "Bay Ridge", "Red Hook", "Windsor Terrace"
    ]
  },
  "Queens": {
    lat: 40.7282, lng: -73.7949,
    neighborhoods: [
      "Astoria", "Long Island City", "Ridgewood", "Sunnyside", "Flushing",
      "Ditmars Steinway", "Woodside", "Jackson Heights", "Elmhurst", "Forest Hills",
      "Maspeth", "Kew Gardens", "Rego Park", "Rockaway Beach", "Bayside"
    ]
  },
  "Bronx": {
    lat: 40.8448, lng: -73.8648,
    neighborhoods: [
      "Mott Haven", "Concourse", "Fordham", "Kingsbridge", "Belmont",
      "Riverdale", "Highbridge", "Morrisania", "Pelham Bay", "West Farms"
    ]
  },
  "Staten Island": {
    lat: 40.5795, lng: -74.1502,
    neighborhoods: [
      "St. George", "Tompkinsville", "Stapleton", "Clifton", "New Dorp",
      "Great Kills", "Tottenville", "West Brighton", "Castleton Corners"
    ]
  }
};

// Curated Showcase Presets
const PRESETS = {
  manhattan: {
    latitude: 40.7549, longitude: -73.9840, price: 285, minimum_nights: 3,
    number_of_reviews: 72, reviews_per_month: 2.40, calculated_host_listings_count: 1,
    availability_365: 240, neighbourhood_group: "Manhattan", neighbourhood: "Midtown"
  },
  brooklyn: {
    latitude: 40.7144, longitude: -73.9553, price: 85, minimum_nights: 2,
    number_of_reviews: 140, reviews_per_month: 3.80, calculated_host_listings_count: 1,
    availability_365: 160, neighbourhood_group: "Brooklyn", neighbourhood: "Williamsburg"
  },
  queens: {
    latitude: 40.7644, longitude: -73.9235, price: 38, minimum_nights: 1,
    number_of_reviews: 18, reviews_per_month: 0.90, calculated_host_listings_count: 4,
    availability_365: 320, neighbourhood_group: "Queens", neighbourhood: "Astoria"
  }
};

const ROOM_META = {
  "Entire home/apt": {
    label: "Entire home/apt",
    desc: "Full private residential unit with exclusive guest access, kitchen, and dedicated entryway.",
    color: "amber",
    fillClass: "fill-home",
    dotClass: "dot-home"
  },
  "Private room": {
    label: "Private room",
    desc: "Dedicated personal bedroom within a shared property. Common areas (living, bath) may be shared.",
    color: "cyan",
    fillClass: "fill-private",
    dotClass: "dot-private"
  },
  "Shared room": {
    label: "Shared room",
    desc: "Shared sleeping quarters with communal hostel, co-living, or partitioned arrangements.",
    color: "purple",
    fillClass: "fill-shared",
    dotClass: "dot-shared"
  }
};

let currentPredictionData = null;

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const form = document.getElementById("predictionForm");
const submitBtn = document.getElementById("predictSubmitBtn");
const formErrorAlert = document.getElementById("formErrorAlert");
const formErrorMessage = document.getElementById("formErrorMessage");
const resetBtn = document.getElementById("resetBtn");

const priceInput = document.getElementById("price");
const priceTierPill = document.getElementById("priceTierPill");
const availabilityInput = document.getElementById("availability_365");
const availabilityReadout = document.getElementById("availabilityReadout");
const hostCountInput = document.getElementById("calculated_host_listings_count");
const hostTypeBadge = document.getElementById("hostTypeBadge");

const boroughTabs = document.getElementById("boroughTabs");
const boroughHidden = document.getElementById("neighbourhood_group");
const neighborhoodInput = document.getElementById("neighbourhood");
const neighborhoodList = document.getElementById("neighborhoodList");
const latInput = document.getElementById("latitude");
const lngInput = document.getElementById("longitude");

const apiStatusBadge = document.getElementById("apiStatusBadge");
const apiStatusText = document.getElementById("apiStatusText");
const apiConfigBtn = document.getElementById("apiConfigBtn");

const apiModal = document.getElementById("apiModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const saveApiBtn = document.getElementById("saveApiBtn");
const customUrlField = document.getElementById("customUrlField");
const customApiUrlInput = document.getElementById("customApiUrl");

const resultPlaceholder = document.getElementById("resultPlaceholder");
const resultDisplay = document.getElementById("resultDisplay");
const predictedRoomTitle = document.getElementById("predictedRoomTitle");
const predictedRoomDesc = document.getElementById("predictedRoomDesc");
const confidencePill = document.getElementById("confidencePill");
const skylineBuildings = document.getElementById("skylineBuildings");
const probBarsList = document.getElementById("probBarsList");

const signalPrice = document.getElementById("signalPrice");
const signalAvailability = document.getElementById("signalAvailability");
const signalGeo = document.getElementById("signalGeo");
const signalHost = document.getElementById("signalHost");

const copyResultBtn = document.getElementById("copyResultBtn");
const jsonToggleBtn = document.getElementById("jsonToggleBtn");
const jsonDrawer = document.getElementById("jsonDrawer");
const jsonOutput = document.getElementById("jsonOutput");
const toast = document.getElementById("toast");

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initStars();
  setupEventListeners();
  populateNeighborhoods("Manhattan");
  applyPreset("manhattan");
  checkApiHealth();
});

function determineInitialApiBase() {
  const saved = localStorage.getItem("nyc_airbnb_api_base");
  if (saved) return saved;

  const origin = window.location.origin;
  // If served from localhost / 127.0.0.1 via FastAPI, use current origin
  if (origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("8000")) {
    return origin;
  }
  return DEFAULT_CLOUD_API;
}

// Twinkling Twilight Stars
function initStars() {
  const container = document.getElementById("starsContainer");
  if (!container || REDUCE_MOTION) return;

  const starCount = 38;
  for (let i = 0; i < starCount; i++) {
    const star = document.createElement("div");
    star.className = "star-point";
    const size = Math.random() < 0.7 ? 2 : 3;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 55}vh`;
    star.style.animationDelay = `${Math.random() * 5}s`;
    star.style.animationDuration = `${3 + Math.random() * 4}s`;
    container.appendChild(star);
  }
}

// ==========================================================================
// EVENT LISTENERS & UI WIRING
// ==========================================================================
function setupEventListeners() {

  // Range Slider live feedback
  availabilityInput.addEventListener("input", (e) => {
    availabilityReadout.textContent = `${e.target.value} days / yr`;
  });

  // Price live tier pill
  priceInput.addEventListener("input", updatePriceTier);

  // Host portfolio badge
  hostCountInput.addEventListener("input", updateHostBadge);

  // Borough Tab Switcher
  boroughTabs.querySelectorAll(".borough-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const borough = tab.dataset.borough;
      selectBorough(borough);
    });
  });

  // Preset Chips
  document.getElementById("presetChips").querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const presetKey = chip.dataset.preset;
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");

      if (presetKey === "random") {
        generateRandomPreset();
      } else if (PRESETS[presetKey]) {
        applyPreset(presetKey);
      }
    });
  });

  // Form Submit
  form.addEventListener("submit", handleFormSubmit);

  // Reset Button
  resetBtn.addEventListener("click", () => {
    form.reset();
    selectBorough("Manhattan");
    applyPreset("manhattan");
    hideError();
    showToast("Form reset to default preset");
  });

  // API Modal Dialog
  apiConfigBtn.addEventListener("click", openApiModal);
  closeModalBtn.addEventListener("click", closeApiModal);
  cancelModalBtn.addEventListener("click", closeApiModal);
  saveApiBtn.addEventListener("click", saveApiSettings);

  document.querySelectorAll("input[name='apiChoice']").forEach(radio => {
    radio.addEventListener("change", (e) => {
      customUrlField.style.display = e.target.value === "custom" ? "block" : "none";
    });
  });

  // Copy Result Summary
  copyResultBtn.addEventListener("click", copyPredictionSummary);

  // Toggle JSON Drawer
  jsonToggleBtn.addEventListener("click", () => {
    jsonDrawer.hidden = !jsonDrawer.hidden;
    jsonToggleBtn.classList.toggle("active", !jsonDrawer.hidden);
  });
}

// ==========================================================================
// DYNAMIC BOROUGHS & NEIGHBORHOODS
// ==========================================================================
function selectBorough(boroughName) {
  boroughTabs.querySelectorAll(".borough-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.borough === boroughName);
  });
  boroughHidden.value = boroughName;

  const data = BOROUGH_DATA[boroughName];
  if (data) {
    latInput.value = data.lat;
    lngInput.value = data.lng;
    populateNeighborhoods(boroughName);
    neighborhoodInput.value = data.neighborhoods[0] || "";
  }
}

function populateNeighborhoods(boroughName) {
  const data = BOROUGH_DATA[boroughName];
  neighborhoodList.innerHTML = "";
  if (!data) return;

  data.neighborhoods.forEach(hood => {
    const opt = document.createElement("option");
    opt.value = hood;
    neighborhoodList.appendChild(opt);
  });
}

function updatePriceTier() {
  const price = parseFloat(priceInput.value) || 0;
  if (price >= 250) {
    priceTierPill.textContent = "Luxury Tier ($250+)";
    priceTierPill.style.color = "var(--amber)";
  } else if (price >= 120) {
    priceTierPill.textContent = "Premium Tier ($120+)";
    priceTierPill.style.color = "var(--cyan)";
  } else if (price >= 65) {
    priceTierPill.textContent = "Mid-Range ($65+)";
    priceTierPill.style.color = "var(--text-muted)";
  } else {
    priceTierPill.textContent = "Budget Tier (<$65)";
    priceTierPill.style.color = "var(--purple)";
  }
}

function updateHostBadge() {
  const count = parseInt(hostCountInput.value, 10) || 1;
  if (count <= 1) {
    hostTypeBadge.textContent = "Individual Host (1 listing)";
    hostTypeBadge.style.color = "var(--emerald)";
  } else if (count <= 3) {
    hostTypeBadge.textContent = `Multi-unit Host (${count} listings)`;
    hostTypeBadge.style.color = "var(--cyan)";
  } else {
    hostTypeBadge.textContent = `Commercial Operator (${count} listings)`;
    hostTypeBadge.style.color = "var(--amber)";
  }
}

function applyPreset(presetKey) {
  const data = PRESETS[presetKey];
  if (!data) return;

  selectBorough(data.neighbourhood_group);
  neighborhoodInput.value = data.neighbourhood;
  latInput.value = data.latitude;
  lngInput.value = data.longitude;
  priceInput.value = data.price;
  document.getElementById("minimum_nights").value = data.minimum_nights;
  availabilityInput.value = data.availability_365;
  availabilityReadout.textContent = `${data.availability_365} days / yr`;
  document.getElementById("number_of_reviews").value = data.number_of_reviews;
  document.getElementById("reviews_per_month").value = data.reviews_per_month;
  hostCountInput.value = data.calculated_host_listings_count;

  updatePriceTier();
  updateHostBadge();
  hideError();
}

function generateRandomPreset() {
  const boroughs = Object.keys(BOROUGH_DATA);
  const randomBorough = boroughs[Math.floor(Math.random() * boroughs.length)];
  const bData = BOROUGH_DATA[randomBorough];
  const randomHood = bData.neighborhoods[Math.floor(Math.random() * bData.neighborhoods.length)];

  const randomPrice = Math.floor(Math.random() * 320) + 30;
  const randomMinNights = Math.floor(Math.random() * 5) + 1;
  const randomAvail = Math.floor(Math.random() * 365);
  const randomReviews = Math.floor(Math.random() * 180) + 2;
  const randomRevMonth = (Math.random() * 4 + 0.2).toFixed(2);
  const randomHostCount = Math.random() < 0.7 ? 1 : Math.floor(Math.random() * 6) + 2;

  // Small random jitter on coordinates
  const jitterLat = (Math.random() - 0.5) * 0.04;
  const jitterLng = (Math.random() - 0.5) * 0.04;

  selectBorough(randomBorough);
  neighborhoodInput.value = randomHood;
  latInput.value = (bData.lat + jitterLat).toFixed(4);
  lngInput.value = (bData.lng + jitterLng).toFixed(4);
  priceInput.value = randomPrice;
  document.getElementById("minimum_nights").value = randomMinNights;
  availabilityInput.value = randomAvail;
  availabilityReadout.textContent = `${randomAvail} days / yr`;
  document.getElementById("number_of_reviews").value = randomReviews;
  document.getElementById("reviews_per_month").value = randomRevMonth;
  hostCountInput.value = randomHostCount;

  updatePriceTier();
  updateHostBadge();
  hideError();
  showToast(`Randomized listing in ${randomHood}, ${randomBorough}`);
}

// ==========================================================================
// PREDICTION REQUEST & HANDLING
// ==========================================================================
async function handleFormSubmit(e) {
  e.preventDefault();
  hideError();

  if (!form.reportValidity()) return;

  const payload = collectPayload();
  setLoading(true);

  try {
    let result = null;
    let errorDetails = null;

    // Try current API base
    try {
      result = await requestPrediction(currentApiBase, payload);
    } catch (err) {
      errorDetails = err;

      // Smart fallback: if local failed, try cloud; if cloud failed, try local
      const fallbackUrl = currentApiBase === DEFAULT_CLOUD_API
        ? window.location.origin
        : DEFAULT_CLOUD_API;

      if (fallbackUrl && fallbackUrl !== currentApiBase) {
        console.warn(`Primary endpoint ${currentApiBase} failed. Trying fallback ${fallbackUrl}...`);
        try {
          result = await requestPrediction(fallbackUrl, payload);
          currentApiBase = fallbackUrl;
          updateApiBadge(true, "Connected (Fallback)");
        } catch {
          throw errorDetails;
        }
      } else {
        throw errorDetails;
      }
    }

    renderPredictionResult(result, payload);
    showToast("Prediction complete!");
  } catch (err) {
    showError(err.message || "Failed to communicate with prediction server.");
    updateApiBadge(false, "API Unreachable");
  } finally {
    setLoading(false);
  }
}

async function requestPrediction(baseUrl, payload) {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/predict`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const msg = errorBody?.detail ? JSON.stringify(errorBody.detail) : `HTTP ${response.status}`;
    throw new Error(`Inference request failed: ${msg}`);
  }

  return await response.json();
}

function collectPayload() {
  return {
    latitude: parseFloat(latInput.value),
    longitude: parseFloat(lngInput.value),
    price: parseFloat(priceInput.value),
    minimum_nights: parseInt(document.getElementById("minimum_nights").value, 10),
    number_of_reviews: parseInt(document.getElementById("number_of_reviews").value, 10),
    reviews_per_month: parseFloat(document.getElementById("reviews_per_month").value),
    calculated_host_listings_count: parseInt(hostCountInput.value, 10),
    availability_365: parseInt(availabilityInput.value, 10),
    neighbourhood_group: boroughHidden.value,
    neighbourhood: neighborhoodInput.value.trim()
  };
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("loading", isLoading);
}

// ==========================================================================
// RESULT VISUALIZATION RENDERING
// ==========================================================================
function renderPredictionResult(result, inputPayload) {
  currentPredictionData = { result, inputPayload };

  const predictedClass = result.predicted_room_type || result.Predicted_room_type;
  const probabilities = result.probabilities || parseProbabilityArray(result.Probability);

  // Hide placeholder, display results
  resultPlaceholder.hidden = true;
  resultDisplay.hidden = false;

  // Header Banner
  predictedRoomTitle.textContent = predictedClass;
  const meta = ROOM_META[predictedClass] || { desc: "Predicted NYC listing classification.", color: "amber" };
  predictedRoomDesc.textContent = meta.desc;

  const topProb = probabilities[predictedClass] || Math.max(...Object.values(probabilities));
  const confidencePercent = `${Math.round(topProb * 1000) / 10}%`;
  confidencePill.textContent = `${confidencePercent} Confidence`;

  // Render Architectural Towers
  renderSkylineTowers(probabilities, predictedClass);

  // Render Probability Bars
  renderProbabilityBars(probabilities, predictedClass);

  // Render Key Signal Drivers
  renderKeySignals(inputPayload, predictedClass);

  // Populate Raw JSON
  jsonOutput.textContent = JSON.stringify(result, null, 2);

  // Scroll smoothly on mobile
  if (window.innerWidth <= 1024) {
    resultDisplay.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function parseProbabilityArray(probArr) {
  // Scikit-learn alphabetical order: ['Entire home/apt', 'Private room', 'Shared room']
  const order = ["Entire home/apt", "Private room", "Shared room"];
  const out = {};
  if (Array.isArray(probArr)) {
    order.forEach((cls, idx) => {
      out[cls] = typeof probArr[idx] === "number" ? probArr[idx] : 0;
    });
  }
  return out;
}

// Draw the 3 Detailed Architectural Skyscraper Towers
function renderSkylineTowers(probabilities, predictedClass) {
  skylineBuildings.innerHTML = "";

  const classes = [
    { key: "Entire home/apt", rows: 7, cols: 2, maxHeight: 100, color: "lit-amber" },
    { key: "Private room", rows: 5, cols: 2, maxHeight: 75, color: "lit-cyan" },
    { key: "Shared room", rows: 3, cols: 2, maxHeight: 50, color: "lit-purple" }
  ];

  classes.forEach(item => {
    const prob = probabilities[item.key] || 0;
    const isTop = item.key === predictedClass;

    const group = document.createElement("div");
    group.className = `tower-group ${isTop ? "is-top" : ""}`;

    const tower = document.createElement("div");
    tower.className = `tower-structure ${isTop ? "is-top" : ""}`;
    tower.style.setProperty("--tower-height", "20%");

    const spire = document.createElement("div");
    spire.className = "tower-spire";
    tower.appendChild(spire);

    // Build Window Grid
    const totalWindows = item.rows * item.cols;
    const litCount = Math.round(totalWindows * prob);

    for (let i = 0; i < totalWindows; i++) {
      const win = document.createElement("div");
      win.className = "tower-window";
      tower.appendChild(win);
    }

    const caption = document.createElement("div");
    caption.className = "tower-caption";
    caption.textContent = item.key.split("/")[0]; // Clean short name

    group.appendChild(tower);
    group.appendChild(caption);
    skylineBuildings.appendChild(group);

    // Staggered Animation
    requestAnimationFrame(() => {
      setTimeout(() => {
        // Calculate realistic height based on probability
        const calculatedHeight = Math.max(22, Math.round(item.maxHeight * (prob + 0.15)));
        tower.style.setProperty("--tower-height", `${calculatedHeight}%`);

        const winElements = tower.querySelectorAll(".tower-window");
        winElements.forEach((w, index) => {
          if (index < litCount) {
            setTimeout(() => {
              w.classList.add(item.color);
            }, REDUCE_MOTION ? 0 : 80 * index + 250);
          }
        });
      }, REDUCE_MOTION ? 0 : 100);
    });
  });
}

function renderProbabilityBars(probabilities, predictedClass) {
  probBarsList.innerHTML = "";

  const sorted = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);

  sorted.forEach(([clsName, prob]) => {
    const isTop = clsName === predictedClass;
    const meta = ROOM_META[clsName] || { fillClass: "fill-home", dotClass: "dot-home" };
    const pct = Math.round(prob * 100);

    const item = document.createElement("div");
    item.className = `prob-item ${isTop ? "top" : ""}`;

    item.innerHTML = `
      <div class="prob-item-header">
        <span class="prob-item-name">
          <span class="chip-dot ${meta.dotClass}"></span>
          <span>${clsName}</span>
        </span>
        <span class="prob-item-pct" id="pct-${clsName.replace(/[\/\s]/g, '')}">0%</span>
      </div>
      <div class="prob-track">
        <div class="prob-fill ${meta.fillClass}" style="width: 0%"></div>
      </div>
    `;

    probBarsList.appendChild(item);

    const fillEl = item.querySelector(".prob-fill");
    const pctEl = item.querySelector(".prob-item-pct");

    requestAnimationFrame(() => {
      setTimeout(() => {
        fillEl.style.width = `${pct}%`;
        animatePercentage(pctEl, pct);
      }, REDUCE_MOTION ? 0 : 150);
    });
  });
}

function animatePercentage(el, target) {
  if (REDUCE_MOTION) {
    el.textContent = `${target}%`;
    return;
  }
  const duration = 600;
  const start = performance.now();
  function step(now) {
    const elapsed = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - elapsed, 3);
    el.textContent = `${Math.round(target * eased)}%`;
    if (elapsed < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderKeySignals(inputs, predictedClass) {
  // Price Driver
  if (inputs.price >= 200) {
    signalPrice.textContent = `$${inputs.price}/nt (High-end tier strongly indicates Entire Home)`;
  } else if (inputs.price >= 75) {
    signalPrice.textContent = `$${inputs.price}/nt (Typical NYC mid-range price)`;
  } else {
    signalPrice.textContent = `$${inputs.price}/nt (Budget pricing strongly aligns with Room shares)`;
  }

  // Availability Driver
  if (inputs.availability_365 >= 250) {
    signalAvailability.textContent = `${inputs.availability_365} days (High annual turnover)`;
  } else if (inputs.availability_365 >= 90) {
    signalAvailability.textContent = `${inputs.availability_365} days (Moderate seasonal listing)`;
  } else {
    signalAvailability.textContent = `${inputs.availability_365} days (Rare / Primary residence booking)`;
  }

  // Geo Driver
  signalGeo.textContent = `${inputs.neighbourhood}, ${inputs.neighbourhood_group}`;

  // Host Driver
  if (inputs.calculated_host_listings_count > 3) {
    signalHost.textContent = `${inputs.calculated_host_listings_count} listings (Multi-property manager)`;
  } else {
    signalHost.textContent = `${inputs.calculated_host_listings_count} listing (Independent single host)`;
  }
}

// ==========================================================================
// API CONNECTION & HEALTH
// ==========================================================================
async function checkApiHealth() {
  updateApiBadge(null, "Testing API...");

  const testEndpoints = [
    currentApiBase,
    window.location.origin,
    "http://127.0.0.1:8000",
    DEFAULT_CLOUD_API
  ];

  for (const url of testEndpoints) {
    try {
      const res = await fetch(`${url.replace(/\/+$/, '')}/api/health`, { method: "GET", signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        currentApiBase = url;
        updateApiBadge(true, url.includes("localhost") || url.includes("127.0.0.1") ? "Local Backend Active" : "Cloud API Active");
        return;
      }
    } catch {
      // Continue searching
    }
  }

  // Fallback check root
  try {
    const res = await fetch(`${currentApiBase}/`, { method: "GET", signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      updateApiBadge(true, "API Online");
      return;
    }
  } catch {
    updateApiBadge(false, "API Offline");
  }
}

function updateApiBadge(isOnline, text) {
  apiStatusBadge.classList.remove("online", "offline");
  if (isOnline === true) {
    apiStatusBadge.classList.add("online");
  } else if (isOnline === false) {
    apiStatusBadge.classList.add("offline");
  }
  apiStatusText.textContent = text;
}

// Modal Handlers
function openApiModal() {
  apiModal.hidden = false;
  const isCustom = currentApiBase !== DEFAULT_CLOUD_API && !currentApiBase.includes("localhost") && !currentApiBase.includes("127.0.0.1");

  if (isCustom) {
    document.querySelector("input[value='custom']").checked = true;
    customUrlField.style.display = "block";
    customApiUrlInput.value = currentApiBase;
  } else if (currentApiBase.includes("localhost") || currentApiBase.includes("127.0.0.1")) {
    document.querySelector("input[value='local']").checked = true;
    customUrlField.style.display = "none";
  } else {
    document.querySelector("input[value='cloud']").checked = true;
    customUrlField.style.display = "none";
  }
}

function closeApiModal() {
  apiModal.hidden = true;
}

function saveApiSettings() {
  const selected = document.querySelector("input[name='apiChoice']:checked").value;
  if (selected === "local") {
    currentApiBase = window.location.origin.includes("localhost") ? window.location.origin : "http://127.0.0.1:8000";
  } else if (selected === "cloud") {
    currentApiBase = DEFAULT_CLOUD_API;
  } else {
    const custom = customApiUrlInput.value.trim();
    if (!custom) {
      alert("Please enter a valid URL");
      return;
    }
    currentApiBase = custom;
  }

  localStorage.setItem("nyc_airbnb_api_base", currentApiBase);
  closeApiModal();
  showToast(`Connected to ${currentApiBase}`);
  checkApiHealth();
}

// ==========================================================================
// UTILITIES: COPY, TOAST, ERRORS
// ==========================================================================
function copyPredictionSummary() {
  if (!currentPredictionData) return;
  const { result, inputPayload } = currentPredictionData;

  const text = `NYC Airbnb Prediction:
• Room Type: ${result.predicted_room_type || result.Predicted_room_type}
• Confidence: ${result.confidence_percentage || 'N/A'}
• Location: ${inputPayload.neighbourhood}, ${inputPayload.neighbourhood_group}
• Nightly Price: $${inputPayload.price}
• Availability: ${inputPayload.availability_365} days/year
Generated by NYC Airbnb Room Type Classifier`;

  navigator.clipboard.writeText(text)
    .then(() => showToast("Prediction summary copied to clipboard!"))
    .catch(() => showToast("Copied text successfully"));
}

function showError(msg) {
  formErrorMessage.textContent = msg;
  formErrorAlert.hidden = false;
}

function hideError() {
  formErrorAlert.hidden = true;
  formErrorMessage.textContent = "";
}

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}
