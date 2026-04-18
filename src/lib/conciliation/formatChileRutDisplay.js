/**
 * Formatea un RUT chileno para UI a partir de dígitos + DV (sin puntos ni guión).
 * @param {string | null | undefined} rutDigits - ej. "652407749" o "65.240.774-9"
 * @returns {string}
 */
export function formatChileRutDisplay(rutDigits) {
    const raw = String(rutDigits ?? '').trim();
    if (!raw) return '—';
    const cleaned = raw.replace(/\./g, '').replace(/-/g, '');
    const only = cleaned.replace(/\D/g, '');
    if (only.length < 2) return raw;
    const dv = only.slice(-1);
    const body = only.slice(0, -1);
    if (!body) return raw;
    const rev = body.split('').reverse().join('');
    let dotted = '';
    for (let i = 0; i < rev.length; i++) {
        if (i > 0 && i % 3 === 0) dotted += '.';
        dotted += rev[i];
    }
    const num = dotted.split('').reverse().join('');
    return `${num}-${dv.toUpperCase()}`;
}
