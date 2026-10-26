const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://mohammedfaizck454_db_user:faizatlas454@cluster0.xndcgpi.mongodb.net/solar_telemetry')
  .then(() => console.log('Connected to MongoDB for 12-hour seeding...'))
  .catch(err => console.error('Connection error:', err));

const Telemetry = mongoose.model('Telemetry', new mongoose.Schema({
  timestamp: Date,
  irradiance_wm2: Number,
  panel_temp_c: Number,
  bus_voltage_v: Number,
  current_a: Number,
  power_w: Number
}));

async function seed12HourData() {
  await Telemetry.deleteMany({});
  const records = [];
  
  // Set window start to 6:00 AM today
  const startTime = new Date();
  startTime.setHours(6, 0, 0, 0);

  // Generate 12 hours of data in 15-minute intervals (48 total time points)
  const totalIntervals = 48; 
  
  for (let i = 0; i < totalIntervals; i++) {
    const timestamp = new Date(startTime.getTime() + i * 15 * 60000);
    
    // Smooth bell curve for 12 hours daylight (peaks at 12:00 PM)
    const normalizedTime = i / (totalIntervals - 1); // 0 to 1
    const solarCurve = Math.sin(normalizedTime * Math.PI); // Sine wave shape
    
    // Add small cloud cover fluctuations
    const cloudNoise = 0.85 + Math.random() * 0.3;
    const irradiance = parseFloat(Math.max(0, solarCurve * 1000 * cloudNoise).toFixed(2));
    
    // Thermal calculation based on solar intensity
    const panelTemp = parseFloat((25 + (irradiance * 0.022) + (Math.random() * 1.5)).toFixed(2));
    const tempDerate = 1 - 0.0045 * Math.max(0, panelTemp - 25);
    const power = parseFloat(((300 * (irradiance / 1000.0)) * tempDerate).toFixed(2));
    const voltage = parseFloat((12.0 + (Math.random() * 0.4 - 0.2)).toFixed(2));
    const current = parseFloat((power / voltage).toFixed(3));

    records.push({
      timestamp,
      irradiance_wm2: irradiance,
      panel_temp_c: panelTemp,
      bus_voltage_v: voltage,
      current_a: current,
      power_w: power
    });
  }

  await Telemetry.insertMany(records);
  console.log('Successfully seeded a complete 12-Hour Solar Generation Stream!');
  mongoose.connection.close();
}

seed12HourData();