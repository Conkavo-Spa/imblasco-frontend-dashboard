function rutDigits(s) {
    return String(s ?? '').replace(/\D/g, '');
}

/**
 * @param {object} f
 * @param {'all' | 'conciliada' | 'sin_cotizacion'} f.estado
 * @param {string} f.search
 * @param {number | null} f.minMonto
 * @param {number | null} f.maxMonto
 * @param {string | null} f.banco — valor exacto institution_name
 */
export function filterTransferenciaRows(rows, f) {
    let out = rows;

    if (f.estado !== 'all') {
        out = out.filter((r) =>
            f.estado === 'conciliada' ? r.cotizacion != null : r.cotizacion == null
        );
    }

    if (f.banco) {
        out = out.filter((r) => r.counterpartyBank === f.banco);
    }

    if (f.minMonto != null && Number.isFinite(f.minMonto)) {
        out = out.filter((r) => typeof r.amount === 'number' && r.amount >= f.minMonto);
    }
    if (f.maxMonto != null && Number.isFinite(f.maxMonto)) {
        out = out.filter((r) => typeof r.amount === 'number' && r.amount <= f.maxMonto);
    }

    const q = f.search.trim().toLowerCase();
    if (q) {
        const qDigits = rutDigits(q);
        out = out.filter((r) => {
            const hay = [
                r.counterpartyName,
                r.counterpartyRut,
                r.cotizacion?.id,
                r.cotizacion?.cliente,
                r.cotizacion?.nombre,
                r.cotizacion?.rut,
                r.id,
            ]
                .filter(Boolean)
                .map((x) => String(x).toLowerCase());
            if (hay.some((s) => s.includes(q))) return true;
            if (qDigits.length >= 2) {
                const rr = rutDigits(r.counterpartyRut);
                const qr = rutDigits(r.cotizacion?.rut);
                if (rr.includes(qDigits) || qr.includes(qDigits)) return true;
            }
            return false;
        });
    }

    return out;
}
