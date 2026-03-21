# CRM Constructora

Sistema de gestión de clientes, proyectos y presupuestos para empresas constructoras y de remodelación.

## Requisitos Previos

- **Node.js** versión 18 o superior → Descargar desde: https://nodejs.org
- **npm** (viene incluido con Node.js)

## Pasos para Ejecutar el Proyecto

### 1. Instalar Node.js
Si no tienes Node.js instalado, descárgalo desde https://nodejs.org y sigue el instalador.

Verifica la instalación abriendo una terminal:
```bash
node --version
npm --version
```

### 2. Instalar dependencias del proyecto
Abre una terminal en la carpeta `CRM/` y ejecuta:
```bash
npm install
```
Esto puede tardar unos minutos la primera vez.

### 3. Crear la base de datos
Ejecuta el siguiente comando para crear la base de datos SQLite:
```bash
npm run db:push
```

### 4. Cargar datos de ejemplo (opcional pero recomendado)
Para ver el sistema con datos de prueba realistas:
```bash
npm run db:seed
```

### 5. Iniciar el servidor de desarrollo
```bash
npm run dev
```

### 6. Abrir en el navegador
Una vez iniciado, abre tu navegador y ve a:
```
http://localhost:3000
```

---

## Funcionalidades del Sistema

### Dashboard
- Resumen de métricas: total clientes, proyectos activos, cotizaciones pendientes y ventas cerradas
- Tabla de proyectos recientes
- Tabla de presupuestos recientes

### Clientes
- Listado completo con búsqueda
- Ficha detallada por cliente con sus proyectos y presupuestos
- Crear, editar y eliminar clientes
- Clasificación por tipo (Particular, Empresa, Arquitecto, Inmobiliaria)
- Seguimiento de fuente de captación

### Proyectos
- Listado con filtros por estado
- Estados del proyecto: Prospecto → En Cotización → Adjudicado → En Ejecución → Terminado
- Estadísticas rápidas en el encabezado
- Ficha de proyecto con presupuestos asociados

### Presupuestos
- Constructor de presupuestos dinámico con cálculo en tiempo real
- **Partidas de Obra**: agregar ítems con unidad, cantidad, precio unitario y subtotal automático
- **Módulos de Melamina/Ebanistería**: módulos Base, Aéreo, Columna y Panel con dimensiones y costos
- Botones de acceso rápido para partidas predefinidas
- Cambio de estado: Borrador → Enviado → Aprobado/Rechazado
- Total automático sumando obra + melamina

---

## Estructura del Proyecto

```
CRM/
├── app/                    # Páginas y rutas (Next.js App Router)
│   ├── page.tsx            # Dashboard
│   ├── clientes/           # CRUD de clientes
│   ├── proyectos/          # CRUD de proyectos
│   ├── presupuestos/       # CRUD de presupuestos
│   └── api/                # API REST endpoints
├── components/
│   ├── layout/             # Sidebar y layout principal
│   ├── ui/                 # Componentes reutilizables
│   ├── clientes/           # Formulario de clientes
│   ├── proyectos/          # Formulario de proyectos
│   └── presupuestos/       # Constructor de presupuestos
├── lib/
│   ├── prisma.ts           # Cliente de base de datos
│   └── utils.ts            # Funciones utilitarias
└── prisma/
    ├── schema.prisma        # Esquema de base de datos
    ├── seed.ts             # Datos de ejemplo
    └── dev.db              # Base de datos SQLite (se crea al ejecutar db:push)
```

---

## Comandos Útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Construye la versión de producción |
| `npm run db:push` | Sincroniza el esquema con la base de datos |
| `npm run db:seed` | Carga datos de ejemplo |
| `npm run db:studio` | Abre Prisma Studio (visor de base de datos) |

---

## Tecnologías Utilizadas

- **Next.js 14** con App Router
- **TypeScript** para tipado estático
- **Prisma ORM** con SQLite (base de datos local, sin configuración adicional)
- **Tailwind CSS** para estilos
- **Lucide React** para iconos
