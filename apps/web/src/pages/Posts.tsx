import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Copy, Trash2, Facebook, Instagram, Send, XCircle } from 'lucide-react';

interface Post {
  id: string;
  content: string;
  status: string;
  scheduledFor: string;
  publishedAt: string | null;
  source: string;
  errorMessage: string | null;
  externalPostId: string | null;
  socialAccount: { id: string; platform: string; name: string };
  createdBy: { id: string; name: string };
  media: Array<{ mediaAsset: { thumbnailUrl: string | null; url: string } }>;
}

const statusConfig: Record<string, { label: string; class: string }> = {
  DRAFT: { label: 'Rascunho', class: 'bg-gray-100 text-gray-700' },
  PENDING_APPROVAL: { label: 'Pendente', class: 'bg-yellow-100 text-yellow-700' },
  SCHEDULED: { label: 'Agendado', class: 'bg-blue-100 text-blue-700' },
  PUBLISHING: { label: 'A publicar', class: 'bg-purple-100 text-purple-700' },
  PUBLISHED: { label: 'Publicado', class: 'bg-green-100 text-green-700' },
  FAILED: { label: 'Falhou', class: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelado', class: 'bg-gray-100 text-gray-500' },
};

export default function Posts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery<{ posts: Post[]; total: number }>({
    queryKey: ['posts', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      return (await api.get('/posts', { params })).data;
    },
  });

  const posts = data?.posts || [];

  const onMutationError = (err: unknown) => {
    const message = err instanceof Error ? err.message : 'Ocorreu um erro';
    toast({ title: 'Erro', description: message, variant: 'destructive' });
  };

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/posts/${id}/duplicate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
    onError: onMutationError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/posts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
    onError: onMutationError,
  });

  const publishNowMutation = useMutation({
    mutationFn: (id: string) => api.post(`/posts/${id}/publish-now`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
    onError: onMutationError,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/posts/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
    onError: onMutationError,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-sm text-muted-foreground">{data?.total || 0} posts</p>
        </div>
        <Link to="/posts/new">
          <Button>
            <Plus className="mr-1 h-4 w-4" />
            Novo post
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos os estados</option>
          <option value="DRAFT">Rascunho</option>
          <option value="SCHEDULED">Agendado</option>
          <option value="PUBLISHED">Publicado</option>
          <option value="FAILED">Falhou</option>
        </select>
      </div>

      {/* Posts list */}
      {isLoading ? (
        <p className="text-muted-foreground">A carregar...</p>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum post encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="flex gap-4 p-4">
                {/* Media thumbnail */}
                {post.media.length > 0 && (
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-muted">
                    <img
                      src={post.media[0].mediaAsset.thumbnailUrl || post.media[0].mediaAsset.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {post.socialAccount.platform === 'FACEBOOK' ? (
                      <Facebook className="h-3.5 w-3.5 text-blue-600" />
                    ) : (
                      <Instagram className="h-3.5 w-3.5 text-pink-600" />
                    )}
                    <span className="text-xs text-muted-foreground">{post.socialAccount.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${statusConfig[post.status]?.class}`}
                    >
                      {statusConfig[post.status]?.label}
                    </span>
                    {post.source === 'AI_GENERATED' && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] text-purple-700">
                        IA
                      </span>
                    )}
                  </div>
                  <Link to={`/posts/${post.id}/edit`}>
                    <p className="text-sm line-clamp-2 hover:underline">{post.content}</p>
                  </Link>
                  {post.status === 'FAILED' && post.errorMessage && (
                    <p className="mt-1 text-xs text-destructive">{post.errorMessage}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{new Date(post.scheduledFor).toLocaleString('pt')}</span>
                    <span>por {post.createdBy.name}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-start gap-1">
                  {['DRAFT', 'SCHEDULED', 'FAILED'].includes(post.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Publicar agora"
                      onClick={() => publishNowMutation.mutate(post.id)}
                    >
                      <Send className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                  )}
                  {['SCHEDULED'].includes(post.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Cancelar"
                      onClick={() => cancelMutation.mutate(post.id)}
                    >
                      <XCircle className="h-3.5 w-3.5 text-orange-500" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Duplicar"
                    onClick={() => duplicateMutation.mutate(post.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {['DRAFT', 'CANCELLED'].includes(post.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Eliminar"
                      onClick={() => deleteMutation.mutate(post.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
