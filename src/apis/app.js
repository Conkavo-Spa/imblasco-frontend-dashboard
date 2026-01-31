import createInstance from '../libs/axios'

// En desarrollo forzamos backend local incluyendo /api; en build usa VITE_API_APP o fallback local
const baseURL = import.meta.env.DEV
    ? 'http://localhost:5001/api'
    : (import.meta.env.VITE_API_APP || 'http://localhost:5001/api')

const instance = createInstance(baseURL)

export default instance

