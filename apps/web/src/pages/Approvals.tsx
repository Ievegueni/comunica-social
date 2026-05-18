import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, X, Facebook, Instagram } from 'lucide-react';

interface Post {
  id: string;
  content: string;
  status: string;
  scheduledFor: string;
  source: string;
  socialAccount: { id: string; platform: string; name: string };
  createdBy: { id: string; name: string };
  media: Array<{ mediaAsset: { thumbnailUrl: string | null; url: string } }>;
}

export default function Approvals() {
  const queryClient = useQueryClient();
  const [rejectDialogPost, setRejectDialogPost] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery<{ posts: Post[]; total: number }>({
    queryKey: ['posts', 'PENDING_APPROVAL'],
    queryFn: async () => (await api.get('/posts', { params: { status: 'PENDING_APPROVAL' } })).data,
  });

  const posts = data?.posts || [];

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/posts/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/posts/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setRejectDialogPost(null);
      setRejectReason('');
    },
  });

  const handleReject = () => {
    if (!rejectDialogPost || !rejectReason) return;
    rejectMutation.mutate({ id: rejectDialogPost, reason: rejectReason });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Aprovacoes</h1>
        <p className="text-sm text-muted-foreground">
          {posts.length} post{posts.length !== 1 ? 's' : ''} a aguardar aprovacao
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">A carregar...</p>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum post pendente de aprovacao.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Media thumbnail */}
                  {post.media.length > 0 && (
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-muted">
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
                      <span className="text-xs text-muted-foreground">
                        {post.socialAccount.name}
                      </span>
                      {post.source === 'AI_GENERATED' && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] text-purple-700">
                          IA
                        </span>
                      )}
                    </div>
                    <Link to={`/posts/${post.id}/edit`}>
                      <p className="text-sm line-clamp-3 hover:underline">{post.content}</p>
                    </Link>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Agendado: {new Date(post.scheduledFor).toLocaleString('pt')}</span>
                      <span>por {post.createdBy.name}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(post.id)}
                      disabled={approveMutation.isPending}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectDialogPost(post.id)}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject dialog */}
      <Dialog
        open={!!rejectDialogPost}
        onOpenChange={() => {
          setRejectDialogPost(null);
          setRejectReason('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo da rejeicao</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Explica o motivo..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogPost(null);
                  setRejectReason('');
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectReason || rejectMutation.isPending}
              >
                Rejeitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
