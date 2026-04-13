import React from 'react';
import { Button, Tag } from 'antd';
import { CheckCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { formatCLP } from '../../../utils/formatCLP';

function formatContable(postDate) {
    if (!postDate) return '—';
    const ymd =
        typeof postDate === 'string' && postDate.length >= 10
            ? postDate.slice(0, 10)
            : null;
    if (!ymd) return '—';
    const d = new Date(`${ymd}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatTxDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-CL');
}

/**
 * @param {object} opts
 * @param {(row: object) => void} opts.onVerDetalle
 * @param {(row: object) => void} [opts.onConciliar]
 * @param {string | null} [opts.conciliandoId]
 */
export function buildTransferenciasTableColumns({
    onVerDetalle,
    onConciliar,
    conciliandoId,
}) {
    return [
        {
            title: 'Estado',
            key: 'estado',
            width: 130,
            fixed: 'left',
            render: (_, record) =>
                record.cotizacion ? (
                    <Tag icon={<CheckCircleOutlined />} color="success">
                        Conciliada
                    </Tag>
                ) : (
                    <Tag icon={<QuestionCircleOutlined />} color="warning">
                        Sin cotización
                    </Tag>
                ),
        },
        {
            title: 'Fecha contable',
            key: 'post_date',
            width: 120,
            render: (_, r) => formatContable(r.post_date),
        },
        {
            title: 'Fecha transacción',
            key: 'transaction_date',
            width: 160,
            render: (_, r) => formatTxDateTime(r.transaction_date),
        },
        {
            title: 'Monto',
            key: 'amount',
            width: 120,
            align: 'right',
            render: (_, r) =>
                typeof r.amount === 'number' ? formatCLP(r.amount) : '—',
        },
        {
            title: 'Titular',
            key: 'counterpartyName',
            width: 200,
            ellipsis: true,
            render: (_, r) => r.counterpartyName || '—',
        },
        {
            title: 'RUT',
            key: 'counterpartyRut',
            width: 120,
            render: (_, r) => r.counterpartyRut || '—',
        },
        {
            title: 'Banco',
            key: 'counterpartyBank',
            width: 160,
            ellipsis: true,
            render: (_, r) => r.counterpartyBank || '—',
        },
        {
            title: 'Cuenta',
            key: 'counterpartyAccount',
            width: 130,
            ellipsis: true,
            render: (_, r) => r.counterpartyAccount || '—',
        },
        {
            title: 'Tipo',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            render: (v) => v || '—',
        },
        {
            title: 'Cotización',
            key: 'cotizacion',
            width: 220,
            render: (_, r) =>
                r.cotizacion ? (
                    <div className="leading-tight">
                        <div className="font-medium">{r.cotizacion.id}</div>
                        {r.cotizacion.cliente ? (
                            <div className="text-gray-700 text-sm mt-0.5">
                                {r.cotizacion.cliente}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    '—'
                ),
        },
        {
            title: 'ID movimiento',
            dataIndex: 'id',
            key: 'id',
            width: 200,
            ellipsis: true,
        },
        {
            title: '',
            key: 'acciones',
            width: 220,
            fixed: 'right',
            render: (_, record) => (
                <div className="flex flex-wrap items-center gap-2 justify-end">
                    {!record.cotizacion && onConciliar ? (
                        <Button
                            type="primary"
                            size="small"
                            className="bg-[#5DD62C]! hover:bg-[#49c61d]! border-none! text-[#061b00]!"
                            loading={conciliandoId === record.id}
                            disabled={
                                conciliandoId !== null && conciliandoId !== record.id
                            }
                            onClick={() => onConciliar(record)}
                        >
                            Conciliar
                        </Button>
                    ) : null}
                    <Button size="small" onClick={() => onVerDetalle(record)}>
                        Ver detalle
                    </Button>
                </div>
            ),
        },
    ];
}
