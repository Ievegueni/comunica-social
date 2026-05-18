import { useAuthStore } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const { user, tenant } = useAuthStore();

  const { data: accounts } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => api.get('/social-accounts').then((r) => r.data),
  });

  const { data: scheduledPosts } = useQuery({
    queryKey: ['posts', 'scheduled-count'],
    queryFn: () =>
      api.get('/posts', { params: { status: 'SCHEDULED', limit: 1 } }).then((r) => r.data),
  });

  const { data: pendingPosts } = useQuery({
    queryKey: ['posts', 'pending-count'],
    queryFn: () =>
      api.get('/posts', { params: { status: 'PENDING_APPROVAL', limit: 1 } }).then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo, {user?.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tenant?.name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contas Sociais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{accounts?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {accounts?.length ? 'Conectadas' : 'Nenhuma conectada'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Posts Agendados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{scheduledPosts?.total ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {scheduledPosts?.total ? 'Agendados' : 'Nenhum post agendado'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes de Aprovacao
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingPosts?.total ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {pendingPosts?.total ? 'Aguardam aprovacao' : 'Nenhum pendente'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
