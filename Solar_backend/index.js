const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Connect directly to MongoDB Atlas & Start 24/7 Cloud Telemetry Worker
mongoose.connect('mongodb+srv://mohammedfaizck454_db_user:faizatlas454@cluster0.xndcgpi.mongodb.net/solar_telemetry')
  .then(() => {
    console.log('Connected to MongoDB Atlas');
    startCloudTelemetryStream();
  })
  .catch(err => console.error('MongoDB Connection Error:', err));

// 2. Define Telemetry Schema & Model
const telemetrySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  irradiance_wm2: Number,
  panel_temp_c: Number,
  power_w: Number
});

const Telemetry = mongoose.model('Telemetry', telemetrySchema);

// Background Telemetry Generator (Runs 24/7 on Render)
// Background Telemetry Generator (Runs 24/7 on Render)
const startCloudTelemetryStream = () => {
  let cachedAmbientTemp = 28.0;

  setInterval(async () => {
    try {
      // Attempt to fetch live outdoor temp from Open-Meteo
      const weatherRes = await axios.get('https://api.open-meteo.com/v1/forecast?latitude=12.88&longitude=77.70&current=temperature_2m', { timeout: 5000 });
      if (weatherRes.data?.current?.temperature_2m) {
        cachedAmbientTemp = weatherRes.data.current.temperature_2m;
      }
    } catch (err) {
      // If rate limited (429) or offline, silently fall back to cached/default temp
      console.log('Weather API rate limit or error, using cached temp:', cachedAmbientTemp);
    }

    try {
      const panelTemp = parseFloat((cachedAmbientTemp + (Math.random() * 3 + 2)).toFixed(2));
      const irradiance = parseFloat((Math.random() * 500 + 400).toFixed(2));
      const powerW = parseFloat(((irradiance * 0.25) * (1 - (panelTemp - 25) * 0.004)).toFixed(2));

      await Telemetry.create({
        timestamp: new Date(),
        irradiance_wm2: irradiance,
        panel_temp_c: panelTemp,
        power_w: Math.max(0.0, powerW)
      });

      console.log(`Cloud Telemetry Inserted -> Ambient: ${cachedAmbientTemp}°C | Power: ${powerW}W`);
    } catch (err) {
      console.error('Cloud telemetry background error:', err);
    }
  }, 5000); // Runs every 5 seconds in the cloud
};

// Keep-alive route to prevent Render free tier from sleeping (Use with UptimeRobot)
app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'active', timestamp: new Date() });
});

// 3. API: Fetch Recent Telemetry Logs for Graph
app.get('/api/telemetry/recent', async (req, res) => {
  try {
    const data = await Telemetry.find().sort({ _id: -1 }).limit(30);
    res.json(data.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch telemetry data' });
  }
});

// 4. API: Execute LSTM Prediction using Python Child Process
app.get('/api/telemetry/predict', async (req, res) => {
  try {
    // Retrieve the latest 60 records from MongoDB for LSTM time-series window
    const recentData = await Telemetry.find().sort({ _id: -1 }).limit(60);
    
    if (recentData.length === 0) {
      return res.json({ predicted_power: 0.0 });
    }

    // Format telemetry as 2D array: [[irradiance, temp, power], ...]
    let formattedData = recentData.reverse().map(d => [
      d.irradiance_wm2 || 0,
      d.panel_temp_c || 0,
      d.power_w || 0
    ]);

    // Pad array to 60 elements if MongoDB has fewer than 60 entries yet
    while (formattedData.length < 60) {
      formattedData.unshift(formattedData[0] || [500.0, 25.0, 100.0]);
    }

    // Convert input sequence to JSON string to pass as argument to Python
    const inputArg = JSON.stringify(formattedData);

    // Spawn predict.py process
    const pythonPath = path.join(__dirname, 'predict.py');
    const pythonProcess = spawn('python', [pythonPath, inputArg]);

    let resultString = '';

    pythonProcess.stdout.on('data', (data) => {
      resultString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python script error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      try {
        const parsedResult = JSON.parse(resultString.trim());
        res.json(parsedResult);
      } catch (e) {
        // Fallback: estimate expected power if script output fails to parse
        const latestPower = formattedData[formattedData.length - 1][2];
        res.json({ predicted_power: parseFloat((latestPower * 0.98).toFixed(2)) });
      }
    });

  } catch (err) {
    console.error('Prediction endpoint error:', err);
    res.status(500).json({ error: 'Prediction server error' });
  }
});

// 5. API: Anomaly Simulator Injections
app.post('/api/telemetry/inject-anomaly', async (req, res) => {
  try {
    const { type } = req.body;
    let anomalyDoc = { timestamp: new Date() };

    if (type === 'cloud') {
      anomalyDoc.irradiance_wm2 = 120.0;
      anomalyDoc.panel_temp_c = 24.0;
      anomalyDoc.power_w = 28.5;
    } else if (type === 'overheat') {
      anomalyDoc.irradiance_wm2 = 880.0;
      anomalyDoc.panel_temp_c = 48.5; // >40°C triggers red Thermal Advisory
      anomalyDoc.power_w = 175.0;
    }

    const created = await Telemetry.create(anomalyDoc);
    res.json({ message: 'Anomaly injected successfully', data: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to inject anomaly' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;