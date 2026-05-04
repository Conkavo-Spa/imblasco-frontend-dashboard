import React from 'react';
import { Modal } from 'antd';

const AiSuggestedReplyModal = ({ open, onCancel, suggestedText }) => (
    <Modal
        title="Sugerencia de la IA"
        open={open}
        onCancel={onCancel}
        footer={null}
        width={560}
        destroyOnClose
    >
        <p className="text-xs text-gray-500 mb-2">
            Este texto se guarda en el hilo aunque hayas enviado tu propia respuesta al cliente.
        </p>
        <div className="whitespace-pre-wrap wrap-anywhere max-h-[60vh] overflow-y-auto rounded border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800 text-sm">
            {suggestedText || '—'}
        </div>
    </Modal>
);

export default AiSuggestedReplyModal;
