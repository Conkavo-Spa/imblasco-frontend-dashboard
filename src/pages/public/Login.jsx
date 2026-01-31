import React, { useState } from 'react';
import { Button, Form, Input, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import imblascoLogo from '../../assets/imblasco.png';
import lianxLogo from '../../assets/lianx.png';

// Credenciales hardcodeadas
const HARDCODED_USER = {
    email: 'diego@imblasco.cl',
    password: 'Rt5YulO',
    _id: 'hardcoded-user-id',
    name: 'Diego',
    active: true
};

const Login = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onFinish = async (values) => {
        try {
            setLoading(true);

            // Simular delay de API
            await new Promise(resolve => setTimeout(resolve, 500));

            // Validar credenciales hardcodeadas
            if (values.mail === HARDCODED_USER.email && values.password === HARDCODED_USER.password) {
                message.success('Inicio de sesión exitoso');
                localStorage.setItem('user', JSON.stringify(HARDCODED_USER));
                navigate('/dashboard');
            } else {
                message.error('Credenciales incorrectas');
            }
        } catch (error) {
            message.error('Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex items-center justify-center min-h-screen overflow-hidden px-4">
            <div className="mesh-bg"></div>

            <div className="z-10 bg-white/95 backdrop-blur p-10 md:p-14 lg:p-16 rounded-2xl shadow-2xl w-full max-w-md border border-white/30">
                <Form onFinish={onFinish} className="space-y-6">
                    <div className="text-center mb-4">
                        <div className="brand-logos" aria-hidden="true">
                            <div className="brand-circle brand-circle--left">
                                <img src={imblascoLogo} alt="Imblasco" />
                            </div>
                            <div className="brand-circle brand-circle--right">
                                <img src={lianxLogo} alt="LianX" />
                            </div>
                        </div>

                        <h1 className="text-3xl font-extrabold text-[#370776] mt-5">Imblasco Dashboard</h1>
                        <p className="text-sm text-gray-500 mt-1">Accede con tu cuenta para continuar</p>
                    </div>
                    <h2 className="text-xl font-semibold text-start text-gray-800">Iniciar Sesión</h2>

                    <Form.Item
                        name="mail"
                        rules={[
                            { required: true, message: 'Ingresa tu correo' },
                            { type: 'email', message: 'Correo inválido' }
                        ]}
                    >
                        <Input
                            placeholder="Correo"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:!border-[#5DD62C] focus:!shadow-[0_0_0_4px_rgba(93,214,44,0.16)]"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
                    >
                        <Input.Password
                            placeholder="Contraseña"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:!border-[#5DD62C] focus:!shadow-[0_0_0_4px_rgba(93,214,44,0.16)]"
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            className="w-full py-6 text-base rounded-xl !bg-[#5DD62C] hover:!bg-[#49c61d] !border-none !text-[#061b00] shadow-[0_14px_40px_rgba(93,214,44,0.22)]"
                        >
                            Iniciar Sesión
                        </Button>
                    </Form.Item>
                </Form>

                <div className="mt-6 text-center text-sm text-gray-500">
                    Powered by <span className="font-semibold text-[#370776]">LianX</span>
                </div>
            </div>
        </div>
    );
};

export default Login;

