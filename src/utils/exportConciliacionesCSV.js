import { formatCLP } from './formatCLP';
import { formatChileRutDisplay } from '../lib/conciliation/formatChileRutDisplay';

export function exportConciliacionesCSV(conciliaciones) {
    if (!conciliaciones || conciliaciones.length === 0) {
        return null;
    }

    const headers = [
        'Fecha Movimiento',
        'Banco',
        'Tipo Movimiento',
        'Monto',
        'Moneda',
        'Tipo Documento',
        'N° Documento',
        'Cliente',
        'RUT',
        'Fecha Conciliación',
    ];

    const rows = conciliaciones.map(c => {
        const dt = c.document_type ?? 'cotizacion';
        const isF = dt === 'factura';
        const docId = isF ? c.factura_id : c.cotizacion_id;

        return [
            c.fecha_movimiento ?? '',
            c.bank_name ?? '',
            c.type ?? 'transfer',
            typeof c.monto === 'number' ? c.monto : '',
            'CLP',
            isF ? 'FAC' : 'COT',
            docId ?? '',
            c.cliente ?? '',
            formatChileRutDisplay(c.rut) ?? '',
            c.createdAt ? new Date(c.createdAt).toLocaleString('es-CL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : '',
        ];
    });

    const csvContent = [
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(row => row.map(cell => {
            const cellStr = String(cell ?? '');
            return `"${cellStr.replace(/"/g, '""')}"`;
        }).join(',')),
    ].join('\n');

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const filename = `conciliaciones_${dateStr}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    link.click();
}
