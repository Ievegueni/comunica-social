import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Facebook, Instagram, Image, X, Save } from 'lucide-react';

interface SocialAccount {
  id: string;
  platform: 'FACEBOOK' | 'INSTAGRAM';
  name: string;
  status: string;
}

interface MediaAsset {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  filename: string;
  type: string;
}

interface PostData {
  id: string;
  content: string;
  scheduledFor: string;
  socialAccountId: string;
  status: string;
  media: Array<{ mediaAsset: MediaAsset }>;
}

const FB_LIMIT = 63206;
const IG_LIMIT = 2200;

export default function PostEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [content, setContent] = useState('');
  const [socialAccountId, setSocialAccountId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset[]>([]);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: accounts = [] } = useQuery<SocialAccount[]>({
    queryKey: ['social-accounts'],
    queryFn: async () => (await api.get('/social-accounts')).data,
  });

  const { data: mediaAssets } = useQuery<{ assets: MediaAsset[] }>({
    queryKey: ['media-assets-picker'],
    queryFn: async () => (await api.get('/media/assets', { params: { limit: 50 } })).data,
  });

  const { data: postData } = useQuery<PostData>({
    queryKey: ['post', id],
    queryFn: async () => (await api.get(`/posts/${id}`)).data,
    enabled: isEditing,
  });

  // Load existing post data
  useEffect(() => {
    if (postData) {
      setContent(postData.content);
      setSocialAccountId(postData.socialAccountId);
      setScheduledFor(postData.scheduledFor.slice(0, 16));
      setSelectedMedia(postData.media.map((m) => m.mediaAsset));
    }
  }, [postData]);

  // Set default scheduled time (from query param or +1 hour)
  useEffect(() => {
    if (!isEditing && !scheduledFor) {
      const dateParam = searchParams.get('date');
      const date = dateParam ? new Date(dateParam) : new Date(Date.now() + 3600000);
      if (isNaN(date.getTime())) {
        setScheduledFor(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
      } else {
        setScheduledFor(date.toISOString().slice(0, 16));
      }
    }
  }, [isEditing, scheduledFor, searchParams]);

  // Auto-save draft
  useEffect(() => {
    if (!isEditing || !content || postData?.status !== 'DRAFT') return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await api.patch(`/posts/${id}`, { content });
      } catch {
        // Silent fail for auto-save
      }
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [content, isEditing, id, postData?.status]);

  const selectedAccount = accounts.find((a) => a.id === socialAccountId);
  const charLimit = selectedAccount?.platform === 'INSTAGRAM' ? IG_LIMIT : FB_LIMIT;
  const charCount = content.length;
  const isOverLimit = charCount > charLimit;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        content,
        socialAccountId,
        scheduledFor: new Date(scheduledFor).toISOString(),
        mediaAssetIds: selectedMedia.map((m) => m.id),
      };

      if (isEditing) {
        return api.patch(`/posts/${id}`, payload);
      }
      return api.post('/posts', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate('/posts');
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao guardar o post', variant: 'destructive' });
    },
  });

  const handleSave = async () => {
    if (!socialAccountId || !content || !scheduledFor || isOverLimit) return;
    setSaving(true);
    try {
      await saveMutation.mutateAsync();
    } finally {
      setSaving(false);
    }
  };

  const addMedia = (asset: MediaAsset) => {
    if (selectedMedia.length >= 10) return;
    if (!selectedMedia.find((m) => m.id === asset.id)) {
      setSelectedMedia([...selectedMedia, asset]);
    }
    setMediaDialogOpen(false);
  };

  const removeMedia = (assetId: string) => {
    setSelectedMedia(selectedMedia.filter((m) => m.id !== assetId));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isEditing ? 'Editar Post' : 'Novo Post'}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/posts')}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !socialAccountId || !content || !scheduledFor || isOverLimit}
          >
            <Save className="mr-1 h-4 w-4" />
            {saving ? 'A guardar...' : isEditing ? 'Guardar' : 'Criar post'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Editor */}
        <div className="space-y-4 lg:col-span-2">
          {/* Account selector */}
          <div className="space-y-2">
            <Label>Conta destino</Label>
            <select
              value={socialAccountId}
              onChange={(e) => setSocialAccountId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecionar conta...</option>
              {accounts
                .filter((a) => a.status === 'ACTIVE')
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.platform === 'FACEBOOK' ? '📘' : '📸'} {account.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conteudo</Label>
              <span
                className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {charCount}/{charLimit}
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              placeholder="Escreva o conteudo do post..."
            />
          </div>

          {/* Media */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Media ({selectedMedia.length}/10)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMediaDialogOpen(true)}
                disabled={selectedMedia.length >= 10}
              >
                <Image className="mr-1 h-3 w-3" />
                Adicionar
              </Button>
            </div>
            {selectedMedia.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedMedia.map((asset) => (
                  <div key={asset.id} className="relative h-20 w-20 overflow-hidden rounded border">
                    <img
                      src={asset.thumbnailUrl || asset.url}
                      alt={asset.filename}
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={() => removeMedia(asset.id)}
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <Label>Agendar para</Label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Preview */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                {selectedAccount?.platform === 'INSTAGRAM' ? (
                  <Instagram className="h-4 w-4 text-pink-600" />
                ) : (
                  <Facebook className="h-4 w-4 text-blue-600" />
                )}
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-xs font-medium">{selectedAccount?.name || 'Conta'}</p>
                {selectedMedia.length > 0 && (
                  <div className="overflow-hidden rounded">
                    <img
                      src={selectedMedia[0].thumbnailUrl || selectedMedia[0].url}
                      alt=""
                      className="w-full object-cover"
                    />
                  </div>
                )}
                <p className="whitespace-pre-wrap text-xs">
                  {content || 'O conteudo aparece aqui...'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {scheduledFor ? new Date(scheduledFor).toLocaleString('pt') : 'Data nao definida'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Media picker dialog */}
      <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecionar media</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-96 grid-cols-4 gap-2 overflow-y-auto">
            {(mediaAssets?.assets || []).map((asset) => (
              <button
                key={asset.id}
                onClick={() => addMedia(asset)}
                className="overflow-hidden rounded border hover:ring-2 hover:ring-primary"
                disabled={!!selectedMedia.find((m) => m.id === asset.id)}
              >
                <div className="aspect-square bg-muted">
                  <img
                    src={asset.thumbnailUrl || asset.url}
                    alt={asset.filename}
                    className="h-full w-full object-cover"
                  />
                </div>
              </button>
            ))}
            {(!mediaAssets?.assets || mediaAssets.assets.length === 0) && (
              <p className="col-span-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma media na biblioteca.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
