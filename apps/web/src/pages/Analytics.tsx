import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Eye, Heart, MessageCircle, Share2, TrendingUp } from 'lucide-react';

interface PostMetrics {
  id: string;
  content: string;
  publishedAt: string;
  platform: string;
  accountName: string;
  metrics: {
    reach: number;
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
}

interface Summary {
  totalPosts: number;
  totalReach: number;
  totalImpressions: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
}

export default function Analytics() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: summary } = useQuery<Summary>({
    queryKey: ['analytics-summary', dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (dateFrom) params.from = new Date(dateFrom).toISOString();
      if (dateTo) params.to = new Date(dateTo).toISOString();
      return (await api.get('/analytics/summary', { params })).data;
    },
  });

  const { data: postsData } = useQuery<{ posts: PostMetrics[]; total: number }>({
    queryKey: ['analytics-posts', dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '50' };
      if (dateFrom) params.from = new Date(dateFrom).toISOString();
      if (dateTo) params.to = new Date(dateTo).toISOString();
      return (await api.get('/analytics/posts', { params })).data;
    },
  });

  const posts = postsData?.posts || [];

  const handleExport = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', new Date(dateFrom).toISOString());
    if (dateTo) params.set('to', new Date(dateTo).toISOString());
    const url = `${api.defaults.baseURL}/analytics/export.csv?${params.toString()}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Date filters */}
      <div className="flex gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Ate</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Posts Publicados</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalPosts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alcance Total</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalReach.toLocaleString('pt')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Likes</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalLikes.toLocaleString('pt')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engagement</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(summary.totalComments + summary.totalShares + summary.totalSaves).toLocaleString(
                  'pt',
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.totalComments} coment. + {summary.totalShares} partilhas +{' '}
                {summary.totalSaves} guardados
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Posts table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Posts publicados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Post</th>
                  <th className="pb-2 pr-4">Plataforma</th>
                  <th className="pb-2 pr-4">Data</th>
                  <th className="pb-2 pr-2 text-right">
                    <Eye className="inline h-3 w-3" /> Alcance
                  </th>
                  <th className="pb-2 pr-2 text-right">
                    <Heart className="inline h-3 w-3" /> Likes
                  </th>
                  <th className="pb-2 pr-2 text-right">
                    <MessageCircle className="inline h-3 w-3" /> Coment.
                  </th>
                  <th className="pb-2 text-right">
                    <Share2 className="inline h-3 w-3" /> Partilhas
                  </th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 max-w-[200px] truncate">{post.content}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          post.platform === 'FACEBOOK'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-pink-100 text-pink-700'
                        }`}
                      >
                        {post.platform === 'FACEBOOK' ? 'FB' : 'IG'}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('pt') : '-'}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {post.metrics.reach.toLocaleString('pt')}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {post.metrics.likes.toLocaleString('pt')}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {post.metrics.comments.toLocaleString('pt')}
                    </td>
                    <td className="py-2 text-right">{post.metrics.shares.toLocaleString('pt')}</td>
                  </tr>
                ))}
                {posts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhum post publicado com metricas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
