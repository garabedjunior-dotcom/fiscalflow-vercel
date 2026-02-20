import React, { useEffect, useState, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/lib/supabase';
import { apiPost } from '@/lib/api';
import {
  Card, CardContent, Button, Input, Select, Dialog,
  Badge, Spinner, EmptyState,
} from '@/components/ui';
import {
  formatCurrency, formatDate, formatDateTime, formatCNPJ,
  getDocumentTypeLabel, getManifestationInfo, getStatusInfo, cn,
} from '@/lib/utils';
import {
  Search, Filter, Download, FileText, ChevronLeft, ChevronRight,
  Eye, ClipboardCheck, Building2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DOC_TYPE_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'NFE', label: 'NF-e' },
  { value: 'NFCE', label: 'NFC-e' },
  { value: 'CTE', label: 'CT-e' },
  { value: 'NFSE', label: 'NFS-e' },
];

const MANIFESTATION_OPTIONS = [
  { value: '', label: 'Todas manifestações' },
  { value: 'none', label: 'Pendente' },
  { value: 'acknowledged', label: 'Ciência' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'unknown', label: 'Desconhecida' },
  { value: 'unrealized', label: 'Não Realizada' },
];

const MANIFEST_ACTIONS = [
  { value: 'ciencia', label: 'Ciência da Operação' },
  { value: 'confirmacao', label: 'Confirmação da Operação' },
  { value: 'desconhecimento', label: 'Desconhecimento da Operação' },
  { value: 'nao_realizada', label: 'Operação Não Realizada' },
];

export default function Documents() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();

  // State
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [manifestFilter, setManifestFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [manifesting, setManifesting] = useState(false);
  const [justification, setJustification] = useState('');

  const fetchDocuments = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const offset = (page - 1) * 20;
      let query = supabase
        .from('documents')
        .select('*, suppliers(id, cnpj_cpf, name)', { count: 'exact' })
        .eq('company_id', selectedCompany.id);

      if (typeFilter) query = query.eq('document_type', typeFilter.toUpperCase());
      if (manifestFilter) query = query.eq('manifestation_status', manifestFilter);
      if (dateFrom) query = query.gte('issue_date', dateFrom);
      if (dateTo) query = query.lte('issue_date', dateTo);

      // Text search on supplier — do a pre-query
      if (search) {
        const { data: sups } = await supabase
          .from('suppliers')
          .select('id')
          .or(`name.ilike.%${search}%,cnpj_cpf.ilike.%${search}%`);
        if (sups && sups.length > 0) {
          query = query.in('supplier_id', sups.map(s => s.id));
        } else {
          setDocuments([]); setTotal(0); setTotalPages(0); setLoading(false); return;
        }
      }

      query = query.order('issue_date', { ascending: false }).range(offset, offset + 19);
      const { data, error, count } = await query;
      setDocuments(data || []);
      setTotal(count || 0);
      setTotalPages(Math.ceil((count || 0) / 20));
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany?.id, page, search, typeFilter, manifestFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, manifestFilter, dateFrom, dateTo]);

  const handleDownload = async (docId: string, fileType: 'xml' | 'pdf') => {
    try {
      // Para agora, mostrar mensagem — o download via Nuvem Fiscal requer Edge Function dedicada
      alert(`Download de ${fileType.toUpperCase()} será implementado via integração com a Nuvem Fiscal. Chave de acesso do documento disponível nos detalhes.`);
    } catch (err) {
      alert('Erro ao baixar arquivo.');
    }
  };

  const handleManifest = async (docId: string, type: string) => {
    const needsJustification = ['desconhecimento', 'nao_realizada'].includes(type);
    if (needsJustification && !justification.trim()) {
      alert('Justificativa é obrigatória para este tipo de manifestação.');
      return;
    }

    setManifesting(true);
    try {
      await apiPost('/api/documents/manifest', {
        document_id: docId,
        manifestation_type: type,
        justification: justification || undefined,
      });
      setSelectedDoc(null);
      setJustification('');
      fetchDocuments();
    } catch (err: any) {
      alert(err.message || 'Erro ao manifestar documento.');
    } finally {
      setManifesting(false);
    }
  };

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={<Building2 className="h-12 w-12" />}
        title="Selecione uma empresa"
        description="Cadastre uma empresa em Configurações para visualizar documentos."
        action={<Button onClick={() => navigate('/settings')}>Ir para Configurações</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Documentos Fiscais</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {total} documento{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar fornecedor (nome ou CNPJ)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Select
              options={DOC_TYPE_OPTIONS}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
            <Select
              options={MANIFESTATION_OPTIONS}
              value={manifestFilter}
              onChange={(e) => setManifestFilter(e.target.value)}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 h-10 px-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                title="Data início"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 h-10 px-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                title="Data fim"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner className="h-8 w-8" />
            </div>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-12 w-12" />}
              title="Nenhum documento encontrado"
              description="Tente ajustar os filtros ou sincronize com a SEFAZ."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Nº / Série</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Fornecedor</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Data Emissão</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Valor</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">SEFAZ</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Manifestação</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {documents.map((doc) => {
                      const statusInfo = getStatusInfo(doc.status);
                      const manifInfo = getManifestationInfo(doc.manifestation_status);
                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-muted/20 transition-colors cursor-pointer"
                          onClick={() => setSelectedDoc(doc)}
                        >
                          <td className="p-3">
                            <Badge variant="secondary">
                              {getDocumentTypeLabel(doc.document_type)}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {doc.document_number}/{doc.series}
                          </td>
                          <td className="p-3 max-w-48 truncate">
                            {doc.suppliers?.name || '—'}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {formatDate(doc.issue_date)}
                          </td>
                          <td className="p-3 text-right font-medium">
                            {formatCurrency(doc.total_value)}
                          </td>
                          <td className="p-3">
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusInfo.color)}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', manifInfo.color)}>
                              {manifInfo.label}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleDownload(doc.id, 'xml')}
                                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
                                title="Baixar XML"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDownload(doc.id, 'pdf')}
                                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-primary"
                                title="Baixar DANFE"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Próxima <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Document Detail Modal */}
      <Dialog
        open={!!selectedDoc}
        onClose={() => { setSelectedDoc(null); setJustification(''); }}
        title="Detalhes do Documento"
        maxWidth="max-w-3xl"
      >
        {selectedDoc && (
          <div className="space-y-6">
            {/* Info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoItem label="Tipo" value={getDocumentTypeLabel(selectedDoc.document_type)} />
              <InfoItem label="Número / Série" value={`${selectedDoc.document_number} / ${selectedDoc.series}`} />
              <InfoItem label="Chave de Acesso" value={selectedDoc.access_key} mono />
              <InfoItem label="Data de Emissão" value={formatDateTime(selectedDoc.issue_date)} />
              <InfoItem label="Valor Total" value={formatCurrency(selectedDoc.total_value)} />
              <InfoItem label="Protocolo" value={selectedDoc.protocol || '—'} />
              <InfoItem
                label="Fornecedor"
                value={selectedDoc.suppliers?.name || '—'}
              />
              <InfoItem
                label="CNPJ Fornecedor"
                value={selectedDoc.suppliers?.cnpj_cpf ? formatCNPJ(selectedDoc.suppliers.cnpj_cpf) : '—'}
              />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status SEFAZ</p>
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getStatusInfo(selectedDoc.status).color)}>
                  {getStatusInfo(selectedDoc.status).label}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Manifestação</p>
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getManifestationInfo(selectedDoc.manifestation_status).color)}>
                  {getManifestationInfo(selectedDoc.manifestation_status).label}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => handleDownload(selectedDoc.id, 'xml')}>
                <Download className="h-4 w-4" /> Baixar XML
              </Button>
              <Button variant="outline" onClick={() => handleDownload(selectedDoc.id, 'pdf')}>
                <FileText className="h-4 w-4" /> Baixar DANFE
              </Button>
            </div>

            {/* Manifestation */}
            {selectedDoc.document_type === 'NFE' && (
              <div className="pt-4 border-t space-y-3">
                <h4 className="font-medium font-display flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                  Manifestação do Destinatário
                </h4>

                <Input
                  placeholder="Justificativa (obrigatória para desconhecimento e não realizada)"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                />

                <div className="flex flex-wrap gap-2">
                  {MANIFEST_ACTIONS.map((action) => (
                    <Button
                      key={action.value}
                      variant="outline"
                      size="sm"
                      disabled={manifesting}
                      onClick={() => handleManifest(selectedDoc.id, action.value)}
                    >
                      {manifesting ? <Spinner className="h-3 w-3" /> : null}
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={cn('text-sm font-medium break-all', mono && 'font-mono text-xs')}>{value}</p>
    </div>
  );
}
