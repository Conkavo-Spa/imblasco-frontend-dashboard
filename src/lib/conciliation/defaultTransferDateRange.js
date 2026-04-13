import dayjs from 'dayjs';

/** Ventana inicial: últimos N días hasta hoy (fechas contables inclusive). */
export const DEFAULT_TRANSFER_LOOKBACK_DAYS = 60;

export function getDefaultTransferDateRange() {
    const until = dayjs();
    const since = until.subtract(DEFAULT_TRANSFER_LOOKBACK_DAYS, 'day');
    return {
        since: since.format('YYYY-MM-DD'),
        until: until.format('YYYY-MM-DD'),
    };
}
