import os
# Suppress TensorFlow log noise
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Input, LSTM, Dense
from sklearn.preprocessing import MinMaxScaler

def normalize_columns(df):
    """Automatically maps common column names to expected standardized names."""
    column_mapping = {}
    for col in df.columns:
        col_lower = str(col).strip().lower()
        if 'irradiance' in col_lower or 'rad' in col_lower:
            column_mapping[col] = 'irradiance_wm2'
        elif 'temp' in col_lower:
            column_mapping[col] = 'panel_temp_c'
        elif 'power' in col_lower or 'watt' in col_lower or 'p_out' in col_lower:
            column_mapping[col] = 'power_w'
    
    return df.rename(columns=column_mapping)

def main():
    print("1. Loading historical data from CSV...")
    try:
        df = pd.read_csv('clean_lstm_training_data.csv')
    except FileNotFoundError:
        print("❌ Error: 'clean_lstm_training_data.csv' not found. Make sure the file is in 'solar_backend'.")
        return

    # Standardize column names
    df = normalize_columns(df)

    required_features = ['irradiance_wm2', 'panel_temp_c', 'power_w']
    missing_cols = [col for col in required_features if col not in df.columns]

    if missing_cols:
        print(f"❌ Error: Could not automatically find matching columns for: {missing_cols}")
        print(f"Available columns are: {list(df.columns)}")
        return

    print("✅ Successfully mapped columns:", required_features)

    # Extract required feature data
    data = df[required_features].dropna().values

    # Scale features between 0 and 1
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(data)

    # Prepare sequence dataset for LSTM
    sequence_length = 60
    if len(scaled_data) <= sequence_length:
        print(f"❌ Error: Dataset contains {len(scaled_data)} rows. Need at least {sequence_length + 1} rows to train.")
        return

    X, y = [], []
    for i in range(sequence_length, len(scaled_data)):
        X.append(scaled_data[i - sequence_length:i])
        y.append(scaled_data[i, 2])  # Index 2 corresponds to 'power_w'

    X, y = np.array(X), np.array(y)
    print(f"Prepared tensor dataset shape: {X.shape}")

    # Build LSTM with explicit Input layer (fixes Keras 3 warning)
    print("2. Building and training LSTM model...")
    model = Sequential([
        Input(shape=(X.shape[1], X.shape[2])),
        LSTM(50, return_sequences=True),
        LSTM(50),
        Dense(1)
    ])

    model.compile(optimizer='adam', loss='mean_squared_error')
    model.fit(X, y, epochs=10, batch_size=32, verbose=1)

    # Target model filename
    model_filename = 'solar_lstm_model.keras'

    # Remove existing model file to prevent Windows permission locks
    if os.path.exists(model_filename):
        try:
            os.remove(model_filename)
        except PermissionError:
            print(f"⚠️ Warning: Could not remove existing {model_filename}. Attempting to overwrite...")

    # Save trained model
    try:
        model.save(model_filename)
        print("✅ Success: Model trained and saved as 'solar_lstm_model.keras'!")
    except Exception as e:
        print(f"❌ Failed to save model: {e}")

if __name__ == "__main__":
    main()