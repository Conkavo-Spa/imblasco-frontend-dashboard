import React from 'react';
import {
    Button,
    DatePicker,
    Select,
    Input,
    InputNumber,
    Row,
    Col,
} from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';

const { RangePicker } = DatePicker;

const ESTADO_OPTIONS = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'conciliada', label: 'Conciliada (con seed)' },
    { value: 'sin_cotizacion', label: 'Sin cotización en seed' },
];

/**
 * Barra de filtros para la tabla de transferencias (conciliación).
 */
export default function ConciliacionesFilters({
    dateRange,
    onDateRangeChange,
    estadoFiltro,
    onEstadoFiltroChange,
    searchText,
    onSearchChange,
    minMonto,
    maxMonto,
    onMinMontoChange,
    onMaxMontoChange,
    bancoFiltro,
    onBancoFiltroChange,
    bancoOptions,
    onRefresh,
    loading,
}) {
    return (
        <div className="mb-4 p-4 bg-white/80 rounded-xl border border-[#370776]/10">
            <Row gutter={[12, 12]} align="bottom">
                <Col xs={24} lg={7}>
                    <div className="text-xs text-gray-500 mb-1">Rango de fechas (contable)</div>
                    <RangePicker
                        className="w-full"
                        value={dateRange}
                        onChange={onDateRangeChange}
                        format="DD/MM/YYYY"
                        allowClear={false}
                    />
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <div className="text-xs text-gray-500 mb-1">Estado</div>
                    <Select
                        className="w-full"
                        value={estadoFiltro}
                        onChange={onEstadoFiltroChange}
                        options={ESTADO_OPTIONS}
                    />
                </Col>
                <Col xs={24} sm={12} lg={5}>
                    <div className="text-xs text-gray-500 mb-1">Buscar (RUT, nombre, ID…)</div>
                    <Input
                        allowClear
                        placeholder="RUT, titular, cotización…"
                        prefix={<SearchOutlined className="text-gray-400" />}
                        value={searchText}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </Col>
                <Col xs={12} sm={8} lg={3}>
                    <div className="text-xs text-gray-500 mb-1">Monto mín.</div>
                    <InputNumber
                        className="w-full"
                        min={0}
                        placeholder="CLP"
                        value={minMonto}
                        onChange={onMinMontoChange}
                        controls={false}
                    />
                </Col>
                <Col xs={12} sm={8} lg={3}>
                    <div className="text-xs text-gray-500 mb-1">Monto máx.</div>
                    <InputNumber
                        className="w-full"
                        min={0}
                        placeholder="CLP"
                        value={maxMonto}
                        onChange={onMaxMontoChange}
                        controls={false}
                    />
                </Col>
                <Col xs={24} sm={12} lg={2}>
                    <div className="text-xs text-gray-500 mb-1">&nbsp;</div>
                    <Button
                        className="w-full"
                        icon={<ReloadOutlined />}
                        onClick={onRefresh}
                        loading={loading}
                    >
                        Actualizar
                    </Button>
                </Col>
            </Row>
            <Row gutter={[12, 12]} className="mt-3">
                <Col xs={24} md={12} lg={10}>
                    <div className="text-xs text-gray-500 mb-1">Banco titular</div>
                    <Select
                        className="w-full"
                        allowClear
                        showSearch
                        placeholder="Todos los bancos"
                        optionFilterProp="label"
                        value={bancoFiltro || undefined}
                        onChange={(v) => onBancoFiltroChange(v ?? null)}
                        options={bancoOptions.map((b) => ({ value: b, label: b }))}
                    />
                </Col>
            </Row>
        </div>
    );
}
