const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

mongoose.connect('mongodb://127.0.0.1:27017/solar_telemetry')
  .then(() => console.log('Connected to MongoDB for export...'))
  .catch(err => console.error('Connection error:', err));

const Telemetry = mongoose.model('Telemetry', new mongoose.Schema({
  timestamp: Date,
  irradiance_wm2: Number,
  panel_temp_c: Number,
  power_w: Number
}));

async function exportCSV() {
  // 1. Fetch only daylight records (irradiance > 0)
  const rows = await Telemetry.find({ irradiance_wm2: { $gt: 0 } }).sort({ timestamp: 1 });

  if (!rows.length) {
    console.log('No daylight records found in database. Make sure seed.js has run.');
    process.exit();
  }

  // 2. Compute min and max values for scaling
  const minIrr = Math.min(...rows.map(r => r.irradiance_wm2));
  const maxIrr = Math.max(...rows.map(r => r.irradiance_wm2));

  const minTemp = Math.min(...rows.map(r => r.panel_temp_c));
  const maxTemp = Math.max(...rows.map(r => r.panel_temp_c));

  const minPwr = Math.min(...rows.map(r => r.power_w));
  const maxPwr = Math.max(...rows.map(r => r.power_w));

  // 3. Build CSV header and scale values between 0 and 1
  let csvContent = 'timestamp,irradiance_wm2_scaled,panel_temp_c_scaled,power_w_scaled\n';

  rows.forEach(r => {
    const irrScaled = ((r.irradiance_wm2 - minIrr) / (maxIrr - minIrr || 1)).toFixed(6);
    const tempScaled = ((r.panel_temp_c - minTemp) / (maxTemp - minTemp || 1)).toFixed(6);
    const pwrScaled = ((r.power_w - minPwr) / (maxPwr - minPwr || 1)).toFixed(6);
    csvContent += `${r.timestamp.toISOString()},${irrScaled},${tempScaled},${pwrScaled}\n`;
  });

  // 4. Save to the main project root folder
  const outputPath = path.join(__dirname, '..', 'clean_lstm_training_data.csv');
  fs.writeFileSync(outputPath, csvContent);

  console.log(`Success! Exported ${rows.length} scaled daylight rows to clean_lstm_training_data.csv`);
  process.exit();
}

exportCSV();