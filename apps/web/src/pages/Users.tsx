import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UserPlus } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  OWNER: 'Proprietario',
  ADMIN: 'Administrador',
  EDITOR: 'Editor',
  APPROVER: 'Aprovador',
  VIEWER: 'Visualizador',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Activo',
  INVITED: 'Convidado',
  DISABLED: 'Desactivado',
};

export default function Users() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'EDITOR' });
  const [inviteError, setInviteError] = useState('');

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; name: string; role: string }) => {
      return api.post('/users/invite', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDialogOpen(false);
      setInviteForm({ email: '', name: '', role: 'EDITOR' });
      setInviteError('');
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setInviteError(axiosErr.response?.data?.error || 'Erro ao convidar');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return api.patch(`/users/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const canManageUsers = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Utilizadores</h1>
          <p className="text-muted-foreground">Gerir equipa</p>
        </div>

        {canManageUsers && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Convidar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar utilizador</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  inviteMutation.mutate(inviteForm);
                }}
                className="space-y-4"
              >
                {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}

                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="ADMIN">Administrador</option>
                    <option value="EDITOR">Editor</option>
                    <option value="APPROVER">Aprovador</option>
                    <option value="VIEWER">Visualizador</option>
                  </select>
                </div>

                <Button type="submit" className="w-full" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? 'A enviar...' : 'Enviar convite'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">A carregar...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {users.length} utilizador{users.length !== 1 ? 'es' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-secondary px-2 py-1 text-xs">
                      {roleLabels[u.role] || u.role}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        u.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : u.status === 'INVITED'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {statusLabels[u.status] || u.status}
                    </span>
                    {canManageUsers && u.role !== 'OWNER' && u.id !== currentUser?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            id: u.id,
                            status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                          })
                        }
                      >
                        {u.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
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
