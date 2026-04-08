/**
 * Formato moneda CLP (enteros, sin decimales).
 * @param {number} value
 * @returns {string}
 */
export function formatCLP(value) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0,
    }).format(value);
}
