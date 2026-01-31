import React, { useState } from 'react';
import { Layout, Menu, Button } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import imblascoLogo from '../assets/imblasco.png';
import {
    MenuOutlined,
    LineChartOutlined,
    MailOutlined,
    MessageOutlined,
    SettingOutlined,
    LogoutOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(true);

    const toggleSidebar = () => setCollapsed(!collapsed);

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    const getSelectedKey = () => {
        const path = location.pathname || '';
        if (path === '/mails' || path.startsWith('/mails/')) return ['2'];
        if (path === '/chat' || path.startsWith('/chat/')) return ['3'];
        return ['2'];
    };

    // Obtener nombre del usuario del localStorage
    const getUserName = () => {
        // Para este dashboard el usuario visible es fijo
        return 'Diego';
    };

    return (
        <>
            {/* Botón hamburguesa solo visible en mobile */}
            <div className="lg:hidden fixed top-4 left-4 z-50">
                <Button
                    icon={<MenuOutlined />}
                    shape="circle"
                    onClick={toggleSidebar}
                    className="shadow-md bg-[#5DD62C]! hover:bg-[#49c61d]! border-none! text-[#061b00]!"
                />
            </div>

            {/* Sidebar móvil */}
            <div
                className={`fixed top-0 left-0 h-full w-64 bg-[#370776] z-40 transition-transform duration-300 shadow-2xl ${
                    collapsed ? '-translate-x-full' : 'translate-x-0'
                } lg:hidden`}
            >
                <div className="flex flex-col items-center justify-center p-6">
                    <div className="h-16 w-16 rounded-full overflow-hidden bg-white/95 shadow-[0_18px_40px_rgba(0,0,0,0.25)] ring-4 ring-white/15">
                        <img src={imblascoLogo} alt="Imblasco" className="h-full w-full object-cover" />
                    </div>
                    <div className="text-sm text-white/80">Bienvenido, <span className="text-[#5DD62C] font-semibold">{getUserName()}</span></div>
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={getSelectedKey()}
                    onClick={() => setCollapsed(true)}
                    style={{ background: '#370776' }}
                >
                    {/*
                    <Menu.Item key="1" icon={<LineChartOutlined />}>
                        <Link to="/dashboard">Dashboard</Link>
                    </Menu.Item>
                    */}
                    <Menu.Item key="2" icon={<MailOutlined />}>
                        <Link to="/mails">Mails</Link>
                    </Menu.Item>
                    <Menu.Item key="3" icon={<MessageOutlined />}>
                        <Link to="/chat">Chat</Link>
                    </Menu.Item>
                    {/*
                    <Menu.Item key="4" icon={<ExperimentOutlined />}>
                        <Link to="/fine-tuning">Fine tuning</Link>
                    </Menu.Item>
                    */}
                    {/*
                    <Menu.Item key="4" icon={<SettingOutlined />}>
                        <Link to="/ajustes">Ajustes</Link>
                    </Menu.Item>
                    */}
                    <Menu.Item
                        key="logout"
                        icon={<LogoutOutlined />}
                        onClick={handleLogout}
                        className="text-red-200!"
                    >
                        Cerrar sesión
                    </Menu.Item>
                </Menu>
                <div className="text-center text-xs text-white/55 p-3 absolute bottom-0 w-full">
                    © 2020 Lian X
                </div>
            </div>

            {/* Sidebar de escritorio */}
            <Sider
                theme="dark"
                breakpoint="lg"
                collapsedWidth="0"
                width={250}
                className="hidden lg:block h-screen"
                style={{ background: '#370776' }}
            >
                <div className="flex flex-col items-center justify-center p-6">
                    <div className="h-16 w-16 rounded-full overflow-hidden bg-white/95 shadow-[0_18px_40px_rgba(0,0,0,0.25)] ring-4 ring-white/15">
                        <img src={imblascoLogo} alt="Imblasco" className="h-full w-full object-cover" />
                    </div>
                    <div className="text-sm text-white/80">Bienvenido, <span className="text-[#5DD62C] font-semibold">{getUserName()}</span></div>
                </div>
                <Menu theme="dark" mode="inline" selectedKeys={getSelectedKey()} style={{ background: '#370776' }}>
                    {/*
                    <Menu.Item key="1" icon={<LineChartOutlined />}>
                        <Link to="/dashboard">Dashboard</Link>
                    </Menu.Item>
                    */}
                    <Menu.Item key="2" icon={<MailOutlined />}>
                        <Link to="/mails">Mails</Link>
                    </Menu.Item>
                    <Menu.Item key="3" icon={<MessageOutlined />}>
                        <Link to="/chat">Chat</Link>
                    </Menu.Item>
                    {/*
                    <Menu.Item key="4" icon={<ExperimentOutlined />}>
                        <Link to="/fine-tuning">Fine tuning</Link>
                    </Menu.Item>
                    */}
                    {/*
                    <Menu.Item key="4" icon={<SettingOutlined />}>
                        <Link to="/ajustes">Ajustes</Link>
                    </Menu.Item>
                    */}
                    <Menu.Item
                        key="logout"
                        icon={<LogoutOutlined />}
                        onClick={handleLogout}
                        className="text-red-200!"
                    >
                        Cerrar sesión
                    </Menu.Item>
                </Menu>
                <div className="text-center text-xs text-white/55 p-3 absolute bottom-0 w-full">
                    © 2020 Lian X
                </div>
            </Sider>
        </>
    );
};

export default Sidebar;

