# Dashboard

Dashboard administrativo construido con React + Vite.

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Variables de Entorno

Crea un archivo `.env` con:

```
VITE_API_APP=http://localhost:5001/api
```

## Despliegue en Render (Static Site)

Para que las rutas del cliente (p. ej. `/chat`, `/mails`) no devuelvan 404 al recargar o abrir el enlace directo, configura en el Dashboard de Render una **regla de Rewrite**:

| Source     | Destination   | Action   |
|-----------|---------------|----------|
| `/*`      | `/index.html` | Rewrite  |

Así el servidor sirve `index.html` para cualquier path y React Router puede resolver la ruta.

