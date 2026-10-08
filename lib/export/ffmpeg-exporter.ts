import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let instance: FFmpeg | null = null;

/** Charge FFmpeg uniquement lorsque l'utilisateur demande un MP4. */
export async function loadFFmpeg() {
  if (instance) return instance;
  const ffmpeg = new FFmpeg();
  const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });
  instance = ffmpeg;
  return ffmpeg;
}

export async function convertWebmToMp4(video: Blob, audio?: File, onProgress?: (value: number) => void) {
  const ffmpeg = await loadFFmpeg();
  ffmpeg.on("progress", ({ progress }) => onProgress?.(Math.round(progress * 100)));
  await ffmpeg.writeFile("video.webm", await fetchFile(video));
  const args = ["-i", "video.webm"];
  if (audio) { await ffmpeg.writeFile("audio input", await fetchFile(audio)); args.push("-i", "audio input", "-map", "0:v:0", "-map", "1:a:0?"); }
  args.push("-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2", "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "output.mp4");
  await ffmpeg.exec(args);
  const data = await ffmpeg.readFile("output.mp4");
  return new Blob([data], { type: "video/mp4" });
}
