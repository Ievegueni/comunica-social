import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, Check, Clock } from 'lucide-react';

interface AIJob {
  id: string;
  briefing: string;
  tone: string;
  count: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  result: Array<{ content: string; hashtags: string[]; suggestedTime?: string }> | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface SocialAccount {
  id: string;
  platform: string;
  name: string;
  status: string;
}

const toneOptions = [
  'Profissional',
  'Casual',
  'Humoristico',
  'Informativo',
  'Inspirador',
  'Promocional',
  'Educativo',
];

export default function AIGenerate() {
  const queryClient = useQueryClient();
  const [briefing, setBriefing] = useState('');
  const [tone, setTone] = useState('Profissional');
  const [count, setCount] = useState(5);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<number[]>([]);
  const [acceptAccountId, setAcceptAccountId] = useState('');
  const [intervalHours, setIntervalHours] = useState(24);

  const { data: accounts = [] } = useQuery<SocialAccount[]>({
    queryKey: ['social-accounts'],
    queryFn: async () => (await api.get('/social-accounts')).data,
  });

  const { data: activeJob } = useQuery<AIJob>({
    queryKey: ['ai-job', activeJobId],
    queryFn: async () => (await api.get(`/ai/jobs/${activeJobId}`)).data,
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && ['PENDING', 'PROCESSING'].includes(data.status)) return 2000;
      return false;
    },
  });

  const { data: jobs = [] } = useQuery<AIJob[]>({
    queryKey: ['ai-jobs'],
    queryFn: async () => (await api.get('/ai/jobs')).data,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/ai/generate', { briefing, tone, count });
      return res.data;
    },
    onSuccess: (data) => {
      setActiveJobId(data.id);
      setSelectedPosts([]);
      queryClient.invalidateQueries({ queryKey: ['ai-jobs'] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      return (
        await api.post(`/ai/jobs/${activeJobId}/accept`, {
          postIds: selectedPosts.length > 0 ? selectedPosts : undefined,
          socialAccountId: acceptAccountId,
          intervalHours,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setActiveJobId(null);
      setSelectedPosts([]);
      setBriefing('');
    },
  });

  const togglePost = (idx: number) => {
    setSelectedPosts((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

  const isGenerating = activeJob && ['PENDING', 'PROCESSING'].includes(activeJob.status);
  const results = activeJob?.result || [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gerar com IA</h1>
        <p className="text-sm text-muted-foreground">
          Cria conteudo para redes sociais com inteligencia artificial
        </p>
      </div>

      {/* Generation form */}
      {!activeJobId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Novo briefing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Briefing</Label>
              <textarea
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                placeholder="Descreve o que queres comunicar: tema, publico-alvo, objectivos, contexto..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Tom</Label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {toneOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </div>
            </div>

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!briefing || briefing.length < 10 || generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Gerar posts
            </Button>

            {generateMutation.isError && (
              <p className="text-sm text-destructive">
                Erro: {(generateMutation.error as Error).message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active job - loading/results */}
      {activeJobId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-purple-600" />A gerar...
                </>
              ) : activeJob?.status === 'COMPLETED' ? (
                <>
                  <Check className="h-5 w-5 text-green-600" />
                  {results.length} posts gerados
                </>
              ) : activeJob?.status === 'FAILED' ? (
                <>Falhou</>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeJob?.status === 'FAILED' && (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{activeJob.errorMessage}</p>
                <Button variant="outline" onClick={() => setActiveJobId(null)}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {activeJob?.status === 'COMPLETED' && results.length > 0 && (
              <>
                <div className="space-y-3">
                  {results.map((post, idx) => (
                    <div
                      key={idx}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                        selectedPosts.includes(idx)
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-muted-foreground/30'
                      }`}
                      onClick={() => togglePost(idx)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="whitespace-pre-wrap text-sm">{post.content}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {post.hashtags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                          {post.suggestedTime && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Sugestao: {post.suggestedTime}
                            </p>
                          )}
                        </div>
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            selectedPosts.includes(idx)
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {selectedPosts.includes(idx) && <Check className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Accept controls */}
                <div className="border-t pt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Conta destino</Label>
                      <select
                        value={acceptAccountId}
                        onChange={(e) => setAcceptAccountId(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        <option value="">Selecionar...</option>
                        {accounts
                          .filter((a) => a.status === 'ACTIVE')
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.platform === 'FACEBOOK' ? 'FB' : 'IG'} - {a.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Intervalo (horas)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={168}
                        value={intervalHours}
                        onChange={(e) => setIntervalHours(Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => acceptMutation.mutate()}
                      disabled={!acceptAccountId || acceptMutation.isPending}
                    >
                      {acceptMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      {selectedPosts.length > 0
                        ? `Criar ${selectedPosts.length} posts`
                        : `Criar todos (${results.length})`}
                    </Button>
                    <Button variant="outline" onClick={() => setActiveJobId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {jobs.length > 0 && !activeJobId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Historico de geracoes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {jobs.slice(0, 10).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{job.briefing}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.tone} - {job.count} posts -{' '}
                      {new Date(job.createdAt).toLocaleString('pt')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        job.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : job.status === 'FAILED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {job.status === 'COMPLETED'
                        ? 'Concluido'
                        : job.status === 'FAILED'
                          ? 'Falhou'
                          : 'Em curso'}
                    </span>
                    {job.status === 'COMPLETED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setActiveJobId(job.id);
                          setSelectedPosts([]);
                        }}
                      >
                        Ver
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
