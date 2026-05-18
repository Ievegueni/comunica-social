import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Users,
  FileText,
  Share2,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  country: string;
  status: 'ACTIVE' | 'SUSPENDED';
  approvalRequired: boolean;
  aiGenerationEnabled: boolean;
  createdAt: string;
  _count: { users: number; posts: number; socialAccounts: number };
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  isSuperAdmin: boolean;
  createdAt: string;
  tenant: { id: string; name: string; slug: string };
}

export default function Admin() {
  const [tab, setTab] = useState<'overview' | 'tenants' | 'users'>('overview');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
  });

  const { data: tenantsData } = useQuery({
    queryKey: ['admin', 'tenants', page, search],
    queryFn: () =>
      api.get('/admin/tenants', { params: { page, limit: 10, search } }).then((r) => r.data),
    enabled: tab === 'tenants' || tab === 'overview',
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () =>
      api.get('/admin/users', { params: { page, limit: 10, search } }).then((r) => r.data),
    enabled: tab === 'users',
  });

  const { data: tenantDetail } = useQuery({
    queryKey: ['admin', 'tenant', selectedTenant],
    queryFn: () => api.get(`/admin/tenants/${selectedTenant}`).then((r) => r.data),
    enabled: !!selectedTenant,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/tenants/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast({ title: 'Status actualizado' });
    },
    onError: () => toast({ title: 'Erro ao actualizar', variant: 'destructive' }),
  });

  const toggleFeature = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, boolean> }) =>
      api.patch(`/admin/tenants/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast({ title: 'Funcionalidade actualizada' });
    },
    onError: () => toast({ title: 'Erro ao actualizar', variant: 'destructive' }),
  });

  if (selectedTenant && tenantDetail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTenant(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-2xl font-bold">{tenantDetail.name}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${tenantDetail.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
          >
            {tenantDetail.status}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{tenantDetail._count.posts}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{tenantDetail._count.socialAccounts}</p>
              <p className="text-xs text-muted-foreground">Contas Sociais</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{tenantDetail._count.mediaAssets}</p>
              <p className="text-xs text-muted-foreground">Media</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{tenantDetail._count.inboxItems}</p>
              <p className="text-xs text-muted-foreground">Inbox</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3">
          <Button
            variant={tenantDetail.status === 'ACTIVE' ? 'destructive' : 'default'}
            onClick={() =>
              toggleStatus.mutate({
                id: tenantDetail.id,
                status: tenantDetail.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
              })
            }
          >
            {tenantDetail.status === 'ACTIVE' ? 'Suspender' : 'Activar'}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toggleFeature.mutate({
                id: tenantDetail.id,
                data: { aiGenerationEnabled: !tenantDetail.aiGenerationEnabled },
              })
            }
          >
            IA: {tenantDetail.aiGenerationEnabled ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toggleFeature.mutate({
                id: tenantDetail.id,
                data: { approvalRequired: !tenantDetail.approvalRequired },
              })
            }
          >
            Aprovacoes: {tenantDetail.approvalRequired ? 'ON' : 'OFF'}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Utilizadores ({tenantDetail.users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2">Nome</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenantDetail.users.map(
                  (u: {
                    id: string;
                    name: string;
                    email: string;
                    role: string;
                    status: string;
                  }) => (
                    <tr key={u.id} className="border-b">
                      <td className="py-2">{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>{u.status}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Backoffice — Super Admin</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['overview', 'tenants', 'users'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setPage(1);
              setSearch('');
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'overview' ? 'Visao Geral' : t === 'tenants' ? 'Empresas' : 'Utilizadores'}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Empresas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{stats.tenants.total}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.tenants.last30d} nos ultimos 30 dias
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Utilizadores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{stats.users}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Posts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{stats.posts}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Contas Sociais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{stats.socialAccounts}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Empresas recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {tenantsData?.tenants?.slice(0, 5).map((t: TenantItem) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border-b py-3 last:border-0"
                >
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.slug} · {t.country} · {new Date(t.createdAt).toLocaleDateString('pt')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {t._count.users} users · {t._count.posts} posts
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${t.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tenants */}
      {tab === 'tenants' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Procurar empresa..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>

          <Card>
            <CardContent className="pt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2">Empresa</th>
                    <th className="pb-2">Pais</th>
                    <th className="pb-2">Users</th>
                    <th className="pb-2">Posts</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Criada</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tenantsData?.tenants?.map((t: TenantItem) => (
                    <tr key={t.id} className="border-b hover:bg-accent/50">
                      <td className="py-2">
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.slug}</p>
                      </td>
                      <td>{t.country}</td>
                      <td>{t._count.users}</td>
                      <td>{t._count.posts}</td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${t.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString('pt')}
                      </td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedTenant(t.id)}>
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tenantsData && tenantsData.pages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">{tenantsData.total} empresas</p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      {page} / {tenantsData.pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= tenantsData.pages}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Procurar utilizador..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>

          <Card>
            <CardContent className="pt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2">Nome</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Empresa</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Criado</th>
                  </tr>
                </thead>
                <tbody>
                  {usersData?.users?.map((u: UserItem) => (
                    <tr key={u.id} className="border-b">
                      <td className="py-2 font-medium">
                        {u.name}{' '}
                        {u.isSuperAdmin && (
                          <span className="ml-1 rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary">
                            SUPER
                          </span>
                        )}
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className="text-muted-foreground">{u.tenant.name}</span>
                      </td>
                      <td>{u.role}</td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString('pt')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {usersData && usersData.pages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">{usersData.total} utilizadores</p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      {page} / {usersData.pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= usersData.pages}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
