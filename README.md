# SelloPlus

Tarjeta de fidelización digital para locales gastronómicos. El cliente suma sellos apoyando el
celular en un chip NFC o escaneando un QR, y la tarjeta le queda guardada en el wallet del
teléfono, junto a sus tarjetas de crédito. A cambio de los sellos, el local se queda con los
datos de contacto de todos los que pasan y el sistema les escribe para que vuelvan.

El producto no son los sellos: es la base de clientes y los mensajes automáticos. Los sellos son
la razón por la que el cliente acepta dar sus datos.

## Documentación

Léela en este orden:

| Documento | Qué contiene |
|---|---|
| [`docs/ESPEC.md`](docs/ESPEC.md) | Qué es el sistema y cómo funciona cada pieza: wallet, NFC, automatizaciones, antifraude |
| [`docs/REQUISITOS.md`](docs/REQUISITOS.md) | Requisitos numerados y rastreables: funcionales, reglas de negocio, no funcionales y legales |
| [`docs/PLAN.md`](docs/PLAN.md) | Las 10 fases de construcción, la estrategia de pruebas y los bloqueantes |
| [`CLAUDE.md`](CLAUDE.md) | Contexto y reglas de trabajo para retomar el proyecto |

## Estado

**Fase 0 (cimientos) terminada.** Siguiente: Fase 1, el núcleo de sellos.

Lo que ya funciona: esquema completo en PostgreSQL con 11 tablas y migraciones versionadas,
semilla de dos locales para probar el aislamiento entre ellos, y 8 pruebas de integración en
verde.

Dos reglas se sostienen en la base de datos y no solo en el código, para que ni un error de
lógica pueda saltárselas:

- **Un sello por cliente por día**, mediante una restricción única sobre `(cliente_id, fecha)`.
  Hay una prueba que lanza tres sellos simultáneos y verifica que sobreviva exactamente uno.
- **El consentimiento de tratamiento de datos es obligatorio**, con su fecha y la versión del
  texto aceptado. Sin eso, el cliente no se puede guardar (Ley 1581 de 2012).

## Stack

Next.js 16 (App Router) y TypeScript · PostgreSQL con Drizzle ORM · Vitest para unidad e
integración · Playwright en móvil simulado para punta a punta · PM2 detrás de LiteSpeed.

El código está en español: tablas, columnas, funciones y pruebas. Las reglas de negocio viven en
`src/dominio/` como funciones puras, sin SQL ni HTTP, para poder probarlas en segundos.

## Puesta en marcha

Hace falta Node 22 y PostgreSQL con dos bases:

```bash
sudo -u postgres psql -c "CREATE DATABASE selloplus_dev OWNER tu_usuario;"
sudo -u postgres psql -c "CREATE DATABASE selloplus_test OWNER tu_usuario;"

cp .env.example .env     # ajusta las URLs si no usas socket Unix
npm install
npm run db:migrate
npm run db:migrate:test
npm run db:seed
npm run dev              # puerto 3011
```

## Comandos

```
npm run dev              servidor de desarrollo
npm test                 pruebas de unidad e integración
npm run test:e2e         pruebas de punta a punta
npm run typecheck        next typegen + tsc
npm run lint             eslint
npm run db:generate      genera una migración tras cambiar el esquema
npm run db:migrate       aplica migraciones
npm run db:seed          vuelve a sembrar datos de prueba
npm run build            build de producción
```

Las pruebas de integración se niegan a correr si la base de pruebas no es la que corresponde: es
la salvaguarda contra borrar datos de desarrollo por un `.env` mal puesto.
