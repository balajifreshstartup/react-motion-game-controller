import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const TARGET_DIR = path.resolve(__dirname, '../client/public/models');
const TARGET_FILE = path.join(TARGET_DIR, 'pose_landmarker_lite.task');

async function downloadModel() {
  if (fs.existsSync(TARGET_FILE) && fs.statSync(TARGET_FILE).size > 1000000) {
    console.log(`[Model] Model already exists at ${TARGET_FILE} (${(fs.statSync(TARGET_FILE).size / (1024 * 1024)).toFixed(2)} MB). Skipping download.`);
    return;
  }

  console.log(`[Model] Downloading MediaPipe Pose Landmarker Lite model from ${MODEL_URL}...`);
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  try {
    const response = await fetch(MODEL_URL);
    if (!response.ok) {
      throw new Error(`Failed to download model: HTTP ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(TARGET_FILE, buffer);
    console.log(`[Model] Successfully downloaded model to ${TARGET_FILE} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`);
  } catch (err) {
    console.error(`[Model] Error downloading model:`, err);
    console.log(`[Model] Note: If offline or blocked by firewall, download pose_landmarker_lite.task manually and place it in client/public/models/`);
    process.exit(1);
  }
}

downloadModel();
