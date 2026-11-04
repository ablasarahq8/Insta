// دمج طبقة النص (PNG شفاف) فوق فيديو الستوري — ffmpeg مضمّن مع المشروع
import { execFile } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

// يقص الفيديو ٩:١٦ (١٠٨٠×١٩٢٠) ويحط الطبقة فوقه، وأقصى شي ٦٠ ثانية (حد الستوري)
export function overlayVideo(videoIn, overlayPng, out) {
  const args = [
    "-y", "-i", videoIn, "-i", overlayPng,
    "-filter_complex",
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];[bg][1:v]overlay=0:0,format=yuv420p[v]",
    "-map", "[v]", "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-t", "60",
    out,
  ];
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { maxBuffer: 10 * 1024 * 1024 }, (err, _stdout, stderr) =>
      err ? reject(new Error(`فشل تجهيز الفيديو: ${stderr.split("\n").slice(-3).join(" ")}`)) : resolve(out));
  });
}
