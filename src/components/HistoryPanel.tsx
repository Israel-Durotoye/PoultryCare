import { Mic, Image as ImageIcon, X, Clock, Trash2, Download, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { generateReport } from '../utils/generateReport';
import { useState } from 'react';
import { toast } from 'sonner';
import type { LogEntry } from '../types';

interface HistoryPanelProps {
  open: boolean;
  logs: LogEntry[];
  onClose: () => void;
}

function formatTime(ts: LogEntry['timestamp']): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Just now';
  return ts.toDate().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryPanel({ open, logs, onClose }: HistoryPanelProps) {
  const { currentUser } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!currentUser || logs.length === 0) return;
    setDownloading(true);
    const toastId = toast.loading('Generating PDF report…');
    try {
      await generateReport(logs, currentUser.email ?? 'Unknown');
      toast.success('Report downloaded! 📄', { id: toastId });
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate report. See console for details.', { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentUser) return;
    await deleteDoc(doc(db, 'users', currentUser.uid, 'logs', id));
  };

  if (!open) return null;

  const sortedLogs = [...logs].reverse();

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-bold text-foreground text-sm">Analysis History</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {logs.length} record{logs.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Download Report button */}
          <button
            id="download-report-btn"
            onClick={handleDownload}
            disabled={downloading || logs.length === 0}
            title={logs.length === 0 ? 'Run an analysis first' : 'Download PDF report'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 hover:border-primary/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {downloading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />
            }
            <span className="hidden sm:inline">{downloading ? 'Building…' : 'PDF'}</span>
          </button>

          <button
            id="close-history-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stat chips */}
      {logs.length > 0 && (
        <div className="px-4 py-3 border-b border-border/50 flex gap-2 shrink-0">
          <div className="flex-1 rounded-xl bg-primary/8 border border-primary/20 p-2.5 text-center">
            <p className="text-base font-bold text-primary">{logs.filter(l => l.type === 'audio').length}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Audio</p>
          </div>
          <div className="flex-1 rounded-xl bg-destructive/8 border border-destructive/20 p-2.5 text-center">
            <p className="text-base font-bold text-destructive">{logs.filter(l => l.type === 'image').length}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Image</p>
          </div>
          <div className="flex-1 rounded-xl bg-success/8 border border-success/20 p-2.5 text-center">
            <p className="text-base font-bold text-success">{logs.filter(l => l.status === 'healthy').length}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Healthy</p>
          </div>
        </div>
      )}

      {/* Log list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-16">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
              <Clock className="h-6 w-6 opacity-50" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">No history yet</p>
              <p className="text-xs mt-1 opacity-70">Analyses will appear here</p>
            </div>
          </div>
        ) : (
          sortedLogs.map((log) => (
            <div
              key={log.id}
              className="group rounded-2xl border border-border bg-background p-3.5 space-y-2 hover:border-primary/30 hover:shadow-soft transition-all duration-200"
            >
              {/* Top row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${
                      log.type === 'audio'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {log.type === 'audio'
                      ? <Mic className="h-3 w-3" />
                      : <ImageIcon className="h-3 w-3" />
                    }
                  </div>
                  <span className="text-xs font-semibold text-foreground capitalize">
                    {log.type === 'audio' ? 'Audio' : 'Image'}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(log.id)}
                  title="Delete entry"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {/* Label + confidence */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold uppercase tracking-wide ${
                    log.status === 'healthy' ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {log.label}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {(log.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>

              {/* Confidence bar */}
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${log.status === 'healthy' ? 'bg-success' : 'bg-destructive'}`}
                  style={{ width: `${(log.confidence * 100).toFixed(0)}%` }}
                />
              </div>

              {/* Timestamp */}
              <p className="text-[10px] text-muted-foreground">{formatTime(log.timestamp)}</p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
