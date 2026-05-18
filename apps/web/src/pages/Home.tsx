import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface HealthStatus {
  status: string;
  db: string;
  redis: string;
}

function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<HealthStatus>('/health')
      .then((res) => setHealth(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">COMUNICA Social</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Plataforma de gestao de redes sociais
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase">
            Status da API
          </h2>

          {loading && <p className="text-sm text-muted-foreground">A verificar...</p>}

          {error && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span className="text-sm text-destructive">Offline: {error}</span>
            </div>
          )}

          {health && (
            <div className="space-y-2">
              <StatusRow label="API" status={health.status} />
              <StatusRow label="Base de dados" status={health.db} />
              <StatusRow label="Redis" status={health.redis} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, status }: { label: string; status: string }) {
  const isOk = status === 'ok' || status === 'ready';
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isOk ? 'bg-green-500' : 'bg-destructive'}`} />
        <span className={`text-xs ${isOk ? 'text-green-600' : 'text-destructive'}`}>{status}</span>
      </div>
    </div>
  );
}

export default Home;
