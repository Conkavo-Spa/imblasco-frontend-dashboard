/**
 * Une sender_account y recipient_account del movimiento Fintoc: a veces el banco
 * completa uno u otro, o reparte datos entre ambos.
 *
 * @param {object | null | undefined} sender
 * @param {object | null | undefined} recipient
 * @returns {{ holder_id: string | null, holder_name: string | null, number: string | null, institution_name: string | null } | null}
 */
export function mergeMovementCounterparty(sender, recipient) {
    const s = sender;
    const r = recipient;
    if (!s && !r) return null;
    if (!s) return normalizeAccount(r);
    if (!r) return normalizeAccount(s);
    const a = normalizeAccount(s);
    const b = normalizeAccount(r);
    return {
        holder_id: pickStr(a.holder_id, b.holder_id),
        holder_name: pickStr(a.holder_name, b.holder_name),
        number: pickStr(a.number, b.number),
        institution_name: pickStr(a.institution_name, b.institution_name),
    };
}

function pickStr(x, y) {
    const sx = x != null && String(x).trim() !== '' ? String(x).trim() : '';
    if (sx) return sx;
    const sy = y != null && String(y).trim() !== '' ? String(y).trim() : '';
    return sy || null;
}

function normalizeAccount(acc) {
    if (!acc) return null;
    return {
        holder_id: acc.holder_id ?? null,
        holder_name: acc.holder_name ?? null,
        number: acc.number ?? null,
        institution_name: acc.institution_name ?? null,
    };
}
