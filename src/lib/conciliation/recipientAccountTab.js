/**
 * Clave estable para agrupar movimientos por cuenta receptora (extracto Fintoc).
 * @param {object | null | undefined} recipient
 * @returns {string} cadena vacía si no hay datos
 */
export function recipientAccountTabKey(recipient) {
    if (!recipient) return '';
    const inst = String(recipient.institution_name ?? '').trim();
    const num = String(recipient.number ?? '').trim();
    if (!inst && !num) return '';
    return `${inst}||${num}`;
}

/**
 * @param {object | null | undefined} recipient
 * @returns {string}
 */
export function formatRecipientAccountLabel(recipient) {
    if (!recipient) return 'Cuenta vinculada';
    const inst = String(recipient.institution_name ?? '').trim() || 'Banco';
    const num = String(recipient.number ?? '').trim();
    if (num) return `${inst} · ${num}`;
    return inst;
}
