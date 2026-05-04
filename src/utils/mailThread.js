/**
 * Contrato de datos (mensaje / conversación) para sugerencia IA vs respuesta visible.
 * El backend debe persistir la sugerida y marcar ocultación sin borrar la sugerida.
 */

/** Texto sugerido por IA guardado (no se elimina al enviar respuesta manual). */
export const getPersistedAiSuggestedText = (message) => {
    if (!message) return '';
    const meta = message.metadata || {};
    const raw =
        message.aiSuggestedText ??
        message.aiSuggestedBody ??
        meta.aiSuggestedText ??
        meta.aiSuggestedBody ??
        '';
    return String(raw).trim();
};

/**
 * Si es true, la sugerida no se muestra en el cuerpo del hilo; solo bajo demanda (modal).
 * El usuario ve content.text (p. ej. su respuesta enviada).
 */
export const isAiSuggestionHiddenFromThread = (message) => {
    if (!message) return false;
    const meta = message.metadata || {};
    const v =
        message.hideAiSuggestedInThread ??
        meta.hideAiSuggestedInThread ??
        message.userSupersededAiSuggestion ??
        meta.userSupersededAiSuggestion;
    return v === true;
};

/** Hay sugerida persistida y sustituida en vista: mostrar botón pequeño para verla. */
export const shouldShowViewAiSuggestionButton = (message) =>
    getPersistedAiSuggestedText(message).length > 0 && isAiSuggestionHiddenFromThread(message);

export const getVisibleMessageText = (message) => message?.content?.text ?? '';

/* --- PDF cotización (desde pdf_base64) --- */

export const normalizePdfBase64 = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    let s = raw.trim().replace(/\s/g, '');
    const dataIdx = s.indexOf('base64,');
    if (dataIdx !== -1) {
        s = s.slice(dataIdx + 'base64,'.length);
    }
    return s;
};

export const getCotizacionBase64 = (conv) => {
    if (!conv) return null;
    const fromRoot = normalizePdfBase64(conv.pdf_base64);
    if (fromRoot) return fromRoot;
    const msgs = [...(conv.messages || [])].sort(
        (a, b) => new Date(a.sentAt || 0) - new Date(b.sentAt || 0)
    );
    for (let i = msgs.length - 1; i >= 0; i--) {
        const piece = normalizePdfBase64(msgs[i]?.pdf_base64);
        if (piece) return piece;
    }
    return null;
};

/* --- Último bloque “respuesta IA” para acciones Enviar sugerida / Manual --- */

export const isOutboundAiMessage = (m) => {
    if (!m || m.direction !== 'outbound') return false;
    const meta = m.metadata || {};
    if (m.ai === true || m.isAi === true || m.fromAi === true) return true;
    if (m.source === 'ai' || m.role === 'assistant') return true;
    if (meta.ai === true || meta.source === 'ai' || meta.from === 'assistant') return true;
    return false;
};

export const getLastAiReplyMessageId = (messagesSortedList) => {
    if (!messagesSortedList?.length) return null;
    for (let i = messagesSortedList.length - 1; i >= 0; i--) {
        const m = messagesSortedList[i];
        if (isOutboundAiMessage(m)) return String(m._id ?? '');
    }
    for (let i = messagesSortedList.length - 1; i >= 0; i--) {
        const m = messagesSortedList[i];
        if (m.direction === 'outbound') return String(m._id ?? '');
    }
    return null;
};

/**
 * Mostrar "Enviar respuesta sugerida" / "Responder manualmente".
 * Preferir conversation.pendingReplyChoice del backend; si no viene, heurística legacy.
 */
export const shouldShowReplyChoiceActions = (conversation, message, lastAiReplyMessageId) => {
    if (!message || String(message._id) !== String(lastAiReplyMessageId)) return false;
    if (conversation?.pendingReplyChoice === false) return false;
    if (conversation?.pendingReplyChoice === true) return true;
    return !isAiSuggestionHiddenFromThread(message);
};

/** Intenta fusionar la conversación devuelta por el API tras enviar respuesta. `payload` suele ser `response.data`. */
export const mergeConversationFromApi = (prev, payload) => {
    const next = payload?.conversation ?? payload?.data?.conversation;
    if (next && typeof next === 'object') return { ...prev, ...next };
    return prev;
};
