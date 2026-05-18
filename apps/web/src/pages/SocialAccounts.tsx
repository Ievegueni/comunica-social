import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Facebook, Instagram, Link2, Unlink, AlertTriangle } from 'lucide-react';

interface SocialAccount {
  id: string;
  platform: 'FACEBOOK' | 'INSTAGRAM';
  externalId: string;
  name: string;
  status: 'ACTIVE' | 'TOKEN_EXPIRED' | 'REVOKED';
  tokenExpiresAt: string;
  connectedAt: string;
  lastTokenRefresh: string | null;
}

interface AvailableAccount {
  platform: 'FACEBOOK' | 'INSTAGRAM';
  externalId: string;
  name: string;
  accessToken: string;
  pageId?: string;
  picture?: string;
}

export default function SocialAccounts() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<AvailableAccount[]>([]);
  const [connecting, setConnecting] = useState(false);

  const { data: accounts = [], isLoading } = useQuery<SocialAccount[]>({
    queryKey: ['social-accounts'],
    queryFn: async () => {
      const res = await api.get('/social-accounts');
      return res.data;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/social-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast({
        title: 'Erro',
        description: msg || 'Falha ao desconectar conta',
        variant: 'destructive',
      });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (account: AvailableAccount) => {
      return api.post('/social-accounts', {
        platform: account.platform,
        externalId: account.externalId,
        name: account.name,
        accessToken: account.accessToken,
        pageId: account.pageId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao conectar conta', variant: 'destructive' });
    },
  });

  const handleStartConnect = async () => {
    try {
      const { data } = await api.get('/social/meta/auth-url');
      // Open Meta OAuth in popup
      const popup = window.open(data.url, 'meta-oauth', 'width=600,height=700');

      // Listen for callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'META_OAUTH_CALLBACK' && event.data?.code) {
          window.removeEventListener('message', handleMessage);
          popup?.close();

          setConnecting(true);
          try {
            const res = await api.post('/social/meta/callback', { code: event.data.code });
            setAvailableAccounts(res.data.accounts);
            setConnectDialogOpen(true);
          } catch {
            // Error handled by UI
          } finally {
            setConnecting(false);
          }
        }
      };

      window.addEventListener('message', handleMessage);
    } catch {
      // Error handled
    }
  };

  const handleConnectAccount = async (account: AvailableAccount) => {
    await connectMutation.mutateAsync(account);
    // Remove from available list
    setAvailableAccounts((prev) => prev.filter((a) => a.externalId !== account.externalId));
    if (availableAccounts.length <= 1) {
      setConnectDialogOpen(false);
    }
  };

  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const PlatformIcon = ({ platform }: { platform: string }) =>
    platform === 'FACEBOOK' ? (
      <Facebook className="h-5 w-5 text-blue-600" />
    ) : (
      <Instagram className="h-5 w-5 text-pink-600" />
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contas Sociais</h1>
          <p className="text-muted-foreground">Gerir conexoes Facebook e Instagram</p>
        </div>

        {canManage && (
          <Button onClick={handleStartConnect} disabled={connecting}>
            <Link2 className="mr-2 h-4 w-4" />
            {connecting ? 'A conectar...' : 'Conectar conta'}
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">A carregar...</p>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhuma conta conectada.</p>
            {canManage && (
              <Button variant="outline" className="mt-4" onClick={handleStartConnect}>
                Conectar primeira conta
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={account.platform} />
                  <CardTitle className="text-base font-medium">{account.name}</CardTitle>
                </div>
                {account.status !== 'ACTIVE' && (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Plataforma</span>
                    <span>{account.platform === 'FACEBOOK' ? 'Facebook' : 'Instagram'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Estado</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        account.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {account.status === 'ACTIVE' ? 'Activo' : 'Token expirado'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Token expira</span>
                    <span>{new Date(account.tokenExpiresAt).toLocaleDateString('pt')}</span>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full text-destructive hover:text-destructive"
                      onClick={() => disconnectMutation.mutate(account.id)}
                      disabled={disconnectMutation.isPending}
                    >
                      <Unlink className="mr-2 h-3 w-3" />
                      Desconectar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Select accounts dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Selecionar contas para conectar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {availableAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta nova disponivel.</p>
            ) : (
              availableAccounts.map((account) => (
                <div
                  key={`${account.platform}-${account.externalId}`}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <PlatformIcon platform={account.platform} />
                    <div>
                      <p className="text-sm font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.platform === 'FACEBOOK' ? 'Pagina Facebook' : 'Conta Instagram'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleConnectAccount(account)}
                    disabled={connectMutation.isPending}
                  >
                    Conectar
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
