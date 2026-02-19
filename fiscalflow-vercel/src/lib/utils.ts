import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Formata CNPJ: 12345678000190 → 12.345.678/0001-90 */
export function formatCNPJ(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, '');
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/** Formata valor em BRL */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/** Formata data ISO para formato brasileiro */
export function formatDate(date: string | Date): string {
  if (!date) return '—';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return format(parsed, "dd/MM/yyyy", { locale: ptBR });
}

/** Formata data e hora */
export function formatDateTime(date: string | Date): string {
  if (!date) return '—';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return format(parsed, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/** Mapeia tipo de documento para label legível */
export function getDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    NFE: 'NF-e',
    NFCE: 'NFC-e',
    CTE: 'CT-e',
    NFSE: 'NFS-e',
  };
  return labels[type] || type;
}

/** Mapeia status de manifestação para label e cor */
export function getManifestationInfo(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    none: { label: 'Pendente', color: 'bg-amber-100 text-amber-700' },
    acknowledged: { label: 'Ciência', color: 'bg-blue-100 text-blue-700' },
    confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
    unknown: { label: 'Desconhecida', color: 'bg-red-100 text-red-700' },
    unrealized: { label: 'Não Realizada', color: 'bg-gray-100 text-gray-600' },
  };
  return map[status] || { label: status, color: 'bg-gray-100 text-gray-600' };
}

/** Mapeia status SEFAZ para label e cor */
export function getStatusInfo(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    authorized: { label: 'Autorizada', color: 'bg-emerald-100 text-emerald-700' },
    canceled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
    denied: { label: 'Denegada', color: 'bg-orange-100 text-orange-700' },
  };
  return map[status] || { label: status, color: 'bg-gray-100 text-gray-600' };
}

/** Combina classNames condicionalmente */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
