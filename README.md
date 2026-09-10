# Karmancos Search

Página principal de búsqueda construida con React, Tailwind CSS, Motion y Boneyard.

## Ejecutar

```bash
npm install
npm run dev
```

## Compilar

```bash
npm run build
```

La compilación de producción se genera en `dist/`.

## Funciones

- Búsqueda real con Google, Bing, Brave, DuckDuckGo, Kagi, Ecosia y Startpage.
- Favoritos ampliados con favicon robusto, dominio visible y varios fallbacks automáticos.
- Los favoritos se abren en la misma pestaña, también desde la vista completa.
- Historial local de búsquedas.
- Nombre y avatar personalizables.
- Memoria persistente para favoritos, buscador, borrador, identidad, vista y estado del lateral.
- Exportación e importación de copias de seguridad JSON con todos los ajustes locales.
- Esqueletos de carga con Boneyard.
- Micrográficas y animaciones con Motion.
- Fondo canvas animado con ola de puntos.
- Microtransición de búsqueda de 0,78 segundos, contenida dentro del Search.
- Atajos `/` para enfocar, `Esc` para limpiar y cancelación durante el salto.
- Sidebar colapsable y diseño responsive.

## Despliegue en Vercel

El proyecto está configurado como aplicación Vite. Importa esta carpeta en Vercel o ejecuta:

```bash
npx vercel
```
