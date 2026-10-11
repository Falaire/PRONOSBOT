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
  createMultiPoseTransform,
  createSceneTransform,
  drawClassroomBackdrop,
  drawCodeCartoon,
  drawImageCover,
  drawTrackedCharacter,
  drawVideoBackground,
  estimatePoseScaleReference,
  mapPoseToCanvas,
  retargetPoseToSlot,
  type LandmarkPoint,
  type PoseScaleReference,
  type SceneTransform,
} from "@/lib/rendering/pose-renderer";
import { PoseTrackManager, type TrackedPose } from "@/lib/tracking/pose-tracker";
import { VIDEO_TO_VIDEO_MODELS } from "./models";
import { generateMuapiVideoToVideo, preflightMuapiVideo, type MuapiPreflight } from "./providers/muapi";
import RemoteGenerationPanel from "./components/RemoteGenerationPanel";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const RECORD_MIME_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp9", "video/webm", "video/mp4"];
const MODEL_LOAD_TIMEOUT_MS = 90_000;
const VIDEO_LIMIT = 500 * 1024 * 1024;
const IMAGE_LIMIT = 20 * 1024 * 1024;
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

type GenerationMode = "local-vector" | "muapi-v2v";
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
  background: "#f4f0e6",
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
        numPoses: 2,
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

export default function PoseTraceStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const characterInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const audioGraphRef = useRef<AudioGraph | null>(null);
  const audioDisabledRef = useRef(false);

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
  const [detectedPeople, setDetectedPeople] = useState(0);
  const [status, setStatus] = useState("Prêt à transformer");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [generationMode, setGenerationMode] = useState<GenerationMode>("local-vector");
  const [muapiKey, setMuapiKey] = useState("");
  const [muapiModel, setMuapiModel] = useState(VIDEO_TO_VIDEO_MODELS[0]?.id ?? "runway-aleph-v2v");
  const [muapiPrompt, setMuapiPrompt] = useState("Transforme les personnes en personnages stickman illustrés, traits noirs sur fond papier clair. Préserve la composition, le mouvement et la durée de la scène.");
  const [uploadConsent, setUploadConsent] = useState(false);
  const [freeOnlyConfirmed, setFreeOnlyConfirmed] = useState(false);
  const [muapiPreflight, setMuapiPreflight] = useState<MuapiPreflight | null>(null);
  const [checkingPreflight, setCheckingPreflight] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (characterUrl) URL.revokeObjectURL(characterUrl); }, [characterUrl]);
  useEffect(() => () => { if (backgroundUrl) URL.revokeObjectURL(backgroundUrl); }, [backgroundUrl]);
  useEffect(() => () => { if (outputUrl.startsWith("blob:")) URL.revokeObjectURL(outputUrl); }, [outputUrl]);
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
    setVideoDuration(0);
    setSourceUrl(URL.createObjectURL(selected));
    setOutputUrl("");
    setProgress(0);
    setDetectedPeople(0);
    setUploadConsent(false);
    setFreeOnlyConfirmed(false);
    setMuapiPreflight(null);
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
    setVideoDuration(0);
    setSourceUrl("");
    setOutputUrl("");
    setProgress(0);
    setDetectedPeople(0);
    setUploadConsent(false);
    setFreeOnlyConfirmed(false);
    setMuapiPreflight(null);
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
    setDetectedPeople(0);
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
      const streamTracks = [...canvasStream.getVideoTracks()];
      const audioTrack = graph?.destination.stream.getAudioTracks()[0];
      if (audioTrack) streamTracks.push(audioTrack);
      recordingStream = new MediaStream(streamTracks);

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

      const tracker = new PoseTrackManager({
        maxPeople: 2,
        maxOccludedFrames: 12,
        predictFrames: 3,
        smoothing: 0.75 - settings.smoothing / 100 * 0.55,
      });
      let tracks: TrackedPose[] = [];
      let sceneTransform: SceneTransform | null = null;
      const slotByTrack = new Map<number, number>();
      const anchorXByTrack = new Map<number, number>();
      const scaleReferenceByTrack = new Map<number, PoseScaleReference>();
      const stageCenterXByTrack = new Map<number, number>();
      let previousTimestamp = -1;
      let lastDisplayedProgress = -1;
      let lastReportedCount = -1;
      const audioBuffer = graph ? new Float32Array(graph.analyser.fftSize) : new Float32Array(0);
      let smoothedAudio = 0;

      const drawFrame = () => {
        const timestamp = video.currentTime * 1000;
        if (timestamp > previousTimestamp) {
          previousTimestamp = timestamp;
          try {
            const detections = landmarker.detectForVideo(video, timestamp).landmarks as LandmarkPoint[][];
            if (detections.length > 0) poseFrames += 1;
            tracks = tracker.update(detections);
            const visibleTracks = tracks.filter((track) => track.missedFrames === 0);
            const activeIds = new Set(tracks.map((track) => track.id));
            for (const id of slotByTrack.keys()) {
              if (!activeIds.has(id)) {
                slotByTrack.delete(id);
                anchorXByTrack.delete(id);
                scaleReferenceByTrack.delete(id);
                stageCenterXByTrack.delete(id);
              }
            }
            for (const track of visibleTracks) {
              if (!scaleReferenceByTrack.has(track.id)) {
                scaleReferenceByTrack.set(track.id, estimatePoseScaleReference(track.landmarks, video.videoWidth, video.videoHeight));
              }
            }
            if (settings.background === "video" && !sceneTransform && visibleTracks.length > 0) {
              sceneTransform = createMultiPoseTransform(
                video.videoWidth,
                video.videoHeight,
                canvas.width,
                canvas.height,
                visibleTracks.map((track) => track.landmarks),
              );
            }
            if (slotByTrack.size === 0 && visibleTracks.length >= 2) {
              [...visibleTracks].sort((a, b) => a.center.x - b.center.x).forEach((track, index) => {
                slotByTrack.set(track.id, index);
                anchorXByTrack.set(track.id, track.center.x);
              });
            } else {
              for (const track of visibleTracks) {
                if (slotByTrack.has(track.id)) continue;
                const occupied = new Set(slotByTrack.values());
                const freeSlot = [0, 1].find((slot) => !occupied.has(slot)) ?? (track.id % 2);
                slotByTrack.set(track.id, freeSlot);
                anchorXByTrack.set(track.id, track.center.x);
              }
            }
            const count = tracks.filter((track) => track.opacity > 0.35).length;
            if (count !== lastReportedCount) {
              lastReportedCount = count;
              setDetectedPeople(count);
            }
          } catch (cause) {
            console.warn("Une image vidéo n’a pas pu être analysée.", cause);
          }
        }

        const transform = sceneTransform ?? createSceneTransform(video.videoWidth, video.videoHeight, canvas.width, canvas.height, []);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (settings.background === "video") {
          ctx.fillStyle = "#f4f0e6";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          drawVideoBackground(ctx, video, transform);
        } else if (settings.background === "classroom") {
          drawClassroomBackdrop(ctx, canvas.width, canvas.height);
        } else if (settings.background === "image" && backgroundImage) {
          drawImageCover(ctx, backgroundImage, canvas.width, canvas.height);
        } else if (settings.background !== "transparent") {
          ctx.fillStyle = settings.background === "image" ? "#f4f0e6" : settings.background;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const audioLevel = graph ? measureAudioLevel(graph.analyser, audioBuffer) : 0;
        smoothedAudio += (audioLevel - smoothedAudio) * 0.38;
        const personCount = tracks.length;
        for (const track of tracks) {
          let mappedPose: LandmarkPoint[];
          if (settings.background === "video") {
            mappedPose = mapPoseToCanvas(track.landmarks, video.videoWidth, video.videoHeight, transform);
          } else {
            const slot = slotByTrack.get(track.id) ?? (track.id % 2);
            const targetCenterX = personCount > 1 ? (slot === 0 ? 0.24 : 0.76) : 0.5;
            const currentCenterX = stageCenterXByTrack.get(track.id) ?? (personCount > 1 ? targetCenterX : 0.5);
            const nextCenterX = currentCenterX + (targetCenterX - currentCenterX) * 0.12;
            stageCenterXByTrack.set(track.id, Math.abs(targetCenterX - nextCenterX) < 0.001 ? targetCenterX : nextCenterX);
            mappedPose = retargetPoseToSlot(
              track.landmarks,
              video.videoWidth,
              video.videoHeight,
              canvas.width,
              canvas.height,
              slot,
              personCount,
              anchorXByTrack.get(track.id) ?? track.center.x,
              scaleReferenceByTrack.get(track.id),
              nextCenterX,
            );
          }
          const renderSettings = {
            outlineColor: settings.outlineColor,
            headScale: settings.headScale,
            characterScale: settings.characterScale,
            characterOffsetX: settings.characterOffsetX,
            characterOffsetY: settings.characterOffsetY,
            // Variation stable par ID pour distinguer les deux pistes dans ce prototype.
            accessory: track.id % 2 === 1 ? "scarf" as const : "glasses" as const,
          };
          ctx.save();
          ctx.globalAlpha *= track.opacity;
          if (settings.visualMode === "custom" && characterImage) {
            drawTrackedCharacter(ctx, characterImage, mappedPose, renderSettings);
          } else {
            drawCodeCartoon(ctx, mappedPose, renderSettings, timestamp, smoothedAudio);
          }
          ctx.restore();
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

  const checkRemotePreflight = useCallback(async () => {
    if (!file) return;
    const durationSeconds = videoDuration || videoRef.current?.duration;
    if (!Number.isFinite(durationSeconds) || !durationSeconds || durationSeconds <= 0) {
      setError("La durée de la vidéo doit être lisible avant le contrôle des crédits.");
      return;
    }
    setCheckingPreflight(true);
    setError("");
    setMuapiPreflight(null);
    setStatus("Contrôle du coût et des crédits; aucun média n’est envoyé…");
    try {
      const preflight = await preflightMuapiVideo({
        apiKey: muapiKey,
        modelId: muapiModel,
        prompt: muapiPrompt,
        durationSeconds: Math.ceil(durationSeconds),
        uploadConfirmed: uploadConsent,
        freeOnlyConfirmed,
      });
      setMuapiPreflight(preflight);
      setStatus("Devis contrôlé. Aucun média n’a encore quitté le navigateur.");
      setProgress(0);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Contrôle du fournisseur impossible.";
      setError(detail);
      setStatus("Préflight arrêté · aucun fichier envoyé");
    } finally {
      setCheckingPreflight(false);
    }
  }, [file, videoDuration, muapiKey, muapiModel, muapiPrompt, uploadConsent, freeOnlyConfirmed]);

  const generateRemote = useCallback(async () => {
    if (!file) return;
    if (!muapiPreflight) {
      setError("Vérifiez d’abord le coût et le solde; aucune vidéo n’a été envoyée.");
      return;
    }
    const reviewedPreflight = muapiPreflight;
    const durationSeconds = videoDuration || videoRef.current?.duration;
    if (!Number.isFinite(durationSeconds) || !durationSeconds || durationSeconds <= 0) {
      setError("La durée de la vidéo doit être lisible avant le contrôle des crédits.");
      return;
    }
    setProcessing(true);
    setError("");
    setOutputUrl("");
    setProgress(0);
    setStatus("Revalidation du devis et du solde gratuits…");
    try {
      const result = await generateMuapiVideoToVideo({
        apiKey: muapiKey,
        file,
        modelId: muapiModel,
        prompt: muapiPrompt,
        durationSeconds: Math.ceil(durationSeconds),
        uploadConfirmed: uploadConsent,
        freeOnlyConfirmed,
        reviewedPreflight,
        onStatus: setStatus,
        onProgress: setProgress,
        onPreflight: setMuapiPreflight,
      });
      setMuapiPreflight(result.preflight);
      setOutputName("posetrace-muapi-v2v.mp4");
      setOutputUrl(result.url);
      setProgress(100);
      setStatus("Génération MuAPI terminée · résultat distant");
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Erreur distante inconnue.";
      setError(detail);
      setStatus("Génération distante arrêtée");
    } finally {
      setProcessing(false);
    }
  }, [file, videoDuration, muapiKey, muapiModel, muapiPrompt, uploadConsent, freeOnlyConfirmed, muapiPreflight]);

  const canGenerateLocal = Boolean(file) && !processing && (settings.visualMode !== "custom" || Boolean(characterImage));
  const remoteInputsReady = file !== null
    && Boolean(muapiKey.trim() && muapiPrompt.trim() && uploadConsent && freeOnlyConfirmed && videoDuration > 0)
    && file.size <= 100 * 1024 * 1024;
  const canCheckPreflight = remoteInputsReady && !processing && !checkingPreflight;
  const canGenerateRemote = remoteInputsReady && Boolean(muapiPreflight) && !processing && !checkingPreflight;
  const canGenerate = generationMode === "local-vector" ? canGenerateLocal : canGenerateRemote;
  const generateSelectedMode = generationMode === "local-vector" ? generate : generateRemote;

  return (
    <main className="app-shell">
      <header>
        <div className="brand">
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span>POSE<span className="accent">TRACE</span></span>
        </div>
        <span className="privacy"><ShieldCheck size={15} /> {generationMode === "local-vector" ? "Mode local · aucun téléversement" : "Mode cloud · envoi explicite à MuAPI"}</span>
      </header>

      <section className="hero">
        <div className="eyebrow">POSETRACE STUDIO · VIDÉO VERS ANIMATION</div>
        <h1>Une conversation,<br /><em>{generationMode === "local-vector" ? "deux cartoons animés." : "une transformation IA."}</em></h1>
        <p>
          {generationMode === "local-vector"
            ? "Le navigateur détecte jusqu’à deux personnes et anime des personnages vectoriels sur papier clair, sans téléverser la vidéo."
            : "Un modèle vidéo-à-vidéo distant transforme le clip à partir de votre consigne. Cette voie est générative : la fidélité des personnages et la stabilité image par image ne sont pas garanties."}
        </p>
      </section>

      <section className="workspace">
        <div className="mode-picker workflow-picker" role="group" aria-label="Pipeline de traitement">
          <button type="button" className={`mode-card ${generationMode === "local-vector" ? "selected" : ""}`} aria-pressed={generationMode === "local-vector"} onClick={() => setGenerationMode("local-vector")} disabled={processing}>
            <span className="mode-icon cartoon-icon" aria-hidden="true">◎</span>
            <span><strong>Studio vectoriel local</strong><small>MediaPipe + retargeting Canvas · aucun média envoyé.</small></span>
          </button>
          <button type="button" className={`mode-card ${generationMode === "muapi-v2v" ? "selected" : ""}`} aria-pressed={generationMode === "muapi-v2v"} onClick={() => setGenerationMode("muapi-v2v")} disabled={processing}>
            <span className="mode-icon custom-icon" aria-hidden="true"><Sparkles size={21} /></span>
            <span><strong>Studio vidéo-à-vidéo IA</strong><small>MuAPI · téléversement distant après accord et préflight.</small></span>
          </button>
        </div>

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
              <small>ou cliquez pour parcourir · MP4, WebM, MOV · {generationMode === "muapi-v2v" ? "100 Mo max pour MuAPI" : "500 Mo max en local"}</small>
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

        {generationMode === "muapi-v2v" && (
          <RemoteGenerationPanel
            disabled={processing}
            modelId={muapiModel}
            onModelChange={(value) => { setMuapiModel(value); setMuapiPreflight(null); }}
            apiKey={muapiKey}
            onApiKeyChange={(value) => { setMuapiKey(value); setMuapiPreflight(null); }}
            prompt={muapiPrompt}
            onPromptChange={(value) => { setMuapiPrompt(value); setMuapiPreflight(null); }}
            uploadConsent={uploadConsent}
            onUploadConsentChange={(value) => { setUploadConsent(value); setMuapiPreflight(null); }}
            freeOnlyConfirmed={freeOnlyConfirmed}
            onFreeOnlyConfirmedChange={(value) => { setFreeOnlyConfirmed(value); setMuapiPreflight(null); }}
            preflight={muapiPreflight}
            canCheckPreflight={canCheckPreflight}
            checkingPreflight={checkingPreflight}
            onCheckPreflight={checkRemotePreflight}
          />
        )}

        <div className="previews">
          <div className="preview-card">
            <div className="card-title">
              <span>VIDÉO SOURCE</span>
              {file && <span className="live-dot">● {generationMode === "local-vector" ? "LOCALE" : "FICHIER LOCAL"}</span>}
            </div>
            <div className="media">
              <video ref={videoRef} src={sourceUrl || undefined} controls={!!file} muted playsInline onLoadedMetadata={(event) => setVideoDuration(event.currentTarget.duration)} />
            </div>
          </div>
          <div className="preview-card">
            <div className="card-title">
              <span>{generationMode === "local-vector" ? "APERÇU VERTICAL · 9:16" : "APERÇU IA · RATIO 9:16 DEMANDÉ"}</span>
              {detectedPeople > 0 && <span className="done">● {detectedPeople} PISTE{detectedPeople > 1 ? "S" : ""}</span>}
              {outputUrl && detectedPeople === 0 && <span className="done">● TERMINÉ</span>}
            </div>
            <div className="media output-media">
              {outputUrl ? (
                <video src={outputUrl} controls autoPlay loop playsInline />
              ) : (
                <>
                  {generationMode === "local-vector"
                    ? <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
                    : <div className="remote-output-placeholder"><Sparkles size={24} /><span>Le rendu vidéo-à-vidéo apparaîtra ici après traitement par MuAPI.</span></div>}
                  {!processing && <span className="empty">Votre animation apparaîtra ici</span>}
                </>
              )}
            </div>
          </div>
        </div>

        {generationMode === "local-vector" && (
        <aside className="controls">
          <div className="controls-heading">
            <SlidersHorizontal size={18} />
            <strong>Choisissez votre personnage</strong>
            <span>2 PERSONNES · PROTOTYPE</span>
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
                <option value="#f4f0e6">Papier clair</option>
                <option value="#050505">Noir profond</option>
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
        )}

        {error && <div className="error" role="alert">{error}</div>}
        {generationMode === "local-vector" && settings.visualMode === "custom" && !characterImage && (
          <div className="hint">Pour utiliser « Mes images », importez d’abord un personnage PNG avec un fond transparent.</div>
        )}
        {generationMode === "muapi-v2v" && file && file.size > 100 * 1024 * 1024 && (
          <div className="hint">La voie MuAPI est limitée à 100 Mo par vidéo dans ce prototype; le mode local reste disponible jusqu’à 500 Mo.</div>
        )}

        <div className="actions">
          <button className="primary" disabled={!canGenerate} onClick={generateSelectedMode}>
            {processing
              ? <><Loader2 className="spin" size={17} /> {generationMode === "muapi-v2v" ? "Préflight / génération MuAPI…" : "Traitement local…"}</>
              : <><Play size={17} /> {generationMode === "muapi-v2v"
                ? (muapiPreflight ? "Revalider puis envoyer à MuAPI" : "Vérifiez le devis avant l’envoi")
                : "Générer localement"}</>}
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

        {(processing || checkingPreflight || progress > 0) && (
          <div className="progress-wrap">
            <div><span>{status}</span><b>{Math.round(progress)}%</b></div>
            <div className="progress"><i style={{ width: `${progress}%` }} /></div>
          </div>
        )}
      </section>

      <footer>
        <span>{generationMode === "local-vector" ? "Mode local : vos médias restent dans le navigateur." : "Mode MuAPI : envoi uniquement après votre accord, vers le fournisseur distant."}</span>
        <span>{generationMode === "local-vector" ? "PoseTrace Studio · 1080 × 1920 · capture locale 30 fps" : "PoseTrace Studio · ratio 9:16 demandé · résolution et cadence selon le modèle"}</span>
      </footer>
    </main>
  );
}
