import time
import random
import requests
from pymongo import MongoClient

# 1. Connect to MongoDB
client = MongoClient("mongodb+srv://mohammedfaizck454_db_user:faizatlas454@cluster0.xndcgpi.mongodb.net/solar_telemetry")
db = client["solar_telemetry"]
collection = db["telemetries"]

# 2. Location Coordinates (Set to Anekal / Bengaluru area)
LATITUDE = 12.88
LONGITUDE = 77.70

# Helper function to fetch real outdoor temperature from Open-Meteo API
def get_live_weather_temp():
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={LATITUDE}&longitude={LONGITUDE}&current=temperature_2m"
        response = requests.get(url, timeout=5)
        data = response.json()
        return float(data["current"]["temperature_2m"])
    except Exception as e:
        print("Weather API fallback, using default temp:", e)
        return 28.0  # Default fallback if internet drops

print("Starting Live Weather Telemetry Stream...")

while True:
    # Get live local outdoor temperature
    ambient_temp = get_live_weather_temp()

    # Solar panels heat up ~8°C to 14°C above outdoor air temperature in sunlight
    panel_temp = round(ambient_temp + random.uniform(2.0, 5.0), 2)

    # Generate solar irradiance and calculate power output
    irradiance = round(random.uniform(400.0, 900.0), 2)
    power_w = round((irradiance * 0.25) * (1 - (panel_temp - 25) * 0.004), 2)

    telemetry_doc = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "irradiance_wm2": irradiance,
        "panel_temp_c": panel_temp,
        "power_w": max(0.0, power_w)
    }

    # Save live data to MongoDB
    collection.insert_one(telemetry_doc)
    print(f"Inserted -> Ambient: {ambient_temp}°C | Panel Temp: {panel_temp}°C | Power: {power_w}W")

    # Wait 5 seconds before next reading
    time.sleep(5)