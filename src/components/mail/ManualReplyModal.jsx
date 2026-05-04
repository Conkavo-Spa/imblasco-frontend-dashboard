import React from 'react';
import { Button, Input, Modal, Upload } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';

const ManualReplyModal = ({
    open,
    onCancel,
    customerEmail,
    replyBody,
    onReplyBodyChange,
    replyFileList,
    onReplyUploadChange,
    onSend,
    sending,
}) => (
    <Modal
        title="Responder correo"
        open={open}
        onCancel={onCancel}
        width={640}
        destroyOnClose
        footer={
            <div className="flex justify-end gap-2">
                <Button onClick={onCancel}>Cancelar</Button>
                <Button type="primary" loading={sending} onClick={onSend}>
                    Enviar respuesta
                </Button>
            </div>
        }
    >
        <div className="mb-3 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Para: </span>
            {customerEmail || '—'}
        </div>
        <Input.TextArea
            value={replyBody}
            onChange={(e) => onReplyBodyChange(e.target.value)}
            placeholder="Escribí tu respuesta..."
            autoSize={{ minRows: 8, maxRows: 16 }}
            className="mb-4"
        />
        <Upload fileList={replyFileList} beforeUpload={() => false} onChange={onReplyUploadChange} multiple>
            <Button icon={<PaperClipOutlined />}>Adjuntar archivos</Button>
        </Upload>
        <p className="mt-2 text-xs text-gray-500">
            Los adjuntos se envían junto al texto cuando el backend reciba el envío.
        </p>
    </Modal>
);

export default ManualReplyModal;
