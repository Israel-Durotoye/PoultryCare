import { useState, useRef, useEffect } from "react";
import {
  Mic, Image as ImageIcon, Stethoscope, Activity,
  History, BarChart2, ShieldCheck, AlertTriangle,
  CalendarDays, FlaskConical, Square, Download, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/UploadZone";
import { Spinner, Waveform } from "@/components/Spinner";
import { ResultCard, type DiagnosisResult } from "@/components/ResultCard";
import { LiveGraph } from "@/components/LiveGraph";
import { HistoryPanel } from "@/components/HistoryPanel";
import { UserMenu } from "@/components/UserMenu";
import { toast, Toaster } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/firebase";
import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp
} from "firebase/firestore";
import type { LogEntry } from "@/types";
import { generateReport } from "@/utils/generateReport";

const API_BASE_URL = "https://israel-durotoye-cluckcare-api.hf.space";

interface ApiResponse {
  status: string;
  prediction: string;
  message: string;
  confidence?: number;
}

/* ── WAV helpers ──────────────────────────────────────────── */
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
};
const encodeWAV = (samples: Float32Array, sampleRate: number): Blob => {
  const bufLen = samples.length * 2;
  const buf = new ArrayBuffer(44 + bufLen);
  const view = new DataView(buf);
  writeString(view, 0, "RIFF"); view.setUint32(4, 36 + bufLen, true);
  writeString(view, 8, "WAVE"); writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); writeString(view, 36, "data");
  view.setUint32(40, bufLen, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
};
/* ──────────────────────────────────────────────────────────── */

/* ── Stat card component ──────────────────────────────────── */
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
  variant: "primary" | "success" | "danger" | "neutral";
}
function StatCard({ icon: Icon, label, value, sub, variant }: StatCardProps) {
  const colors = {
    primary: "bg-primary/8 text-primary border-primary/15",
    success: "bg-success/8 text-success border-success/15",
    danger:  "bg-destructive/8 text-destructive border-destructive/15",
    neutral: "bg-muted text-muted-foreground border-border",
  };
  const iconBg = {
    primary: "bg-primary/12 text-primary",
    success: "bg-success/12 text-success",
    danger:  "bg-destructive/12 text-destructive",
    neutral: "bg-muted-foreground/10 text-muted-foreground",
  };
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-4 transition-all hover:shadow-soft ${colors[variant]}`}>
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg[variant]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-foreground leading-none">{value}</p>
        <p className="text-xs font-semibold mt-0.5 opacity-80 truncate">{label}</p>
        {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
/* ──────────────────────────────────────────────────────────── */

const Index = () => {
  const { currentUser } = useAuth();

  /* ── Audio ─────────────────────────────────────────────── */
  const [audioFile, setAudioFile]     = useState<File | null>(null);
  const [audioResult, setAudioResult] = useState<DiagnosisResult | null>(null);
  const [analyzingAudio, setAnalyzingAudio] = useState(false);

  /* ── Recording ─────────────────────────────────────────── */
  const [isRecording, setIsRecording]       = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const processorRef   = useRef<ScriptProcessorNode | null>(null);
  const srcRef         = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const chunksRef      = useRef<Float32Array[]>([]);
  const sampleRateRef  = useRef<number>(44100);
  const timerRef       = useRef<number | null>(null);

  /* ── Image ─────────────────────────────────────────────── */
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imageResult, setImageResult] = useState<DiagnosisResult | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);

  /* ── UI ─────────────────────────────────────────────────── */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [downloading, setDownloading]  = useState(false);

  /* ── Firestore logs ─────────────────────────────────────── */
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => () => cleanupRecording(), []);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "users", currentUser.uid, "logs"), orderBy("timestamp", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LogEntry)));
      },
      (err) => {
        console.error("[Firestore] onSnapshot error:", err);
        toast.error("Couldn't load history — check Firestore rules in Firebase Console.", { id: "firestore-read-err", duration: 8000 });
      }
    );
  }, [currentUser]);

  /* ── Derived stats ─────────────────────────────────────── */
  const todayStr   = new Date().toDateString();
  const todayCount = logs.filter((l) => l.timestamp?.toDate?.().toDateString() === todayStr).length;
  const healthyCount = logs.filter((l) => l.status === "healthy").length;
  const flaggedCount = logs.filter((l) => l.status === "unhealthy").length;

  /* ── PDF download handler ───────────────────────────────── */
  const handleDownloadReport = async () => {
    if (!currentUser || logs.length === 0) return;
    setDownloading(true);
    const id = toast.loading('Generating PDF report…');
    try {
      await generateReport(logs, currentUser.email ?? 'Unknown');
      toast.success('Report downloaded! 📄', { id });
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate report', { id });
    } finally {
      setDownloading(false);
    }
  };

  /* ── Recording helpers ─────────────────────────────────── */
  const cleanupRecording = () => {
    if (timerRef.current)    { clearInterval(timerRef.current); timerRef.current = null; }
    processorRef.current?.disconnect();
    if (processorRef.current) { processorRef.current.onaudioprocess = null; processorRef.current = null; }
    srcRef.current?.disconnect(); srcRef.current = null;
    audioCtxRef.current?.close(); audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      sampleRateRef.current = ctx.sampleRate;
      const src = ctx.createMediaStreamSource(stream);
      srcRef.current = src;
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = proc;
      chunksRef.current = [];
      setRecordingSeconds(0);
      setIsRecording(true);
      proc.onaudioprocess = (e) => chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      src.connect(proc);
      proc.connect(ctx.destination);
      let s = 0;
      timerRef.current = window.setInterval(() => { s++; setRecordingSeconds(s); if (s >= 10) stopAndSave(); }, 1000);
    } catch { toast.error("Microphone access denied or not supported."); }
  };

  const stopAndSave = () => {
    setIsRecording(false);
    const chunks = chunksRef.current;
    const sr = sampleRateRef.current;
    cleanupRecording();
    if (!chunks.length) { toast.error("No audio captured."); return; }
    let total = 0; chunks.forEach((c) => (total += c.length));
    const merged = new Float32Array(total);
    let off = 0; chunks.forEach((c) => { merged.set(c, off); off += c.length; });
    setAudioFile(new File([encodeWAV(merged, sr)], "recorded.wav", { type: "audio/wav" }));
    setAudioResult(null);
    toast.success("Audio captured! 🎤");
  };

  /* ── API & Firestore ───────────────────────────────────── */
  const callApi = async (endpoint: string, file: File): Promise<ApiResponse> => {
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST", body: fd,
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    if (!res.ok) throw new Error(`Server ${res.status}`);
    return res.json() as Promise<ApiResponse>;
  };

  const saveLog = async (type: "audio" | "image", r: DiagnosisResult) => {
    if (!currentUser) {
      console.warn("[Firestore] saveLog: no currentUser, skipping");
      return;
    }
    try {
      await addDoc(collection(db, "users", currentUser.uid, "logs"), {
        type,
        label: r.label,
        status: r.status,
        confidence: r.confidence,
        description: r.description,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("[Firestore] saveLog failed:", err);
      const code = (err as { code?: string })?.code ?? "";
      const hint =
        code === "permission-denied"
          ? "Firestore rules are blocking writes. Go to Firebase Console → Firestore → Rules and allow authenticated users."
          : code === "not-found"
          ? "Firestore database not found. Go to Firebase Console → Firestore Database → Create Database."
          : `Firestore error (${code || "unknown"}). Check the browser console for details.`;
      toast.error(hint, { id: "firestore-write-err", duration: 10000 });
    }
  };

  const handleAnalyzeAudio = async () => {
    if (!audioFile) { toast.error("Please upload or record audio first"); return; }
    setAnalyzingAudio(true); setAudioResult(null);
    try {
      const data = await callApi("/analyze-audio", audioFile);
      const isUnhealthy = data.prediction.toLowerCase() !== "healthy";
      const confidence = typeof data.confidence === "number" ? data.confidence / 100 : 0;
      const r: DiagnosisResult = { label: data.prediction, status: isUnhealthy ? "unhealthy" : "healthy", confidence, description: data.message };
      // Show result immediately — saveLog is fire-and-forget with its own error handling
      setAudioResult(r);
      saveLog("audio", r); // intentionally not awaited here so UI never blocks on Firestore
      if (!isUnhealthy) toast.success("Bird appears healthy 🐔");
      else toast.warning("Audio flagged — consider a stool scan.");
    } catch (err) { toast.error(`Audio analysis failed: ${err instanceof Error ? err.message : "Network error"}`); }
    finally { setAnalyzingAudio(false); }
  };

  const handleAnalyzeImage = async () => {
    if (!imageFile) { toast.error("Please upload a stool image first"); return; }
    setAnalyzingImage(true); setImageResult(null);
    try {
      const data = await callApi("/analyze-image", imageFile);
      const isUnhealthy = data.prediction.toLowerCase() !== "healthy";
      const confidence = typeof data.confidence === "number" ? data.confidence / 100 : 0.9;
      const r: DiagnosisResult = { label: data.prediction, status: isUnhealthy ? "unhealthy" : "healthy", confidence, description: data.message };
      // Show result immediately — saveLog is fire-and-forget with its own error handling
      setImageResult(r);
      saveLog("image", r); // intentionally not awaited here so UI never blocks on Firestore
    } catch (err) { toast.error(`Image analysis failed: ${err instanceof Error ? err.message : "Network error"}`); }
    finally { setAnalyzingImage(false); }
  };

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Toaster position="top-center" richColors />

      {/* ══ Header ══════════════════════════════════════════ */}
      <header className="shrink-0 border-b border-border/60 bg-card/80 backdrop-blur-xl z-30 px-6 py-3 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-soft shrink-0">
            <svg viewBox="0 0 32 32" className="h-6 w-6 text-primary" fill="currentColor">
              <path d="M16 2a10 10 0 0 0-8.56 15.18l-1.12 1.9a1.5 1.5 0 0 0 1.3 2.27h1.43c1.08 2.85 3.82 4.65 6.95 4.65s5.87-1.8 6.95-4.65h1.43a1.5 1.5 0 0 0 1.3-2.27l-1.12-1.9A10 10 0 0 0 16 2z" />
              <circle cx="12" cy="12" r="1.5" fill="white" />
              <circle cx="20" cy="12" r="1.5" fill="white" />
              <path d="M13 3.5c0-1.5 1-2 1-2s1 .5 1 2M17 3.5c0-1.5 1-2 1-2s1 .5 1 2" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M15 14.5l1 2 1-2h-2z" fill="#F59E0B" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-foreground text-base leading-tight">CluckCare</p>
            <p className="text-[10px] text-muted-foreground">Poultry Health Diagnostics</p>
          </div>
        </div>

        <div className="flex-1" />

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-semibold border border-success/20">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          AI Online
        </div>

        <button
          id="toggle-history-btn"
          onClick={() => setHistoryOpen(!historyOpen)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
            historyOpen ? "bg-primary/10 border-primary/30 text-primary" : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">History</span>
          {logs.length > 0 && (
            <span className="h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {logs.length > 99 ? "99+" : logs.length}
            </span>
          )}
        </button>

        <UserMenu />
      </header>

      {/* ══ Body ════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-6">
          <div className="max-w-[1800px] mx-auto space-y-6">

            {/* ── Dashboard heading ──────────────────────── */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-foreground">Dashboard</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Monitor your flock's health in real time</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-xl border border-border">
                <CalendarDays className="h-3.5 w-3.5" />
                {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
              </div>
            </div>

            {/* ── Stat cards ─────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={FlaskConical}    label="Total Analyses" value={logs.length}    sub="All time"        variant="primary" />
              <StatCard icon={ShieldCheck}     label="Healthy"        value={healthyCount}   sub="Cleared checks"  variant="success" />
              <StatCard icon={AlertTriangle}   label="Flagged"        value={flaggedCount}   sub="Need attention"  variant="danger"  />
              <StatCard icon={CalendarDays}    label="Today's Scans"  value={todayCount}     sub="Since midnight"  variant="neutral" />
            </div>

            {/* ── Analysis panels ────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

              {/* Audio Analysis */}
              <div className="rounded-2xl bg-card border border-border shadow-elegant overflow-hidden flex flex-col">
                {/* Panel title bar */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60 bg-muted/20">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground text-sm">Audio Analysis</h3>
                    <p className="text-[11px] text-muted-foreground">Upload or record chicken sounds</p>
                  </div>
                  {audioResult && (
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                      audioResult.status === "healthy"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-destructive/10 text-destructive border-destructive/20 animate-pulse"
                    }`}>
                      {audioResult.status === "healthy" ? "✓ Healthy" : "⚠ Flagged"}
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-4 flex-1 flex flex-col">
                  {/* Upload zone */}
                  <UploadZone
                    accept="audio/wav,.wav"
                    acceptLabel=".wav up to 20MB"
                    icon={<Mic className="h-6 w-6" />}
                    title="Upload chicken audio"
                    subtitle="Drag & drop a .wav recording here"
                    file={audioFile}
                    onFileChange={(f) => { setAudioFile(f); setAudioResult(null); }}
                    preview="audio"
                  />

                  {/* Mic record row */}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/40 border border-border/60">
                    <span className="text-xs text-muted-foreground flex-1">Or record live (10s)</span>

                    {!isRecording ? (
                      /* ── Idle: just the mic icon ── */
                      <button
                        id="start-record-btn"
                        onClick={startRecording}
                        disabled={analyzingAudio}
                        title="Start 10s recording"
                        className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
                      >
                        <Mic className="h-4.5 w-4.5" />
                      </button>
                    ) : (
                      /* ── Recording: waveform + timer + stop ── */
                      <div className="flex items-center gap-3">
                        {/* Waveform bars */}
                        <div className="flex items-end gap-[3px] h-5">
                          {[0.1, 0.3, 0.0, 0.2, 0.4].map((delay, i) => (
                            <div
                              key={i}
                              className={`w-[3px] bg-destructive rounded-full animate-bounce ${
                                i === 0 ? "h-2" : i === 1 ? "h-4" : i === 2 ? "h-5" : i === 3 ? "h-3" : "h-4"
                              }`}
                              style={{ animationDelay: `${delay}s` }}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-destructive tabular-nums">{recordingSeconds}s</span>
                        {/* Stop button */}
                        <button
                          id="stop-record-btn"
                          onClick={stopAndSave}
                          title="Stop recording"
                          className="h-9 w-9 rounded-full bg-destructive text-white flex items-center justify-center cursor-pointer hover:bg-destructive/90 transition-all shadow-sm"
                        >
                          <Square className="h-3.5 w-3.5 fill-current" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Analyze button */}
                  <Button
                    id="analyze-audio-btn"
                    onClick={handleAnalyzeAudio}
                    disabled={analyzingAudio || !audioFile || isRecording}
                    size="lg"
                    className="w-full bg-gradient-primary hover:opacity-95 text-primary-foreground font-semibold rounded-xl h-11 shadow-soft hover:shadow-glow transition-all cursor-pointer"
                  >
                    {analyzingAudio
                      ? <><Waveform /><span className="ml-3">Analyzing audio…</span></>
                      : <><Activity className="h-4 w-4 mr-2" />Analyze Audio</>
                    }
                  </Button>

                  {/* Inline result */}
                  {audioResult && !analyzingAudio && (
                    <div className="pt-4 border-t border-dashed border-border animate-fade-in-up">
                      <ResultCard title="Audio Result" result={audioResult} />
                    </div>
                  )}
                </div>
              </div>

              {/* Disease Diagnosis */}
              <div className="rounded-2xl bg-card border border-border shadow-elegant overflow-hidden flex flex-col">
                {/* Panel title bar */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60 bg-muted/20">
                  <div className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground text-sm">Disease Diagnosis</h3>
                    <p className="text-[11px] text-muted-foreground">Upload a stool sample for visual analysis</p>
                  </div>
                  {imageResult && (
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                      imageResult.status === "healthy"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-destructive/10 text-destructive border-destructive/20 animate-pulse"
                    }`}>
                      {imageResult.status === "healthy" ? "✓ Healthy" : "⚠ Flagged"}
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-4 flex-1 flex flex-col">
                  <UploadZone
                    accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                    acceptLabel="JPG / PNG"
                    icon={<ImageIcon className="h-6 w-6" />}
                    title="Upload stool sample image"
                    subtitle="Clear, well-lit photo works best"
                    file={imageFile}
                    onFileChange={(f) => { setImageFile(f); setImageResult(null); }}
                    preview="image"
                  />

                  {/* Analyze button */}
                  <Button
                    id="analyze-image-btn"
                    onClick={handleAnalyzeImage}
                    disabled={analyzingImage || !imageFile}
                    size="lg"
                    className="w-full bg-gradient-danger hover:opacity-95 text-destructive-foreground font-semibold rounded-xl h-11 shadow-soft hover:shadow-glow transition-all cursor-pointer"
                  >
                    {analyzingImage
                      ? <><Spinner className="h-5 w-5" /><span className="ml-3">Analyzing…</span></>
                      : <><Stethoscope className="h-4 w-4 mr-2" />Analyze Stool Sample</>
                    }
                  </Button>

                  {/* Inline result */}
                  {imageResult && !analyzingImage && (
                    <div className="pt-4 border-t border-dashed border-border animate-fade-in-up">
                      <ResultCard title="Disease Diagnosis" result={imageResult} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Live Analytics ──────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-foreground text-sm">Live Analytics</h3>
                  <span className="text-[10px] text-muted-foreground font-medium px-2 py-0.5 bg-muted rounded-full border border-border">
                    Updates automatically
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">{logs.length} data point{logs.length !== 1 ? "s" : ""}</p>
                  {/* Download Report CTA */}
                  <button
                    id="download-report-main-btn"
                    onClick={handleDownloadReport}
                    disabled={downloading || logs.length === 0}
                    title={logs.length === 0 ? 'Run an analysis first to generate a report' : 'Download full PDF report'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-soft hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {downloading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Download className="h-3.5 w-3.5" />
                    }
                    {downloading ? 'Building…' : 'Download Report'}
                  </button>
                </div>
              </div>
              <LiveGraph logs={logs} />
            </div>

            {/* Footer */}
            <footer className="text-center text-xs text-muted-foreground pb-6 pt-2">
              Demo diagnostics · Always confirm findings with a licensed veterinarian
            </footer>
          </div>
        </main>

        {/* History sidebar */}
        <HistoryPanel open={historyOpen} logs={logs} onClose={() => setHistoryOpen(false)} />
      </div>
    </div>
  );
};

export default Index;
