import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const signupSchema = z.object({
  tenantName: z.string().min(2, 'Minimo 2 caracteres'),
  tenantSlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Apenas letras minusculas, numeros e hifens'),
  country: z.enum(['AO', 'MZ', 'CV', 'ST', 'GW']),
  name: z.string().min(2, 'Minimo 2 caracteres'),
  email: z.string().email('Email invalido'),
  password: z.string().min(8, 'Minimo 8 caracteres'),
});

type SignupForm = z.infer<typeof signupSchema>;

const countries = [
  { value: 'AO', label: 'Angola' },
  { value: 'MZ', label: 'Mocambique' },
  { value: 'CV', label: 'Cabo Verde' },
  { value: 'ST', label: 'Sao Tome e Principe' },
  { value: 'GW', label: 'Guine-Bissau' },
];

export default function Signup() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { country: 'AO' },
  });

  const onSubmit = async (data: SignupForm) => {
    setError('');
    try {
      const res = await api.post('/auth/signup', data);
      setAuth(res.data.user, res.data.tenant, res.data.accessToken, res.data.refreshToken);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Erro ao criar conta');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Criar Conta</CardTitle>
          <CardDescription>Registe a sua empresa no COMUNICA Social</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tenantName">Nome da empresa</Label>
              <Input id="tenantName" {...register('tenantName')} />
              {errors.tenantName && (
                <p className="text-xs text-destructive">{errors.tenantName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenantSlug">Slug (URL)</Label>
              <Input id="tenantSlug" placeholder="minha-empresa" {...register('tenantSlug')} />
              {errors.tenantSlug && (
                <p className="text-xs text-destructive">{errors.tenantSlug.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Pais</Label>
              <select
                id="country"
                {...register('country')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {countries.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Seu nome</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'A criar...' : 'Criar conta'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Ja tem conta?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
      <a href="/landing.html" className="mt-4 text-sm text-muted-foreground hover:underline">
        ← Voltar ao site
      </a>
    </div>
  );
}
