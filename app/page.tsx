"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  Download,
  Play,
  RotateCcw,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  Video,
  Loader2,
} from "lucide-react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23],
  [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];
// Ordre de préférence pour l'enregistrement : WebM (Chrome, Firefox, Android) puis MP4 (Safari/iOS).
const RECORD_MIME_TYPES = ["video/webm;codecs=vp9", "video/webm", "video/mp4"];
const MAX_FILE_BYTES = 500 * 1024 * 1024;

type Point = { x: number; y: number; visibility?: number };
type Settings = { stroke: string; background: string; width: number; head: number; smoothing: number };

const initialSettings: Settings = { stroke: "#ffffff", background: "#050505", width: 5, head: 1, smoothing: 70 };

// Le modèle est chargé une seule fois ; en cas d'échec, la prochaine tentative recommence.
let landmarkerPromise: Promise<PoseLandmarker> | null = null;

function loadPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const common = {
        runningMode: "VIDEO" as const,
        numPoses: 1,
        minPoseDetectionConfidence: 0.35,
        minPosePresenceConfidence: 0.35,
      };
      try {
        return await PoseLandmarker.createFromOptions(vision, {
          ...common,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        });
      } catch {
        return await PoseLandmarker.createFromOptions(vision, {
          ...common,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        });
      }
    })().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

// Lissage exponentiel appliqué une seule fois par détection (et non à chaque redessin).
function smoothPose(raw: Point[], memory: Record<number, Point>, smoothing: number): Point[] {
  const amount = (smoothing / 100) * 0.82;
  return raw.map((point, index) => {
    const old = memory[index];
    if (point.visibility !== undefined && point.visibility < 0.4 && old) return old;
    const next = old
      ? { x: old.x + (point.x - old.x) * (1 - amount), y: old.y + (point.y - old.y) * (1 - amount) }
      : { x: point.x, y: point.y };
    memory[index] = next;
    return next;
  });
}

function drawStickman(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  height: number,
  settings: Settings
) {
  const at = (index: number) => ({ x: points[index].x * width, y: points[index].y * height });
  ctx.strokeStyle = settings.stroke;
  ctx.lineWidth = settings.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [from, to] of CONNECTIONS) {
    const a = at(from);
    const b = at(to);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  const nose = at(0);
  const left = at(7);
  const right = at(8);
  const radius = Math.max(14, Math.hypot(left.x - right.x, left.y - right.y) * settings.head * 1.65);
  ctx.beginPath();
  ctx.arc(nose.x, nose.y - radius * 0.45, radius, 0, Math.PI * 2);
  ctx.stroke();
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const smoothingMemory = useRef<Record<number, Point>>({});

  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [outputName, setOutputName] = useState("stickman-animation.webm");
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Prêt à transformer");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  // Chaque URL blob est révoquée uniquement lorsqu'elle est remplacée.
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (outputUrl) URL.revokeObjectURL(outputUrl); }, [outputUrl]);

  const update = (key: keyof Settings, value: string | number) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const chooseFile = (selected: File) => {
    setError("");
    if (!selected.type.startsWith("video/")) {
      setError("Format non supporté. Choisissez un fichier MP4, WebM ou MOV.");
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setError("La vidéo dépasse la limite de 500 Mo.");
      return;
    }
    setFile(selected);
    setSourceUrl(URL.createObjectURL(selected));
    setOutputUrl("");
    setProgress(0);
    setStatus("Vidéo prête à traiter");
  };

  const reset = () => {
    setFile(null);
    setSourceUrl("");
    setOutputUrl("");
    setProgress(0);
    setError("");
    setStatus("Prêt à transformer");
  };

  const generate = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !file) return;

    setProcessing(true);
    setError("");
    setOutputUrl("");
    setProgress(0);
    setStatus("Chargement du modèle de pose…");

    try {
      const landmarker = await loadPoseLandmarker();
      setStatus("Analyse de la vidéo…");

      if (video.readyState < 1) {
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
        });
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponible");

      const mimeType = RECORD_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
      const recorder = new MediaRecorder(canvas.captureStream(30), mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      let failed = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      const finished = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.onerror = () => {
          failed = true;
          resolve();
        };
      });

      // Arrêt garanti à la fin de la vidéo : requestVideoFrameCallback ne se déclenche plus
      // après la dernière image présentée, donc il ne faut pas compter dessus pour arrêter.
      const stopRecording = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };
      video.addEventListener("ended", stopRecording, { once: true });
      video.addEventListener(
        "error",
        () => {
          failed = true;
          stopRecording();
        },
        { once: true }
      );

      smoothingMemory.current = {};
      let lastTimestamp = -1;
      let pose: Point[] | null = null;

      const drawFrame = () => {
        const timestamp = video.currentTime * 1000;
        // MediaPipe exige des horodatages strictement croissants.
        if (timestamp > lastTimestamp) {
          lastTimestamp = timestamp;
          try {
            const raw = landmarker.detectForVideo(video, timestamp).landmarks[0];
            if (raw) pose = smoothPose(raw, smoothingMemory.current, settings.smoothing);
          } catch (err) {
            console.warn("Image ignorée pendant la détection :", err);
          }
        }

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        if (settings.background === "video") {
          ctx.drawImage(video, 0, 0, width, height);
        } else if (settings.background !== "transparent") {
          ctx.fillStyle = settings.background;
          ctx.fillRect(0, 0, width, height);
        }
        if (pose) drawStickman(ctx, pose, width, height, settings);

        setProgress(video.duration ? Math.min(100, (video.currentTime / video.duration) * 100) : 0);
      };

      const nextFrame = (callback: () => void) => {
        if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(callback);
        else requestAnimationFrame(callback);
      };
      const loop = () => {
        drawFrame();
        if (!video.ended && recorder.state !== "inactive") nextFrame(loop);
      };

      recorder.start(200);
      video.currentTime = 0;
      await video.play();
      nextFrame(loop);
      await finished;
      video.pause();

      if (failed || chunks.length === 0) throw new Error("Aucune image enregistrée");
      const type = recorder.mimeType || "video/webm";
      setOutputName(type.includes("mp4") ? "stickman-animation.mp4" : "stickman-animation.webm");
      setOutputUrl(URL.createObjectURL(new Blob(chunks, { type })));
      setProgress(100);
      setStatus("Animation terminée");
    } catch (err) {
      console.error(err);
      setError("Impossible de traiter cette vidéo. Vérifiez le format et réessayez.");
      setStatus("Erreur de traitement");
    } finally {
      setProcessing(false);
    }
  }, [file, settings]);

  return (
    <main className="app-shell">
      <header>
        <div className="brand">
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span>POSE<span className="accent">TRACE</span></span>
        </div>
        <span className="privacy"><ShieldCheck size={15} /> 100% dans votre navigateur</span>
      </header>

      <section className="hero">
        <div className="eyebrow">ANIMATION PAR IA · SIMPLE · PRIVÉE</div>
        <h1>Transformez vos mouvements<br /><em>en dessin vivant.</em></h1>
        <p>
          Importez une vidéo, ajustez votre style et laissez notre moteur de pose créer un stickman
          fluide en quelques secondes.
        </p>
      </section>

      <section className="workspace">
        <div
          className="upload-zone"
          onClick={() => !processing && fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files[0];
            if (dropped) chooseFile(dropped);
          }}
        >
          {file ? (
            <>
              <Video size={28} />
              <strong>{file.name}</strong>
              <small>{(file.size / 1024 / 1024).toFixed(1)} Mo · vidéo sélectionnée</small>
            </>
          ) : (
            <>
              <span className="upload-icon"><Upload size={24} /></span>
              <strong>Déposez votre vidéo ici</strong>
              <small>ou cliquez pour parcourir · MP4, WebM, MOV · 500 Mo max</small>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) chooseFile(selected);
            }}
          />
        </div>

        <div className="previews">
          <div className="preview-card">
            <div className="card-title">
              <span>ORIGINAL</span>
              {file && <span className="live-dot">● SOURCE</span>}
            </div>
            <div className="media">
              <video ref={videoRef} src={sourceUrl} controls={!!file} muted playsInline />
            </div>
          </div>
          <div className="preview-card">
            <div className="card-title">
              <span>STICKMAN</span>
              {outputUrl && <span className="done">● TERMINÉ</span>}
            </div>
            <div className="media output-media">
              {outputUrl ? (
                <video src={outputUrl} controls autoPlay loop />
              ) : (
                <>
                  <canvas ref={canvasRef} />
                  <span className="empty">Votre animation apparaîtra ici</span>
                </>
              )}
            </div>
          </div>
        </div>

        <aside className="controls">
          <div className="controls-heading">
            <SlidersHorizontal size={18} />
            <strong>Style de l’animation</strong>
            <span>APERÇU EN DIRECT</span>
          </div>
          <div className="control-grid">
            <label>
              Couleur du trait
              <input type="color" value={settings.stroke} onChange={(e) => update("stroke", e.target.value)} />
            </label>
            <label>
              Fond
              <select value={settings.background} onChange={(e) => update("background", e.target.value)}>
                <option value="#050505">Noir profond</option>
                <option value="#ffffff">Blanc</option>
                <option value="#00b140">Vert chroma</option>
                <option value="transparent">Transparent</option>
                <option value="video">Vidéo originale</option>
              </select>
            </label>
            <label>
              Épaisseur <b>{settings.width}px</b>
              <input
                type="range"
                min="2"
                max="14"
                value={settings.width}
                onChange={(e) => update("width", +e.target.value)}
              />
            </label>
            <label>
              Taille de la tête <b>{settings.head.toFixed(1)}×</b>
              <input
                type="range"
                min=".6"
                max="1.6"
                step=".1"
                value={settings.head}
                onChange={(e) => update("head", +e.target.value)}
              />
            </label>
            <label className="wide">
              Lissage des mouvements <b>{settings.smoothing}%</b>
              <input
                type="range"
                min="0"
                max="95"
                value={settings.smoothing}
                onChange={(e) => update("smoothing", +e.target.value)}
              />
            </label>
          </div>
        </aside>

        {error && <div className="error">{error}</div>}

        <div className="actions">
          <button className="primary" disabled={!file || processing} onClick={generate}>
            {processing ? (
              <><Loader2 className="spin" size={17} /> Traitement…</>
            ) : (
              <><Play size={17} /> Générer le stickman</>
            )}
          </button>
          {outputUrl && (
            <a className="download" href={outputUrl} download={outputName}>
              <Download size={17} /> Télécharger {outputName.endsWith(".mp4") ? "MP4" : "WebM"}
            </a>
          )}
          {file && (
            <button className="reset" onClick={reset} disabled={processing}>
              <RotateCcw size={15} /> Réinitialiser
            </button>
          )}
        </div>

        {(processing || progress > 0) && (
          <div className="progress-wrap">
            <div>
              <span>{status}</span>
              <b>{Math.round(progress)}%</b>
            </div>
            <div className="progress">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </section>

      <footer>
        <span>Vos vidéos ne quittent jamais votre appareil.</span>
        <span>PoseTrace · MVP navigateur · WebM ou MP4</span>
      </footer>
    </main>
  );
}
