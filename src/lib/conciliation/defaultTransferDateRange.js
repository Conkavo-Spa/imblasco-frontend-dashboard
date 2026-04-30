import dayjs from 'dayjs';

// Fecha de inicio del sistema de conciliaciones — no cambia con el tiempo
export const CONCILIATION_START_DATE = '2026-04-29';
export const DEFAULT_TRANSFER_LOOKBACK_DAYS = dayjs().diff(dayjs(CONCILIATION_START_DATE), 'day');

export function getDefaultTransferDateRange() {
    return {
        since: CONCILIATION_START_DATE,
        until: dayjs().format('YYYY-MM-DD'),
    };
}
