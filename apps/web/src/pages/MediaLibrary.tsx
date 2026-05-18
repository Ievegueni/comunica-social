import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  FolderPlus,
  Upload,
  Image,
  Video,
  Folder,
  Trash2,
  ChevronRight,
  Search,
  X,
  Tag,
} from 'lucide-react';

interface MediaAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl: string | null;
  filename: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  tags: string[];
  createdAt: string;
  folderId: string | null;
}

interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  _count: { assets: number; children: number };
}

interface AssetsResponse {
  assets: MediaAsset[];
  total: number;
  page: number;
  totalPages: number;
}

export default function MediaLibrary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'IMAGE' | 'VIDEO' | ''>('');
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: folders = [] } = useQuery<MediaFolder[]>({
    queryKey: ['media-folders'],
    queryFn: async () => (await api.get('/media/folders')).data,
  });

  const { data: assetsData, isLoading } = useQuery<AssetsResponse>({
    queryKey: ['media-assets', currentFolderId, typeFilter, search],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (currentFolderId) params.folderId = currentFolderId;
      if (typeFilter) params.type = typeFilter;
      if (search) params.search = search;
      return (await api.get('/media/assets', { params })).data;
    },
  });

  const assets = assetsData?.assets || [];

  const onError = () => {
    toast({ title: 'Erro', description: 'Operacao falhou', variant: 'destructive' });
  };

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      return api.post('/media/folders', { name, parentId: currentFolderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-folders'] });
      setNewFolderDialogOpen(false);
      setNewFolderName('');
    },
    onError,
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/media/folders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media-folders'] }),
    onError,
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/media/assets/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media-assets'] }),
    onError,
  });

  const updateTagsMutation = useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      return api.patch(`/media/assets/${id}`, { tags });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-assets'] });
      if (previewAsset) {
        setPreviewAsset({ ...previewAsset, tags: [...previewAsset.tags, tagInput] });
      }
    },
    onError,
  });

  const handleUpload = useCallback(
    async (files: FileList) => {
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append('file', file);
          if (currentFolderId) formData.append('folderId', currentFolderId);
          await api.post('/media/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
        queryClient.invalidateQueries({ queryKey: ['media-assets'] });
      } catch {
        toast({ title: 'Erro', description: 'Falha no upload', variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    },
    [currentFolderId, queryClient, toast],
  );

  const navigateToFolder = (folder: MediaFolder) => {
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  };

  const navigateToRoot = () => {
    setFolderPath([]);
    setCurrentFolderId(undefined);
  };

  const navigateToBreadcrumb = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolderId(newPath[newPath.length - 1]?.id);
  };

  const currentFolders = folders.filter((f) => f.parentId === (currentFolderId || null));

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addTag = () => {
    if (!previewAsset || !tagInput.trim()) return;
    const newTags = [...previewAsset.tags, tagInput.trim()];
    updateTagsMutation.mutate({ id: previewAsset.id, tags: newTags });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    if (!previewAsset) return;
    const newTags = previewAsset.tags.filter((t) => t !== tag);
    updateTagsMutation.mutate({ id: previewAsset.id, tags: newTags });
    setPreviewAsset({ ...previewAsset, tags: newTags });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Biblioteca de Media</h1>
          <p className="text-sm text-muted-foreground">{assetsData?.total || 0} ficheiros</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setNewFolderDialogOpen(true)}>
            <FolderPlus className="mr-1 h-4 w-4" />
            Nova pasta
          </Button>
          <label>
            <Button size="sm" asChild disabled={uploading}>
              <span>
                <Upload className="mr-1 h-4 w-4" />
                {uploading ? 'A enviar...' : 'Upload'}
              </span>
            </Button>
            <input
              type="file"
              className="hidden"
              multiple
              accept="image/*,video/*"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </label>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar ficheiros..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as '' | 'IMAGE' | 'VIDEO')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          <option value="IMAGE">Imagens</option>
          <option value="VIDEO">Videos</option>
        </select>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        <button onClick={navigateToRoot} className="text-primary hover:underline">
          Raiz
        </button>
        {folderPath.map((item, i) => (
          <span key={item.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              onClick={() => navigateToBreadcrumb(i)}
              className="text-primary hover:underline"
            >
              {item.name}
            </button>
          </span>
        ))}
      </div>

      {/* Folders */}
      {currentFolders.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {currentFolders.map((folder) => (
            <div
              key={folder.id}
              className="group relative flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 hover:bg-accent"
              onClick={() => navigateToFolder(folder)}
            >
              <Folder className="h-8 w-8 text-yellow-500" />
              <span className="text-xs text-center truncate w-full">{folder.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {folder._count.assets} ficheiros
              </span>
              <button
                className="absolute right-1 top-1 hidden rounded p-1 hover:bg-destructive/10 group-hover:block"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFolderMutation.mutate(folder.id);
                }}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Assets grid */}
      {isLoading ? (
        <p className="text-muted-foreground">A carregar...</p>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum ficheiro nesta pasta.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group relative cursor-pointer overflow-hidden rounded-lg border"
              onClick={() => setPreviewAsset(asset)}
            >
              <div className="aspect-square bg-muted">
                {asset.type === 'IMAGE' ? (
                  <img
                    src={asset.thumbnailUrl || asset.url}
                    alt={asset.filename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Video className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs">{asset.filename}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(asset.sizeBytes)}</p>
              </div>
              {asset.type === 'IMAGE' && (
                <Image className="absolute right-1 top-1 h-3 w-3 text-white drop-shadow" />
              )}
              <button
                className="absolute left-1 top-1 hidden rounded bg-black/50 p-1 group-hover:block"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAssetMutation.mutate(asset.id);
                }}
              >
                <Trash2 className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New folder dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createFolderMutation.mutate(newFolderName);
            }}
            className="space-y-4"
          >
            <Input
              placeholder="Nome da pasta"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={createFolderMutation.isPending}>
              Criar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Asset preview dialog */}
      <Dialog open={!!previewAsset} onOpenChange={() => setPreviewAsset(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewAsset?.filename}</DialogTitle>
          </DialogHeader>
          {previewAsset && (
            <div className="space-y-4">
              <div className="flex justify-center rounded-lg bg-muted p-4">
                {previewAsset.type === 'IMAGE' ? (
                  <img
                    src={previewAsset.url}
                    alt={previewAsset.filename}
                    className="max-h-96 rounded object-contain"
                  />
                ) : (
                  <video src={previewAsset.url} controls className="max-h-96 rounded" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span> {previewAsset.type}
                </div>
                <div>
                  <span className="text-muted-foreground">Tamanho:</span>{' '}
                  {formatSize(previewAsset.sizeBytes)}
                </div>
                {previewAsset.width && (
                  <div>
                    <span className="text-muted-foreground">Dimensoes:</span> {previewAsset.width}x
                    {previewAsset.height}
                  </div>
                )}
                {previewAsset.durationSec && (
                  <div>
                    <span className="text-muted-foreground">Duracao:</span>{' '}
                    {previewAsset.durationSec}s
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Tags
                </p>
                <div className="flex flex-wrap gap-1">
                  {previewAsset.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                    >
                      {tag}
                      <button onClick={() => removeTag(tag)}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Adicionar tag"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="h-8 text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={addTag}>
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
