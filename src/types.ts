import type { Timestamp } from 'firebase/firestore';

export interface LogEntry {
  id: string;
  type: 'audio' | 'image';
  label: string;
  status: 'healthy' | 'unhealthy';
  confidence: number;
  description: string;
  timestamp: Timestamp | null;
}
