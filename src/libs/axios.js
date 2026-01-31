import axios from 'axios'

// Función que crea una nueva instancia de Axios
const createInstance = baseURL => {
    const instance = axios.create({
        headers: { 'Content-Type': 'application/json' },
        baseURL,
    })

    // TODO: Agregar interceptors de request si es necesario
    // instance.interceptors.request.use(async config => {
    //     // Lógica de autenticación aquí
    //     return config
    // })

    instance.interceptors.response.use(
        res => res.data,
        error => { throw error }
    )

    return instance
}

export default createInstance

