"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  ImagePlus,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  Video,
} from "lucide-react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  createSceneTransform,
  drawClassroomBackdrop,
  drawCodeCartoon,
  drawImageCover,
  drawTrackedCharacter,
  drawVideoBackground,
  mapPoseToCanvas,
  type LandmarkPoint,
} from "@/lib/rendering/pose-renderer";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const RECORD_MIME_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp9", "video/webm", "video/mp4"];
const MODEL_LOAD_TIMEOUT_MS = 90_000;
const VIDEO_LIMIT = 500 * 1024 * 1024;
const IMAGE_LIMIT = 20 * 1024 * 1024;
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

type Settings = {
  visualMode: "cartoon" | "custom";
  outlineColor: string;
  background: string;
  headScale: number;
  smoothing: number;
  characterScale: number;
  characterOffsetX: number;
  characterOffsetY: number;
};
type AudioGraph = {
  context: AudioContext;
  analyser: AnalyserNode;
  destination: MediaStreamAudioDestinationNode;
};

const initialSettings: Settings = {
  visualMode: "cartoon",
  outlineColor: "#151515",
  background: "#050505",
  headScale: 1,
  smoothing: 65,
  characterScale: 1,
  characterOffsetX: 0,
  characterOffsetY: 0,
};

// Le modèle se charge une fois par onglet ; une erreur permet de réessayer au clic suivant.
let landmarkerPromise: Promise<PoseLandmarker> | null = null;
function loadPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    const load = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const shared = {
        runningMode: "VIDEO" as const,
        numPoses: 1,
        minPoseDetectionConfidence: 0.35,
        minPosePresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
      };
      try {
        return await PoseLandmarker.createFromOptions(vision, {
          ...shared,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        });
      } catch {
        return await PoseLandmarker.createFromOptions(vision, {
          ...shared,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        });
      }
    })();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<PoseLandmarker>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Le modèle de pose ne répond pas après 90 secondes.")), MODEL_LOAD_TIMEOUT_MS);
    });
    landmarkerPromise = Promise.race([load, timeout])
      .finally(() => clearTimeout(timer))
      .catch((cause) => {
        landmarkerPromise = null;
        throw cause;
      });
  }
  return landmarkerPromise;
}

function smoothLandmarks(
  raw: LandmarkPoint[],
  previous: Record<number, LandmarkPoint>,
  amount: number
): LandmarkPoint[] {
  return raw.map((point, index) => {
    const last = previous[index];
    if (point.visibility !== undefined && point.visibility < 0.35 && last) return last;
    const factor = amount / 100 * 0.75;
    const smoothed = last
      ? { ...point, x: last.x + (point.x - last.x) * (1 - factor), y: last.y + (point.y - last.y) * (1 - factor) }
      : { ...point };
    previous[index] = smoothed;
    return smoothed;
  });
}

function getAudioGraph(video: HTMLVideoElement, current: AudioGraph | null): AudioGraph | null {
  if (typeof window === "undefined" || !(window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) return null;
  if (current) return current;
  const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  const context = new AudioContextConstructor();
  const source = context.createMediaElementSource(video);
  const analyser = context.createAnalyser();
  const destination = context.createMediaStreamDestination();
  analyser.fftSize = 1024;
  source.connect(analyser);
  // Aucun branchement vers speakers : l'audio reste inaudible en local, mais la piste est enregistrée.
  analyser.connect(destination);
  return { context, analyser, destination };
}

function measureAudioLevel(analyser: AnalyserNode | null, buffer: Float32Array): number {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(buffer);
  let power = 0;
  for (const sample of buffer) power += sample * sample;
  return Math.sqrt(power / buffer.length);
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const characterInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const audioGraphRef = useRef<AudioGraph | null>(null);
  const audioDisabledRef = useRef(false);
  const smoothingMemory = useRef<Record<number, LandmarkPoint>>({});

  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [characterFile, setCharacterFile] = useState<File | null>(null);
  const [characterUrl, setCharacterUrl] = useState("");
  const [characterImage, setCharacterImage] = useState<HTMLImageElement | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [outputUrl, setOutputUrl] = useState("");
  const [outputName, setOutputName] = useState("posetrace-animation.webm");
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Prêt à transformer");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (characterUrl) URL.revokeObjectURL(characterUrl); }, [characterUrl]);
  useEffect(() => () => { if (backgroundUrl) URL.revokeObjectURL(backgroundUrl); }, [backgroundUrl]);
  useEffect(() => () => { if (outputUrl) URL.revokeObjectURL(outputUrl); }, [outputUrl]);
  useEffect(() => {
    if (!characterUrl) { setCharacterImage(null); return; }
    const image = new Image();
    image.onload = () => setCharacterImage(image);
    image.onerror = () => { setCharacterImage(null); setError("Impossible de lire l’image PNG du personnage."); };
    image.src = characterUrl;
    return () => { image.onload = null; image.onerror = null; };
  }, [characterUrl]);
  useEffect(() => {
    if (!backgroundUrl) { setBackgroundImage(null); return; }
    const image = new Image();
    image.onload = () => setBackgroundImage(image);
    image.onerror = () => { setBackgroundImage(null); setError("Impossible de lire l’image du décor."); };
    image.src = backgroundUrl;
    return () => { image.onload = null; image.onerror = null; };
  }, [backgroundUrl]);
  useEffect(() => () => {
    const context = audioGraphRef.current?.context;
    if (context && context.state !== "closed") void context.close();
  }, []);

  const update = (key: keyof Settings, value: string | number) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const chooseVideo = (selected: File) => {
    setError("");
    if (!selected.type.startsWith("video/")) {
      setError("Format non supporté. Choisissez une vidéo MP4, WebM ou MOV.");
      return;
    }
    if (selected.size > VIDEO_LIMIT) {
      setError("La vidéo dépasse la limite actuelle de 500 Mo.");
      return;
    }
    setFile(selected);
    setSourceUrl(URL.createObjectURL(selected));
    setOutputUrl("");
    setProgress(0);
    setStatus("Vidéo prête à traiter");
  };

  const chooseImage = (selected: File, kind: "character" | "background") => {
    setError("");
    if (!selected.type.startsWith("image/")) {
      setError("Choisissez un fichier image PNG, JPG ou WebP.");
      return;
    }
    if (kind === "character" && selected.type !== "image/png") {
      setError("Le personnage doit être un PNG avec fond transparent.");
      return;
    }
    if (selected.size > IMAGE_LIMIT) {
      setError("Cette image dépasse la limite de 20 Mo.");
      return;
    }
    const url = URL.createObjectURL(selected);
    if (kind === "character") {
      setCharacterFile(selected);
      setCharacterUrl(url);
      setCharacterImage(null);
    } else {
      setBackgroundFile(selected);
      setBackgroundUrl(url);
      setBackgroundImage(null);
      setSettings((current) => ({ ...current, background: "image" }));
    }
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
    if (settings.visualMode === "custom" && !characterImage) {
      setError("Ajoutez un PNG transparent du personnage avant de lancer l’animation.");
      return;
    }

    setProcessing(true);
    setError("");
    setOutputUrl("");
    setProgress(0);
    setStatus("Chargement du modèle de pose…");

    let recorder: MediaRecorder | null = null;
    let canvasStream: MediaStream | null = null;
    let recordingStream: MediaStream | null = null;
    let graph: AudioGraph | null = null;
    let finishRecording: (() => void) | null = null;
    let onVideoEnded: (() => void) | null = null;
    let onVideoError: (() => void) | null = null;
    let recordingFailed = false;
    let audioUnavailable = false;
    let poseFrames = 0;

    try {
      const landmarker = await loadPoseLandmarker();
      setStatus("Préparation de l’image verticale et de l’audio…");
      if (video.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const loaded = () => { cleanup(); resolve(); };
          const failed = () => { cleanup(); reject(new Error("La vidéo n’a pas pu être décodée")); };
          const cleanup = () => {
            video.removeEventListener("loadedmetadata", loaded);
            video.removeEventListener("error", failed);
          };
          video.addEventListener("loadedmetadata", loaded, { once: true });
          video.addEventListener("error", failed, { once: true });
        });
      }
      if (!video.videoWidth || !video.videoHeight) throw new Error("Dimensions vidéo indisponibles");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext("2d", { alpha: settings.background === "transparent" });
      if (!ctx) throw new Error("Canvas indisponible");

      try {
        graph = audioDisabledRef.current ? null : getAudioGraph(video, audioGraphRef.current);
        if (graph) {
          audioGraphRef.current = graph;
          if (graph.context.state === "suspended") await graph.context.resume();
          video.muted = false;
        } else {
          audioUnavailable = true;
        }
      } catch (audioError) {
        console.warn("Capture audio indisponible ; la vidéo sera exportée sans audio.", audioError);
        graph = null;
        audioUnavailable = true;
        audioDisabledRef.current = true;
        video.muted = true;
      }

      canvasStream = canvas.captureStream(30);
      const tracks = [...canvasStream.getVideoTracks()];
      const audioTrack = graph?.destination.stream.getAudioTracks()[0];
      if (audioTrack) tracks.push(audioTrack);
      recordingStream = new MediaStream(tracks);

      const mimeType = RECORD_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      try {
        recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
      } catch (cause) {
        // Certains navigateurs acceptent la vidéo sans piste audio mais refusent la combinaison.
        if (!audioTrack) throw cause;
        recordingStream.removeTrack(audioTrack);
        recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
        graph = null;
        audioUnavailable = true;
        audioDisabledRef.current = true;
        video.muted = true;
      }

      const chunks: Blob[] = [];
      let finish!: () => void;
      const finished = new Promise<void>((resolve) => { finish = resolve; });
      finishRecording = finish;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => finish();
      recorder.onerror = () => { recordingFailed = true; finish(); };
      const stopRecording = () => {
        if (recorder && recorder.state !== "inactive") recorder.stop();
      };
      onVideoEnded = stopRecording;
      onVideoError = () => { recordingFailed = true; stopRecording(); };
      video.addEventListener("ended", onVideoEnded, { once: true });
      video.addEventListener("error", onVideoError, { once: true });

      smoothingMemory.current = {};
      let pose: LandmarkPoint[] | null = null;
      let previousTimestamp = -1;
      let lastDisplayedProgress = -1;
      const audioBuffer = graph ? new Float32Array(graph.analyser.fftSize) : new Float32Array(0);
      let smoothedAudio = 0;

      const drawFrame = () => {
        const timestamp = video.currentTime * 1000;
        if (timestamp > previousTimestamp) {
          previousTimestamp = timestamp;
          try {
            const raw = landmarker.detectForVideo(video, timestamp).landmarks[0];
            pose = raw ? smoothLandmarks(raw, smoothingMemory.current, settings.smoothing) : null;
            if (pose) poseFrames += 1;
          } catch (cause) {
            console.warn("Une image vidéo n’a pas pu être analysée.", cause);
          }
        }

        const transform = createSceneTransform(video.videoWidth, video.videoHeight, canvas.width, canvas.height, pose ?? []);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (settings.background === "video") {
          drawVideoBackground(ctx, video, transform);
        } else if (settings.background === "classroom") {
          drawClassroomBackdrop(ctx, canvas.width, canvas.height);
        } else if (settings.background === "image" && backgroundImage) {
          drawImageCover(ctx, backgroundImage, canvas.width, canvas.height);
        } else if (settings.background !== "transparent") {
          ctx.fillStyle = settings.background === "image" ? "#050505" : settings.background;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        if (pose) {
          const mappedPose = mapPoseToCanvas(pose, video.videoWidth, video.videoHeight, transform);
          const renderSettings = {
            outlineColor: settings.outlineColor,
            headScale: settings.headScale,
            characterScale: settings.characterScale,
            characterOffsetX: settings.characterOffsetX,
            characterOffsetY: settings.characterOffsetY,
          };
          const audioLevel = graph ? measureAudioLevel(graph.analyser, audioBuffer) : 0;
          smoothedAudio += (audioLevel - smoothedAudio) * 0.38;
          if (settings.visualMode === "custom" && characterImage) {
            drawTrackedCharacter(ctx, characterImage, mappedPose, renderSettings);
          } else {
            drawCodeCartoon(ctx, mappedPose, renderSettings, timestamp, smoothedAudio);
          }
        }
        const percent = video.duration ? Math.floor(Math.min(100, (video.currentTime / video.duration) * 100)) : 0;
        if (percent !== lastDisplayedProgress) {
          lastDisplayedProgress = percent;
          setProgress(percent);
        }
      };

      const scheduleFrame = (callback: () => void) => {
        if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(() => callback());
        else requestAnimationFrame(callback);
      };
      const renderLoop = () => {
        if (!recorder || recorder.state === "inactive") return;
        drawFrame();
        if (!video.ended && String(recorder.state) !== "inactive") scheduleFrame(renderLoop);
      };

      setStatus("Analyse et animation en cours…");
      recorder.start(250);
      if (video.currentTime !== 0) {
        await new Promise<void>((resolve, reject) => {
          const seeked = () => { cleanup(); resolve(); };
          const failed = () => { cleanup(); reject(new Error("Impossible de revenir au début de la vidéo")); };
          const cleanup = () => {
            video.removeEventListener("seeked", seeked);
            video.removeEventListener("error", failed);
          };
          video.addEventListener("seeked", seeked, { once: true });
          video.addEventListener("error", failed, { once: true });
          video.currentTime = 0;
        });
      }
      await video.play();
      scheduleFrame(renderLoop);
      await finished;
      if (recordingFailed || chunks.length === 0) throw new Error("L’enregistrement n’a produit aucune image");
      if (poseFrames === 0) throw new Error("Aucune personne visible n’a été détectée dans la vidéo.");

      const resultType = recorder.mimeType || "video/webm";
      const resultBlob = new Blob(chunks, { type: resultType });
      setOutputName(resultType.includes("mp4") ? "posetrace-animation.mp4" : "posetrace-animation.webm");
      setOutputUrl(URL.createObjectURL(resultBlob));
      setProgress(100);
      setStatus(audioUnavailable
        ? "Animation terminée · audio non pris en charge par ce navigateur"
        : "Animation terminée · format vertical 9:16 avec audio");
    } catch (cause) {
      console.error("PoseTrace processing error:", cause);
      const detail = cause instanceof Error ? cause.message : "";
      setError(detail.includes("Aucune personne visible")
        ? "Aucune personne détectée. Choisissez une vidéo où le corps est visible et bien éclairé, puis réessayez."
        : detail.includes("90 secondes")
          ? "Le modèle de pose n’a pas répondu après 90 secondes. Vérifiez votre connexion au CDN MediaPipe et réessayez."
          : "Le traitement a échoué. Vérifiez le format vidéo, la mémoire disponible et l’accès au modèle MediaPipe, puis réessayez.");
      setStatus("Erreur de traitement");
      if (recorder && recorder.state !== "inactive") {
        try { recorder.stop(); } catch { /* le navigateur a peut-être déjà arrêté le recorder */ }
        finishRecording?.();
      }
    } finally {
      if (onVideoEnded) video.removeEventListener("ended", onVideoEnded);
      if (onVideoError) video.removeEventListener("error", onVideoError);
      video.pause();
      video.muted = true;
      canvasStream?.getTracks().forEach((track) => track.stop());
      if (recordingStream) recordingStream.getTracks().filter((track) => track.kind === "video").forEach((track) => track.stop());
      setProcessing(false);
    }
  }, [file, settings, characterImage, backgroundImage]);

  const canGenerate = Boolean(file) && !processing && (settings.visualMode !== "custom" || Boolean(characterImage));

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
        <div className="eyebrow">VIDÉO VERS ANIMATION · LOCAL · PRIVÉ</div>
        <h1>Vos mouvements,<br /><em>votre personnage.</em></h1>
        <p>
          Animez un cartoon dessiné par PoseTrace ou faites suivre vos mouvements à votre propre personnage PNG.
          Choisissez ensuite votre décor et exportez une vidéo verticale.
        </p>
      </section>

      <section className="workspace">
        <div
          className="upload-zone"
          onClick={() => !processing && videoInputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const dropped = event.dataTransfer.files[0];
            if (dropped) chooseVideo(dropped);
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
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            hidden
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) chooseVideo(selected);
              event.currentTarget.value = "";
            }}
          />
        </div>

        <div className="previews">
          <div className="preview-card">
            <div className="card-title">
              <span>VIDÉO SOURCE</span>
              {file && <span className="live-dot">● LOCALE</span>}
            </div>
            <div className="media">
              <video ref={videoRef} src={sourceUrl} controls={!!file} muted playsInline />
            </div>
          </div>
          <div className="preview-card">
            <div className="card-title">
              <span>APERÇU VERTICAL · 9:16</span>
              {outputUrl && <span className="done">● TERMINÉ</span>}
            </div>
            <div className="media output-media">
              {outputUrl ? (
                <video src={outputUrl} controls autoPlay loop playsInline />
              ) : (
                <>
                  <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
                  {!processing && <span className="empty">Votre animation apparaîtra ici</span>}
                </>
              )}
            </div>
          </div>
        </div>

        <aside className="controls">
          <div className="controls-heading">
            <SlidersHorizontal size={18} />
            <strong>Choisissez votre personnage</strong>
            <span>2 STYLES · LOCAL</span>
          </div>
          <div className="mode-picker" role="group" aria-label="Style de personnage">
            <button
              type="button"
              className={`mode-card ${settings.visualMode === "cartoon" ? "selected" : ""}`}
              aria-pressed={settings.visualMode === "cartoon"}
              onClick={() => update("visualMode", "cartoon")}
              disabled={processing}
            >
              <span className="mode-icon cartoon-icon" aria-hidden="true">◉</span>
              <span><strong>Cartoon dessiné</strong><small>Corps articulé par la pose ; bouche liée au volume sonore.</small></span>
            </button>
            <button
              type="button"
              className={`mode-card ${settings.visualMode === "custom" ? "selected" : ""}`}
              aria-pressed={settings.visualMode === "custom"}
              onClick={() => update("visualMode", "custom")}
              disabled={processing}
            >
              <span className="mode-icon custom-icon" aria-hidden="true"><UserRound size={23} /></span>
              <span><strong>Mes images</strong><small>Votre personnage PNG suit le mouvement détecté.</small></span>
            </button>
          </div>

          {settings.visualMode === "custom" && (
            <div className="asset-grid">
              <div className="asset-card">
                <input
                  ref={characterInputRef}
                  type="file"
                  accept="image/png,.png"
                  hidden
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    if (selected) chooseImage(selected, "character");
                    event.currentTarget.value = "";
                  }}
                />
                <button type="button" className="asset-pick" onClick={() => characterInputRef.current?.click()} disabled={processing}>
                  <UserRound size={18} />
                  <span><strong>Personnage PNG</strong><small>{characterFile?.name ?? "Fond transparent recommandé"}</small></span>
                  <ImagePlus size={17} />
                </button>
                {characterImage && <div className="asset-ready">Image prête · {characterImage.naturalWidth} × {characterImage.naturalHeight}</div>}
              </div>
              <div className="asset-card">
                <input
                  ref={backgroundInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    if (selected) chooseImage(selected, "background");
                    event.currentTarget.value = "";
                  }}
                />
                <button type="button" className="asset-pick" onClick={() => backgroundInputRef.current?.click()} disabled={processing}>
                  <ImagePlus size={18} />
                  <span><strong>Décor image</strong><small>{backgroundFile?.name ?? "Facultatif · PNG, JPG ou WebP"}</small></span>
                  <Upload size={17} />
                </button>
                {backgroundImage && <div className="asset-ready">Décor prêt · rempli au format vertical</div>}
              </div>
              <p className="asset-note">
                Le PNG complet est positionné et redimensionné grâce à la pose. Pour cette première version,
                ses bras et jambes ne sont pas découpés en articulations séparées.
              </p>
            </div>
          )}

          <div className="controls-heading secondary-heading">
            <SlidersHorizontal size={17} />
            <strong>Décor et réglages</strong>
          </div>
          <div className="control-grid">
            <label>
              Couleur du contour
              <input type="color" value={settings.outlineColor} onChange={(event) => update("outlineColor", event.target.value)} />
            </label>
            <label>
              Décor de sortie
              <select value={settings.background} onChange={(event) => update("background", event.target.value)}>
                <option value="#050505">Noir profond</option>
                <option value="#f4f0e6">Crème</option>
                <option value="classroom">Salle de classe dessinée</option>
                <option value="#00a862">Vert chroma</option>
                <option value="transparent">Transparent</option>
                <option value="video">Vidéo originale recadrée</option>
                {backgroundImage && <option value="image">Mon décor importé</option>}
              </select>
            </label>
            <label>
              Taille de la tête <b>{settings.headScale.toFixed(1)}×</b>
              <input type="range" min=".65" max="1.45" step=".05" value={settings.headScale} onChange={(event) => update("headScale", +event.target.value)} />
            </label>
            <label className="wide">
              Lissage des mouvements <b>{settings.smoothing}%</b>
              <input type="range" min="0" max="90" value={settings.smoothing} onChange={(event) => update("smoothing", +event.target.value)} />
            </label>
            {settings.visualMode === "custom" && (
              <>
                <label>
                  Échelle PNG <b>{settings.characterScale.toFixed(1)}×</b>
                  <input type="range" min=".65" max="1.4" step=".05" value={settings.characterScale} onChange={(event) => update("characterScale", +event.target.value)} />
                </label>
                <label>
                  Décalage horizontal <b>{settings.characterOffsetX.toFixed(2)}</b>
                  <input type="range" min="-.2" max=".2" step=".01" value={settings.characterOffsetX} onChange={(event) => update("characterOffsetX", +event.target.value)} />
                </label>
                <label className="wide">
                  Décalage vertical <b>{settings.characterOffsetY.toFixed(2)}</b>
                  <input type="range" min="-.2" max=".2" step=".01" value={settings.characterOffsetY} onChange={(event) => update("characterOffsetY", +event.target.value)} />
                </label>
              </>
            )}
          </div>
        </aside>

        {error && <div className="error" role="alert">{error}</div>}
        {settings.visualMode === "custom" && !characterImage && (
          <div className="hint">Pour utiliser « Mes images », importez d’abord un personnage PNG avec un fond transparent.</div>
        )}

        <div className="actions">
          <button className="primary" disabled={!canGenerate} onClick={generate}>
            {processing ? <><Loader2 className="spin" size={17} /> Traitement…</> : <><Play size={17} /> Générer l’animation</>}
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
            <div><span>{status}</span><b>{Math.round(progress)}%</b></div>
            <div className="progress"><i style={{ width: `${progress}%` }} /></div>
          </div>
        )}
      </section>

      <footer>
        <span>Vos vidéos, images et audio restent dans votre navigateur.</span>
        <span>PoseTrace · 1080 × 1920 · WebM/MP4 selon navigateur</span>
      </footer>
    </main>
  );
}
