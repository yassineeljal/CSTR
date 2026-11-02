import type { Metadata } from 'next';
import { DebugPanel } from '@/components/scada/DebugPanel';

export const metadata: Metadata = { title: 'Debug moteur — CSTR Digital Twin' };

export default function DebugPage() {
  return <DebugPanel />;
}
