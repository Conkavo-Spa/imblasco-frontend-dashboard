import React from 'react';
import { Button, DatePicker, Select, Input, InputNumber, Popover } from 'antd';
import { SearchOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons';

const ESTADO_OPTIONS = [
    { value: 'all', label: 'Todos' },
    { value: 'sin_cotizacion', label: 'Pendientes' },
    { value: 'conciliada', label: 'Conciliadas' },
];

/**
 * Barra de filtros (layout tipo mockup conciliaciones v2).
 */
export default function ConciliacionesFilters({
    dateRange,
    onDesdeChange,
    onHastaChange,
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
    const desde = dateRange?.[0] ?? null;
    const hasta = dateRange?.[1] ?? null;

    const advancedContent = (
        <div className="flex flex-col gap-3 min-w-[240px] py-1">
            <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#A8A8A2] mb-1">
                    Banco titular
                </div>
                <Select
                    className="w-full"
                    allowClear
                    showSearch
                    placeholder="Todos los bancos"
                    optionFilterProp="label"
                    value={bancoFiltro || undefined}
                    onChange={(v) => onBancoFiltroChange(v ?? null)}
                    options={bancoOptions.map((b) =>
                        typeof b === 'string'
                            ? { value: b, label: b }
                            : { value: b.key, label: b.label }
                    )}
                />
            </div>
            <div className="flex gap-2">
                <div className="flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-[#A8A8A2] mb-1">
                        Monto mín.
                    </div>
                    <InputNumber
                        className="w-full"
                        min={0}
                        placeholder="CLP"
                        value={minMonto}
                        onChange={onMinMontoChange}
                        controls={false}
                    />
                </div>
                <div className="flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-[#A8A8A2] mb-1">
                        Monto máx.
                    </div>
                    <InputNumber
                        className="w-full"
                        min={0}
                        placeholder="CLP"
                        value={maxMonto}
                        onChange={onMaxMontoChange}
                        controls={false}
                    />
                </div>
            </div>
        </div>
    );

    return (
        <div className="mb-4 rounded-lg border border-[#E4E4DF] bg-white px-4 py-3">
            <div className="flex flex-wrap items-end gap-2.5">
                <div className="flex min-w-[200px] flex-1 flex-col gap-1 sm:max-w-[280px]">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#A8A8A2]">
                        Buscar pagador
                    </span>
                    <Input
                        allowClear
                        className="h-[34px] rounded-[5px] border-[#CDCDC7] bg-[#F7F7F5] text-[13px] focus:border-[#1A6B3C]"
                        placeholder="Nombre, RUT o ID…"
                        prefix={<SearchOutlined className="text-[#A8A8A2]" />}
                        value={searchText}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
                <div className="hidden h-[34px] w-px shrink-0 bg-[#E4E4DF] sm:block" aria-hidden />
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#A8A8A2]">
                        Desde
                    </span>
                    <DatePicker
                        className="h-[34px] w-[128px] rounded-[5px] border-[#CDCDC7] bg-[#F7F7F5] font-mono text-[12px]"
                        value={desde}
                        onChange={(d) => onDesdeChange(d)}
                        format="DD/MM/YYYY"
                        allowClear={false}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#A8A8A2]">
                        Hasta
                    </span>
                    <DatePicker
                        className="h-[34px] w-[128px] rounded-[5px] border-[#CDCDC7] bg-[#F7F7F5] font-mono text-[12px]"
                        value={hasta}
                        onChange={(d) => onHastaChange(d)}
                        format="DD/MM/YYYY"
                        allowClear={false}
                    />
                </div>
                <div className="hidden h-[34px] w-px shrink-0 bg-[#E4E4DF] sm:block" aria-hidden />
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#A8A8A2]">
                        Estado
                    </span>
                    <Select
                        className="min-w-[150px]"
                        style={{ height: 34 }}
                        value={estadoFiltro}
                        onChange={onEstadoFiltroChange}
                        options={ESTADO_OPTIONS}
                    />
                </div>
                <Popover content={advancedContent} title="Más filtros" trigger="click" placement="bottomLeft">
                    <Button
                        className="h-[34px] border-[#CDCDC7] bg-transparent text-[#6B6B65]"
                        icon={<FilterOutlined />}
                    >
                        Más filtros
                    </Button>
                </Popover>
                <Button
                    type="primary"
                    className="ml-auto h-[34px] border-none bg-[#1A1A18] px-4 font-semibold hover:!bg-[#333333]"
                    icon={<ReloadOutlined />}
                    onClick={onRefresh}
                    loading={loading}
                >
                    Actualizar
                </Button>
            </div>
        </div>
    );
}
