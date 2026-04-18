/**
 * Demo: cotizaciones del seed que aparecen ya conciliadas al cargar la pantalla.
 * El movimiento en Fintoc debe seguir existiendo con la misma fecha contable y monto.
 * El resto de coincidencias seed ↔ movimiento quedan pendientes para usar el flujo Conciliar.
 */
export const SEED_IDS_PRECONCILIADAS_DEMO = new Set(['COT-001', 'COT-002']);

/**
 * Filtro temporal de bancos para demo UX.
 * Se muestra aunque los movimientos actuales no calcen con estos nombres.
 */
export const BANCOS_FILTRO_DEMO = [
    { key: 'Santander', label: 'Santander', subtitle: 'Cuenta Corriente' },
    { key: 'BancoEstado', label: 'BancoEstado', subtitle: 'Cuenta Corriente' },
    { key: 'Itaú', label: 'Itaú', subtitle: 'Cuenta Corriente' },
    { key: 'Scotiabank', label: 'Scotiabank', subtitle: 'Cuenta Corriente' },
];
