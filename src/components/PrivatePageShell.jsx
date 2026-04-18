import React from 'react';
import Sidebar from './Sidebar';

/**
 * Layout común de pantallas privadas: mismo fondo, sidebar y padding horizontal
 * que Mails / Chat (sin ancho máximo extra — el contenido usa todo el ancho útil).
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {React.RefObject<HTMLDivElement>} [props.mainRef] — opcional, p. ej. Chat para scroll programático
 */
export default function PrivatePageShell({ children, mainRef }) {
    return (
        <div className="flex h-screen overflow-hidden bg-[#f6f2ff]">
            <Sidebar />
            <div
                ref={mainRef}
                className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto pt-16 px-4 pb-8 lg:pt-8 lg:px-8"
            >
                {children}
            </div>
        </div>
    );
}
