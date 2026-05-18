import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Facebook, Instagram } from 'lucide-react';

interface CalendarPost {
  id: string;
  content: string;
  status: string;
  scheduledFor: string;
  publishedAt: string | null;
  source: string;
  socialAccount: { id: string; platform: string; name: string };
  createdBy: { id: string; name: string };
  media: Array<{ mediaAsset: { thumbnailUrl: string | null; url: string } }>;
}

interface SocialAccount {
  id: string;
  platform: string;
  name: string;
  status: string;
}

const statusColors: Record<string, string> = {
  DRAFT: '#6b7280',
  PENDING_APPROVAL: '#d97706',
  SCHEDULED: '#2563eb',
  PUBLISHING: '#7c3aed',
  PUBLISHED: '#16a34a',
  FAILED: '#dc2626',
  CANCELLED: '#9ca3af',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Rascunho',
  PENDING_APPROVAL: 'Pendente',
  SCHEDULED: 'Agendado',
  PUBLISHING: 'A publicar',
  PUBLISHED: 'Publicado',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
};

export default function Calendar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString(),
  });
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);
  const [filterAccount, setFilterAccount] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { data: accounts = [] } = useQuery<SocialAccount[]>({
    queryKey: ['social-accounts'],
    queryFn: async () => (await api.get('/social-accounts')).data,
  });

  const { data: posts = [] } = useQuery<CalendarPost[]>({
    queryKey: ['posts-calendar', dateRange.from, dateRange.to, filterAccount, filterStatus],
    queryFn: async () => {
      const params: Record<string, string> = {
        from: dateRange.from,
        to: dateRange.to,
      };
      if (filterAccount) params.socialAccountId = filterAccount;
      if (filterStatus) params.status = filterStatus;
      return (await api.get('/posts/calendar', { params })).data;
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, scheduledFor }: { id: string; scheduledFor: string }) =>
      api.patch(`/posts/${id}`, { scheduledFor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts-calendar'] });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao reagendar o post', variant: 'destructive' });
    },
  });

  const events = useMemo(
    () =>
      posts.map((post) => ({
        id: post.id,
        title: post.content.slice(0, 50) + (post.content.length > 50 ? '...' : ''),
        start: post.scheduledFor,
        backgroundColor: statusColors[post.status] || '#6b7280',
        borderColor: post.socialAccount.platform === 'INSTAGRAM' ? '#ec4899' : '#2563eb',
        extendedProps: post,
      })),
    [posts],
  );

  const handleDatesSet = useCallback((arg: { start: Date; end: Date }) => {
    setDateRange({
      from: arg.start.toISOString(),
      to: arg.end.toISOString(),
    });
  }, []);

  const handleEventDrop = useCallback(
    (info: { event: { id: string; start: Date | null }; revert: () => void }) => {
      if (!info.event.start) return;
      const post = posts.find((p) => p.id === info.event.id);
      if (!post || !['DRAFT', 'SCHEDULED'].includes(post.status)) {
        info.revert();
        return;
      }
      rescheduleMutation.mutate({
        id: info.event.id,
        scheduledFor: info.event.start.toISOString(),
      });
    },
    [posts, rescheduleMutation],
  );

  const handleEventClick = useCallback((info: { event: { extendedProps: unknown } }) => {
    setSelectedPost(info.event.extendedProps as CalendarPost);
  }, []);

  const handleDateClick = useCallback(
    (info: { dateStr: string }) => {
      const date = new Date(info.dateStr);
      if (isNaN(date.getTime())) return;
      navigate(`/posts/new?date=${info.dateStr}`);
    },
    [navigate],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendario</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todas as contas</option>
          {accounts
            .filter((a) => a.status === 'ACTIVE')
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.platform === 'FACEBOOK' ? 'FB' : 'IG'} - {account.name}
              </option>
            ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos os estados</option>
          <option value="DRAFT">Rascunho</option>
          <option value="SCHEDULED">Agendado</option>
          <option value="PUBLISHED">Publicado</option>
          <option value="FAILED">Falhou</option>
        </select>
      </div>

      {/* Calendar */}
      <div className="rounded-lg border bg-card p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          locale="pt"
          events={events}
          editable={true}
          droppable={true}
          selectable={true}
          eventDrop={handleEventDrop}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          datesSet={handleDatesSet}
          height="auto"
          eventDisplay="block"
          dayMaxEvents={3}
          buttonText={{
            today: 'Hoje',
            month: 'Mes',
            week: 'Semana',
            day: 'Dia',
            list: 'Lista',
          }}
        />
      </div>

      {/* Post detail dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPost?.socialAccount.platform === 'INSTAGRAM' ? (
                <Instagram className="h-4 w-4 text-pink-600" />
              ) : (
                <Facebook className="h-4 w-4 text-blue-600" />
              )}
              {selectedPost?.socialAccount.name}
            </DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-xs text-white"
                  style={{ backgroundColor: statusColors[selectedPost.status] }}
                >
                  {statusLabels[selectedPost.status]}
                </span>
                {selectedPost.source === 'AI_GENERATED' && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                    IA
                  </span>
                )}
              </div>

              {selectedPost.media.length > 0 && (
                <div className="overflow-hidden rounded">
                  <img
                    src={
                      selectedPost.media[0].mediaAsset.thumbnailUrl ||
                      selectedPost.media[0].mediaAsset.url
                    }
                    alt=""
                    className="w-full max-h-48 object-cover"
                  />
                </div>
              )}

              <p className="whitespace-pre-wrap text-sm">{selectedPost.content}</p>

              <div className="text-xs text-muted-foreground">
                <p>Agendado: {new Date(selectedPost.scheduledFor).toLocaleString('pt')}</p>
                <p>Criado por: {selectedPost.createdBy.name}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    navigate(`/posts/${selectedPost.id}/edit`);
                    setSelectedPost(null);
                  }}
                >
                  Editar
                </Button>
                {['DRAFT', 'SCHEDULED'].includes(selectedPost.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigate(`/posts/new?date=${selectedPost.scheduledFor}`);
                      setSelectedPost(null);
                    }}
                  >
                    Novo nesta data
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
