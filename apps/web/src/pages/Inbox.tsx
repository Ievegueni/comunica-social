import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Facebook, Instagram, MessageCircle, Send, Archive, Mail, MailOpen } from 'lucide-react';

interface InboxItem {
  id: string;
  type: 'COMMENT_FB' | 'COMMENT_IG' | 'DM_MESSENGER' | 'DM_INSTAGRAM';
  externalId: string;
  parentPostId: string | null;
  fromUserId: string;
  fromUserName: string;
  content: string;
  status: 'UNREAD' | 'READ' | 'REPLIED' | 'ARCHIVED';
  receivedAt: string;
  repliedAt: string | null;
  socialAccount: { id: string; platform: string; name: string };
  replies: Array<{ id: string; content: string; sentAt: string }>;
}

const typeIcons: Record<string, typeof Facebook> = {
  COMMENT_FB: Facebook,
  COMMENT_IG: Instagram,
  DM_MESSENGER: MessageCircle,
  DM_INSTAGRAM: Send,
};

const typeLabels: Record<string, string> = {
  COMMENT_FB: 'Comentario FB',
  COMMENT_IG: 'Comentario IG',
  DM_MESSENGER: 'DM Messenger',
  DM_INSTAGRAM: 'DM Instagram',
};

const statusLabels: Record<string, { label: string; class: string }> = {
  UNREAD: { label: 'Nao lida', class: 'bg-blue-100 text-blue-700' },
  READ: { label: 'Lida', class: 'bg-gray-100 text-gray-700' },
  REPLIED: { label: 'Respondida', class: 'bg-green-100 text-green-700' },
  ARCHIVED: { label: 'Arquivada', class: 'bg-gray-100 text-gray-500' },
};

export default function Inbox() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const { data, isLoading } = useQuery<{ items: InboxItem[]; total: number; unreadCount: number }>({
    queryKey: ['inbox', typeFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      return (await api.get('/inbox', { params })).data;
    },
  });

  const { data: selectedItem } = useQuery<InboxItem>({
    queryKey: ['inbox-item', selectedItemId],
    queryFn: async () => (await api.get(`/inbox/${selectedItemId}`)).data,
    enabled: !!selectedItemId,
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      return (await api.post(`/inbox/${selectedItemId}/reply`, { content: replyContent })).data;
    },
    onSuccess: () => {
      setReplyContent('');
      queryClient.invalidateQueries({ queryKey: ['inbox-item', selectedItemId] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao enviar resposta', variant: 'destructive' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/inbox/${id}/status`, { status: 'ARCHIVED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      setSelectedItemId(null);
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao arquivar', variant: 'destructive' });
    },
  });

  const items = data?.items || [];

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* List */}
      <div className="flex w-full flex-col lg:w-96">
        <div className="mb-3">
          <h1 className="text-2xl font-bold">
            Inbox
            {data?.unreadCount ? (
              <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                {data.unreadCount}
              </span>
            ) : null}
          </h1>
        </div>

        {/* Filters */}
        <div className="mb-3 flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          >
            <option value="">Todos</option>
            <option value="COMMENT_FB">Comentarios FB</option>
            <option value="COMMENT_IG">Comentarios IG</option>
            <option value="DM_MESSENGER">DMs Messenger</option>
            <option value="DM_INSTAGRAM">DMs Instagram</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          >
            <option value="">Todos estados</option>
            <option value="UNREAD">Nao lidas</option>
            <option value="READ">Lidas</option>
            <option value="REPLIED">Respondidas</option>
          </select>
        </div>

        {/* Items list */}
        <div className="flex-1 space-y-1 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">A carregar...</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Inbox vazia.</p>
          ) : (
            items.map((item) => {
              const Icon = typeIcons[item.type] || MessageCircle;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    selectedItemId === item.id
                      ? 'border-primary bg-primary/5'
                      : item.status === 'UNREAD'
                        ? 'border-blue-200 bg-blue-50/50'
                        : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        item.type.includes('FB') || item.type.includes('MESSENGER')
                          ? 'text-blue-600'
                          : 'text-pink-600'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium truncate">{item.fromUserName}</span>
                        {item.status === 'UNREAD' && (
                          <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{item.content}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(item.receivedAt).toLocaleString('pt')}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="hidden flex-1 flex-col lg:flex">
        {selectedItem ? (
          <Card className="flex flex-1 flex-col">
            <CardContent className="flex flex-1 flex-col p-4">
              {/* Header */}
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <div>
                  <p className="font-medium">{selectedItem.fromUserName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{typeLabels[selectedItem.type]}</span>
                    <span>{selectedItem.socialAccount.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${statusLabels[selectedItem.status].class}`}
                    >
                      {statusLabels[selectedItem.status].label}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Arquivar"
                    onClick={() => archiveMutation.mutate(selectedItem.id)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {/* Original message */}
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {selectedItem.fromUserName} -{' '}
                    {new Date(selectedItem.receivedAt).toLocaleString('pt')}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{selectedItem.content}</p>
                </div>

                {/* Replies */}
                {selectedItem.replies.map((reply) => (
                  <div key={reply.id} className="ml-8 rounded-lg bg-primary/10 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Voce - {new Date(reply.sentAt).toLocaleString('pt')}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              <div className="mt-4 flex gap-2 border-t pt-3">
                <Input
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Escreve uma resposta..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && replyContent) {
                      e.preventDefault();
                      replyMutation.mutate();
                    }
                  }}
                />
                <Button
                  onClick={() => replyMutation.mutate()}
                  disabled={!replyContent || replyMutation.isPending}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="text-center">
              {items.length > 0 ? (
                <>
                  <MailOpen className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">Seleciona uma mensagem</p>
                </>
              ) : (
                <>
                  <Mail className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">Inbox vazia</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
