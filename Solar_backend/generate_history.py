import mysql.connector
import random
from datetime import datetime, timedelta

db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="Inferno@23",  # Your MySQL password
    database="solar_grid_project"
)
cursor = db.cursor()

print("Generating 30 days of historical data. Please wait...")

# Start date: 30 days ago from today
start_time = datetime.now() - timedelta(days=30)
insert_query = "INSERT INTO live_telemetry (recorded_at, irradiance_wm2, panel_temp_c, actual_power_kw) VALUES (%s, %s, %s, %s)"
data_batch = []

for i in range(43200): # 30 days * 24 hours * 60 minutes
    current_time = start_time + timedelta(minutes=i)
    hour = current_time.hour
    
    if hour < 6 or hour > 18:
        irradiance, temp, power = 0.0, random.uniform(15.0, 20.0), 0.0
    else:
        # Create a realistic bell curve of sunlight peaking at noon
        solar_multiplier = 1 - abs((hour - 12) / 6) 
        irradiance = max(0, random.uniform(600, 1000) * solar_multiplier)
        temp = random.uniform(25.0, 45.0)
        power = (irradiance * 0.15) / 1000
        
    data_batch.append((current_time, irradiance, temp, power))
    
    # Commit in batches of 5000 for speed
    if len(data_batch) == 5000:
        cursor.executemany(insert_query, data_batch)
        db.commit()
        data_batch = []

# Commit any remaining rows
if data_batch:
    cursor.executemany(insert_query, data_batch)
    db.commit()

print("Successfully inserted 30 days of historical data for LSTM training!")