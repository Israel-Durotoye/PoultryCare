import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from tensorflow import keras
from tensorflow.keras.layers import Dense, InputLayer
import tempfile
import numpy as np
import cv2
import librosa
import io
import os
import gdown
from sklearn.preprocessing import MinMaxScaler
import noisereduce as nr

app = FastAPI(title = "CluckCare API")

class PatchedDense(Dense):
    def __init__(self, **kwargs):
        kwargs.pop('quantization_config', None)
        super().__init__(**kwargs)

class PatchedInputLayer(InputLayer):
    def __init__(self, **kwargs):
        if 'batch_shape' in kwargs:
            kwargs['batch_input_shape'] = kwargs.pop('batch_shape')
        kwargs.pop('optional', None)
        super().__init__(**kwargs)

custom_hacks = {
    'Dense': PatchedDense,
    'InputLayer': PatchedInputLayer
}

# --- 1. CORS SETUP (Crucial for Lovable to talk to this API) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. DOWNLOAD AND LOAD MODELS ---
print("Preparing TensorFlow Models...")

# 1. Paste Google Drive File IDs
AUDIO_MODEL_ID = "1W1B6zkZeIq7GXT6oWajvU2H1urOvtLgz"
VISION_MODEL_ID = "1LOew986sfheU1QpkW_-6FnCKAXoVmqtm"


audio_model_path = "final_audio_model.h5"
vision_model_path = "final_mobilenet_model.h5"

def download_model_from_drive(file_id, output_path):
    """Downloads a file from Google Drive if it doesn't already exist locally."""
    if not os.path.exists(output_path):
        print(f"Downloading {output_path} from Google Drive...")
        url = f"https://drive.google.com/uc?id={file_id}"
        gdown.download(url, output_path, quiet=False)
    else:
        print(f"{output_path} already exists locally. Skipping download.")

# 3. Trigger the downloads
download_model_from_drive(AUDIO_MODEL_ID, audio_model_path)
download_model_from_drive(VISION_MODEL_ID, vision_model_path)

print("Loading models into memory (This might take a few seconds)...")
audio_model = keras.models.load_model(
    audio_model_path,
    custom_objects=custom_hacks
)

vision_model = keras.models.load_model(
    vision_model_path,
    custom_objects=custom_hacks
)

print("Models Loaded Successfully!")

# Denoising
def denoise_audio(audio_signal, sample_rate):
    """
    Applies spectral gating to remove stationary background noise.
    """
    denoised_signal = nr.reduce_noise(y = audio_signal, sr = sample_rate, stationary = True)

    return denoised_signal

AUDIO_CLASSES = ['Healthy', 'Unhealthy']
VISION_CLASSES = ['cocci', 'healthy', 'ncd', 'salmo']

SAMPLE_RATE = 22050
TARGET_DURATION_SEC = 10
TOTAL_TARGET_SAMPLES = SAMPLE_RATE * TARGET_DURATION_SEC

def get_audio_chunks(file_path):
    """
    Loads audio, trims silence, and slices it into multiple 10-second chunks.
    Returns a list of standardized 10-second audio arrays.
    """

    # Load raw audio signal
    raw_audio_signal, _ = librosa.load(file_path, sr=SAMPLE_RATE)

    # Using the denoise function

    clean_audio_signal = denoise_audio(raw_audio_signal, SAMPLE_RATE)

    filtered_signal = librosa.effects.preemphasis(clean_audio_signal)
    active_signal, _ = librosa.effects.trim(filtered_signal, top_db = 20)

    signal_length = len(active_signal)
    chunks = []

    # Slice the audio
    if signal_length < TOTAL_TARGET_SAMPLES:
        # If it's too short, pad it to exactly 10 seconds and make it the only chunk
        padded_signal = librosa.util.fix_length(active_signal, size = TOTAL_TARGET_SAMPLES)
        chunks.append(padded_signal)
    else:
        # If it's long, figure out how many full 10-second cuts we can make
        num_full_chunks = signal_length // TOTAL_TARGET_SAMPLES

        for i in range(num_full_chunks):
            start_point = i * TOTAL_TARGET_SAMPLES
            end_point = start_point + TOTAL_TARGET_SAMPLES

            # Slice the exact 10-second window
            audio_slice = active_signal[start_point:end_point]
            chunks.append(audio_slice)

    return chunks

def extract_mfcc_features(signal, sr = SAMPLE_RATE, n_mfcc=13):
    """
    Converts a standardized audio signal into a raw MFCC heatmap.
    """
    raw_mfcc = librosa.feature.mfcc(y = signal, sr = sr, n_mfcc = n_mfcc)
    return raw_mfcc

def normalize_features(mfcc_matrix):
    """
    Applies MinMaxScaler and adds the CNN channel dimension.
    """
    scaler = MinMaxScaler(feature_range = (0, 1))

    original_shape = mfcc_matrix.shape
    mfcc_scaled = scaler.fit_transform(mfcc_matrix.reshape(-1, 1)).reshape(original_shape)

    # Add the "channel" dimension for the CNN
    return mfcc_scaled[..., np.newaxis]

def process_audio_pipeline(file_path):
    """
    Runs the complete audio preprocessing pipeline.
    Takes a file path and returns a stacked NumPy array.
    """

    chunks = get_audio_chunks(file_path)

    processed_tensors = []

    for chunk in chunks:
        # Extract MFCCs
        raw_mfcc = extract_mfcc_features(chunk)
        final_tensor = normalize_features(raw_mfcc)

        processed_tensors.append(final_tensor)

    return np.array(processed_tensors)

# --- 3. PREPROCESSING HELPERS ---
def preprocess_audio(file_bytes):
    """
    Saves raw bytes to a temporary file, runs the chunking pipeline,
    and cleans up the file afterward.
    """
    # 1. Create a temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
        tmp_file.write(file_bytes)
        tmp_file_path = tmp_file.name

    try:
        # 2. Pass the physical file path to your exact pipeline
        processed_tensors = process_audio_pipeline(tmp_file_path)
    finally:
        # 3. Always delete the temp file so your laptop doesn't run out of space!
        os.remove(tmp_file_path)

    return processed_tensors

def preprocess_image(file_bytes):
    """ Converts raw image bytes to (1, 224, 224, 3) """
    # Read bytes as a numpy array, then decode into an OpenCV image
    nparr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (224, 224))
    img = img / 255.0 # Normalize

    return np.expand_dims(img, axis=0)

# --- 4. API ENDPOINTS ---

@app.get("/")
def home():
    return {"message": "Welcome to the CluckCare API"}

@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...)):
    if not file.filename.endswith('.wav'):
        raise HTTPException(status_code=400, detail="Only .wav files are accepted.")

    try:
        contents = await file.read()

        # 1. Get the tensors for all chunks
        audio_features = preprocess_audio(contents)

        # 2. Predict on all chunks at once
        audio_preds = audio_model.predict(audio_features, verbose = 0)

        # 3. Average the predictions (since shape is (num_chunks, 1))
        avg_preds = np.mean(audio_preds, axis=0)
        prob_unhealthy = float(avg_preds[0])

        # 4. Determine winning class and confidence (sigmoid binary threshold of 0.5)
        class_idx = 1 if prob_unhealthy > 0.5 else 0
        result = AUDIO_CLASSES[class_idx]
        confidence = prob_unhealthy * 100 if class_idx == 1 else (1.0 - prob_unhealthy) * 100

        return {
            "status": "success",
            "prediction": result,
            "confidence": round(confidence, 2),
            "message": "Healthy" if result == "Healthy" else "Unhealthy - Needs Stool Sample"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        raise HTTPException(status_code=400, detail="Only images are accepted.")

    try:
        contents = await file.read()

        image_features = preprocess_image(contents)
        vision_preds = vision_model.predict(image_features, verbose=0)

        class_idx = int(np.argmax(vision_preds[0]))
        result = VISION_CLASSES[class_idx]
        confidence = float(vision_preds[0][class_idx] * 100)

        return {
            "status": "success",
            "prediction": result,
            "confidence": round(confidence, 2),
            "message": f"Detected {result.upper()} with {confidence:.1f}% confidence."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Run the server
if __name__ == "__main__":
    uvicorn.run(app, host = "0.0.0.0", port=8000)