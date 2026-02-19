import React, { useEffect, useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, EmptyState, Button } from '@/components/ui';
import {
  formatCurrency, formatDate, getDocumentTypeLabel,
  getManifestationInfo, getStatusInfo, cn,
} from '@/lib/utils';
import {
  FileText, DollarSign, AlertCircle, CheckCircle2,
  TrendingUp, Building2, RefreshCw, ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const CHART_COLORS = ['#0ea5e9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490'];

export default function Dashboard() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchDashboard = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const now = new Date();
      const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Total de documentos e valor
      const { data: docs } = await supabase
        .from('documents')
        .select('id, document_type, total_value, status, manifestation_status, issue_date, document_number, series, suppliers(name, cnpj_cpf)')
        .eq('company_id', selectedCompany.id)
        .gte('issue_date', dateFrom)
        .order('issue_date', { ascending: false });

      const allDocs = docs || [];
      const totalValue = allDocs.reduce((s: number, d: any) => s + parseFloat(d.total_value || '0'), 0);
      const manifSummary = allDocs.filter((d: any) => d.document_type === 'NFE')
        .reduce((acc: Record<string, number>, d: any) => { acc[d.manifestation_status] = (acc[d.manifestation_status] || 0) + 1; return acc; }, {});
      const typeSummary = allDocs.reduce((acc: Record<string, number>, d: any) => { acc[d.document_type] = (acc[d.document_type] || 0) + 1; return acc; }, {});

      // Agrupa por dia
      const dailyChart = allDocs.reduce((acc: Record<string, { count: number; value: number }>, d: any) => {
        const day = d.issue_date?.split('T')[0] || '';
        if (!day) return acc;
        if (!acc[day]) acc[day] = { count: 0, value: 0 };
        acc[day].count++;
        acc[day].value += parseFloat(d.total_value || '0');
        return acc;
      }, {});

      setData({
        kpis: { total_documents: allDocs.length, total_value: totalValue, manifestation_summary: manifSummary, type_summary: typeSummary },
        recent_documents: allDocs.slice(0, 10),
        charts: { daily: Object.entries(dailyChart).map(([date, d]) => ({ date, count: d.count, value: d.value })) },
      });
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedCompany?.id]);

  const triggerSync = async () => {
    if (!selectedCompany) return;
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ company_id: selectedCompany.id }),
      });
      // Por enquanto, sync manual via Edge Function — a implementar
      setTimeout(fetchDashboard, 3000);
    } catch (err) {
      console.error('Erro ao sincronizar:', err);
    } finally {
      setTimeout(() => setSyncing(false), 3000);
    }
  };

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={<Building2 className="h-12 w-12" />}
        title="Nenhuma empresa cadastrada"
        description="Cadastre uma empresa em Configurações para começar a usar o FiscalFlow."
        action={<Button onClick={() => navigate('/settings')}>Ir para Configurações</Button>}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const recent = data?.recent_documents || [];

  // Dados para gráfico de pizza de tipos
  const typeData = Object.entries(kpis.type_summary || {}).map(([key, value]) => ({
    name: getDocumentTypeLabel(key),
    value: value as number,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão geral dos documentos fiscais deste mês
          </p>
        </div>
        <Button
          variant="outline"
          onClick={triggerSync}
          disabled={syncing}
        >
          <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
          {syncing ? 'Sincronizando...' : 'Sincronizar SEFAZ'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Total de Documentos</span>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-4.5 w-4.5 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-display font-bold">{kpis.total_documents || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Valor Total</span>
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="h-4.5 w-4.5 text-emerald-600" />
              </div>
            </div>
            <p className="text-3xl font-display font-bold">{formatCurrency(kpis.total_value || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Pendentes Manifestação</span>
              <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertCircle className="h-4.5 w-4.5 text-amber-600" />
              </div>
            </div>
            <p className="text-3xl font-display font-bold">
              {kpis.manifestation_summary?.none || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Confirmadas</span>
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
              </div>
            </div>
            <p className="text-3xl font-display font-bold">
              {kpis.manifestation_summary?.confirmed || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart - Documentos por dia */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-primary" />
              Documentos por Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {charts.daily?.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={charts.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => v.split('-').slice(1).join('/')}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                    }}
                  />
                  <Bar dataKey="count" name="Qtd" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                Nenhum dado para exibir neste período
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pie chart - Tipos de documento */}
        <Card>
          <CardHeader>
            <CardTitle>Por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {typeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
            )}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {typeData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  {item.name}: {item.value}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documentos Recentes</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="pb-3 font-medium text-muted-foreground">Número</th>
                    <th className="pb-3 font-medium text-muted-foreground">Fornecedor</th>
                    <th className="pb-3 font-medium text-muted-foreground">Data</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Valor</th>
                    <th className="pb-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recent.map((doc: any) => {
                    const statusInfo = getStatusInfo(doc.status);
                    const manifInfo = getManifestationInfo(doc.manifestation_status);
                    return (
                      <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3">
                          <Badge variant="secondary">{getDocumentTypeLabel(doc.document_type)}</Badge>
                        </td>
                        <td className="py-3 font-mono text-xs">{doc.document_number}/{doc.series}</td>
                        <td className="py-3 max-w-48 truncate">{doc.suppliers?.name || '—'}</td>
                        <td className="py-3 text-muted-foreground">{formatDate(doc.issue_date)}</td>
                        <td className="py-3 text-right font-medium">{formatCurrency(doc.total_value)}</td>
                        <td className="py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusInfo.color)}>
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum documento encontrado. Sincronize com a SEFAZ para importar seus documentos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
