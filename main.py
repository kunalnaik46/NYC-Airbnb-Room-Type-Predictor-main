import os
from pathlib import Path
from typing import List, Dict, Any
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pandas as pd
import joblib

app = FastAPI(
    title="NYC Airbnb Room Type Predictor",
    description="Machine Learning prediction API for classifying NYC Airbnb listings into room types.",
    version="2.0.0"
)

# Enable CORS for frontend flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "Model_Pipeline.pkl"

COLUMNS = [
    "latitude", "longitude", "price", "minimum_nights",
    "number_of_reviews", "reviews_per_month",
    "calculated_host_listings_count", "availability_365",
    "neighbourhood_group", "neighbourhood",
]

# Load pre-trained model pipeline
if MODEL_PATH.exists():
    model = joblib.load(MODEL_PATH)
else:
    model = None

# Input validation schema
class Features(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude coordinate")
    price: float = Field(..., gt=0, description="Price per night in USD, must be positive")
    minimum_nights: int = Field(..., ge=1, le=365, description="Minimum nights required for booking")
    number_of_reviews: int = Field(..., ge=0, description="Total number of reviews")
    reviews_per_month: float = Field(..., ge=0, description="Average reviews per month")
    calculated_host_listings_count: int = Field(..., ge=0, description="Number of listings by this host")
    availability_365: int = Field(..., ge=0, le=365, description="Days available out of 365")
    neighbourhood_group: str = Field(..., min_length=1, description="Borough name (e.g. Manhattan, Brooklyn)")
    neighbourhood: str = Field(..., min_length=1, description="Specific neighbourhood name")

    class Config:
        json_schema_extra = {
            "example": {
                "latitude": 40.7484,
                "longitude": -73.9857,
                "price": 180.0,
                "minimum_nights": 2,
                "number_of_reviews": 45,
                "reviews_per_month": 1.85,
                "calculated_host_listings_count": 1,
                "availability_365": 210,
                "neighbourhood_group": "Manhattan",
                "neighbourhood": "Midtown"
            }
        }


# Mount assets if directory exists
assets_dir = BASE_DIR / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    """
    Serves the redesigned index.html if accessed via browser,
    or returns API health info if JSON is requested.
    """
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        index_file = BASE_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
    return JSONResponse({
        "status": "online",
        "service": "NYC Airbnb Room Type Predictor API",
        "version": "2.0.0",
        "endpoints": {
            "predict": "/predict",
            "health": "/api/health",
            "examples": "/api/examples",
            "docs": "/docs"
        }
    })


@app.get("/style.css")
async def get_css():
    css_file = BASE_DIR / "style.css"
    if css_file.exists():
        return FileResponse(css_file, media_type="text/css")
    return HTMLResponse("", status_code=404)


@app.get("/script.js")
@app.get("/scripts.js")
async def get_js():
    js_file = BASE_DIR / "script.js"
    if not js_file.exists():
        js_file = BASE_DIR / "scripts.js"
    if js_file.exists():
        return FileResponse(js_file, media_type="application/javascript")
    return HTMLResponse("", status_code=404)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "classes": model.classes_.tolist() if model is not None and hasattr(model, "classes_") else []
    }


@app.get("/api/examples")
def get_examples():
    return [
        {
            "title": "Midtown Luxury Skyline Suite",
            "tag": "Entire Home",
            "data": {
                "latitude": 40.7549, "longitude": -73.9840, "price": 285.0, "minimum_nights": 3,
                "number_of_reviews": 72, "reviews_per_month": 2.4, "calculated_host_listings_count": 2,
                "availability_365": 240, "neighbourhood_group": "Manhattan", "neighbourhood": "Midtown"
            }
        },
        {
            "title": "Williamsburg Bohemian Brownstone",
            "tag": "Private Room",
            "data": {
                "latitude": 40.7144, "longitude": -73.9553, "price": 85.0, "minimum_nights": 2,
                "number_of_reviews": 140, "reviews_per_month": 3.8, "calculated_host_listings_count": 1,
                "availability_365": 160, "neighbourhood_group": "Brooklyn", "neighbourhood": "Williamsburg"
            }
        },
        {
            "title": "Astoria Backpacker Co-Living",
            "tag": "Shared Room",
            "data": {
                "latitude": 40.7644, "longitude": -73.9235, "price": 38.0, "minimum_nights": 1,
                "number_of_reviews": 18, "reviews_per_month": 0.9, "calculated_host_listings_count": 4,
                "availability_365": 320, "neighbourhood_group": "Queens", "neighbourhood": "Astoria"
            }
        },
        {
            "title": "Staten Island Peaceful Haven",
            "tag": "Entire Home",
            "data": {
                "latitude": 40.6425, "longitude": -74.0760, "price": 140.0, "minimum_nights": 2,
                "number_of_reviews": 54, "reviews_per_month": 1.5, "calculated_host_listings_count": 1,
                "availability_365": 190, "neighbourhood_group": "Staten Island", "neighbourhood": "St. George"
            }
        }
    ]


@app.post("/predict")
def predict(features: Features):
    if model is None:
        return JSONResponse(status_code=500, content={"error": "Model pipeline not loaded"})

    # Convert Pydantic object to dictionary cleanly (supports Pydantic v1 & v2)
    data_dict = features.model_dump() if hasattr(features, "model_dump") else features.dict()
    row = pd.DataFrame([data_dict], columns=COLUMNS)

    prediction = model.predict(row)[0]
    probabilities = model.predict_proba(row)[0]

    classes = model.classes_.tolist() if hasattr(model, "classes_") else ["Entire home/apt", "Private room", "Shared room"]
    prob_dict = {cls: float(prob) for cls, prob in zip(classes, probabilities)}

    top_prob = prob_dict.get(prediction, float(max(probabilities)))

    # Ranked classes
    ranked = sorted(
        [{"room_type": cls, "probability": float(prob), "percentage": f"{round(prob * 100, 1)}%"}
         for cls, prob in prob_dict.items()],
        key=lambda x: x["probability"],
        reverse=True
    )

    # Contextual insight
    price = data_dict["price"]
    if price >= 200:
        price_tier = "Premium / Luxury"
    elif price >= 90:
        price_tier = "Mid-range"
    else:
        price_tier = "Budget"

    return {
        "status": "success",
        "predicted_room_type": prediction,
        "confidence": round(top_prob, 4),
        "confidence_percentage": f"{round(top_prob * 100, 1)}%",
        "probabilities": prob_dict,
        "ranked_predictions": ranked,
        "listing_summary": {
            "price_tier": price_tier,
            "borough": data_dict["neighbourhood_group"],
            "neighbourhood": data_dict["neighbourhood"]
        },
        # Backwards compatibility fields for existing frontend expectations
        "Predicted_room_type": prediction,
        "Probability": probabilities.tolist()
    }