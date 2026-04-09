import React from 'react';
import { Button, Tag } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { formatCLP } from '../../../utils/formatCLP';

/**
 * @param {object} opts
 * @param {string | null} opts.checkingId
 * @param {Record<string, 'pendiente' | 'conciliada' | 'sin_match'>} opts.estadoPorCotizacion
 * @param {Record<string, object>} opts.movimientoPorCotizacion
 * @param {(record: { id: string, fecha: string, monto: number, hora?: string }) => void} opts.onRevisar
 * @param {(id: string) => void} opts.onVerDetalle
 */
export function buildConciliacionesTableColumns({
    checkingId,
    estadoPorCotizacion,
    movimientoPorCotizacion,
    onRevisar,
    onVerDetalle,
}) {
    return [
        {
            title: 'ID cotización',
            key: 'id',
            width: 200,
            render: (_, record) => (
                <div className="leading-tight">
                    <div>{record.id}</div>
                    {record.cliente ? (
                        <div className="font-bold text-gray-900 mt-0.5">{record.cliente}</div>
                    ) : null}
                </div>
            ),
        },
        {
            title: 'Estado',
            key: 'estado',
            width: 130,
            render: (_, record) => {
                const e = estadoPorCotizacion[record.id] || 'pendiente';
                if (e === 'conciliada') {
                    return (
                        <Tag icon={<CheckCircleOutlined />} color="success">
                            Conciliada
                        </Tag>
                    );
                }
                if (e === 'sin_match') {
                    return <Tag color="warning">Sin abono</Tag>;
                }
                return <Tag color="default">Pendiente</Tag>;
            },
        },
        { title: 'Fecha', dataIndex: 'fecha', key: 'fecha', width: 120 },
        { title: 'Hora', dataIndex: 'hora', key: 'hora', width: 90 },
        {
            title: 'Monto',
            dataIndex: 'monto',
            key: 'monto',
            align: 'right',
            render: (v) => formatCLP(v),
        },
        {
            title: '',
            key: 'acciones',
            width: 210,
            fixed: 'right',
            render: (_, record) => {
                const e = estadoPorCotizacion[record.id] || 'pendiente';
                const hasMov = !!movimientoPorCotizacion[record.id];
                if (e === 'conciliada') {
                    return (
                        <div className="flex items-center gap-2">
                            <Button
                                type="text"
                                size="small"
                                disabled
                                className="text-[#237804]! cursor-default!"
                                icon={<CheckCircleOutlined />}
                            >
                                Validada
                            </Button>
                            <Button
                                size="small"
                                disabled={!hasMov}
                                onClick={() => onVerDetalle(record.id)}
                            >
                                Ver detalle
                            </Button>
                        </div>
                    );
                }
                return (
                    <Button
                        type="primary"
                        size="small"
                        loading={checkingId === record.id}
                        disabled={checkingId !== null && checkingId !== record.id}
                        className="bg-[#5DD62C]! hover:bg-[#49c61d]! border-none! text-[#061b00]!"
                        onClick={() => onRevisar(record)}
                    >
                        Revisar
                    </Button>
                );
            },
        },
    ];
}
