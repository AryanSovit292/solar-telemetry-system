import sys
import json
import numpy as np
import tensorflow as tf

def main():
    # 1. Load the trained model
    try:
        model = tf.keras.models.load_model('solar_lstm_model.keras')
    except Exception as e:
        print(json.dumps({"predicted_power": 0.0, "error": f"Failed to load model: {str(e)}"}))
        sys.exit(1)

    # 2. Parse input telemetry data from arguments
    try:
        if len(sys.argv) > 1:
            raw_input = sys.argv[1]
            input_data = json.loads(raw_input)
        else:
            # Fallback mock input if no arguments passed (60 time steps, 3 features)
            input_data = [[500.0, 25.0, 100.0]] * 60

        input_array = np.array(input_data, dtype=np.float32)

        # Scale inputs (Irradiance/1000, Temp/100, Power/300) if model was trained on normalized features
        scaled_array = input_array.copy()
        if np.max(scaled_array[:, 0]) > 1.0:
            scaled_array[:, 0] = scaled_array[:, 0] / 1000.0  # Irradiance normalization
            scaled_array[:, 1] = scaled_array[:, 1] / 100.0   # Temp normalization
            scaled_array[:, 2] = scaled_array[:, 2] / 300.0   # Power normalization

        # Ensure correct shape: [samples, time_steps, features] -> (1, 60, 3)
        if scaled_array.ndim == 2:
            scaled_array = np.expand_dims(scaled_array, axis=0)

        # 3. Perform prediction
        prediction = model.predict(scaled_array, verbose=0)
        raw_val = float(prediction[0][0])

        # Convert normalized ML output back to real Watts if necessary
        predicted_power = raw_val * 300.0 if raw_val <= 1.5 else raw_val

        # Output JSON result for Node.js backend
        print(json.dumps({"predicted_power": round(max(0.0, predicted_power), 2)}))

    except Exception as e:
        print(json.dumps({"predicted_power": 0.0, "error": str(e)}))

if __name__ == "__main__":
    main()