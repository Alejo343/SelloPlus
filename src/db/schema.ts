/**
 * Esquema de la base de datos.
 *
 * Corresponde a ESPEC.md §7 y a las reglas de negocio de REQUISITOS.md §2.5.
 *
 * Dos decisiones que se sostienen a nivel de base de datos, no de código:
 *
 *  - RN-01 (un sello por cliente por día): la restricción única sobre
 *    (cliente_id, fecha) en `sellos`. Es lo que hace que dos taps simultáneos
 *    generen un solo sello incluso si el código tiene una carrera.
 *  - RN-03 / RNF-05 (aislamiento entre locales): todas las tablas de datos
 *    llevan `localId`, incluso cuando se podría deducir por la relación. Así
 *    cualquier consulta puede filtrar por local sin un join, y es más difícil
 *    escribir por accidente una consulta que cruce locales.
 */

import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ enums */

export const origenSello = pgEnum('origen_sello', ['nfc', 'qr', 'manual']);

export const plataformaTarjeta = pgEnum('plataforma_tarjeta', ['google', 'apple']);

export const tipoMensaje = pgEnum('tipo_mensaje', [
  'bienvenida',
  'cumpleanos',
  'inactividad',
  'post_visita',
  'evento',
  'campana',
]);

export const estadoMensaje = pgEnum('estado_mensaje', ['pendiente', 'enviado', 'descartado']);

export const estadoAlerta = pgEnum('estado_alerta', ['nueva', 'revisada', 'descartada']);

/* ---------------------------------------------------------------- locales */

export const locales = pgTable('locales', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Aparece en las URLs públicas: /c/[slug] */
  slug: text('slug').notNull().unique(),
  nombre: text('nombre').notNull(),
  logoUrl: text('logo_url'),
  colorPrimario: text('color_primario').notNull().default('#111111'),
  colorFondo: text('color_fondo').notNull().default('#ffffff'),
  /** Coordenadas para el aviso por cercanía del wallet (RF-10) */
  lat: text('lat'),
  lng: text('lng'),
  /** En formato internacional, sin signos: 573001234567 */
  whatsapp: text('whatsapp'),
  googleMapsUrl: text('google_maps_url'),
  /**
   * Define qué día es "hoy" al sumar un sello. Un local que cierra a las 2 am
   * necesita que un sello de la 1 am cuente como el día anterior, y eso se
   * resuelve en el dominio, pero la zona horaria vive acá.
   */
  zonaHoraria: text('zona_horaria').notNull().default('America/Bogota'),
  activo: boolean('activo').notNull().default(true),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------- programas */

/** La configuración del club de un local. Uno por local. */
export const programas = pgTable('programas', {
  id: uuid('id').primaryKey().defaultRandom(),
  localId: uuid('local_id')
    .notNull()
    .unique()
    .references(() => locales.id, { onDelete: 'cascade' }),
  /** Cuántos sellos para el premio (RF-22) */
  sellosObjetivo: smallint('sellos_objetivo').notNull().default(10),
  premio: text('premio').notNull(),
  beneficioBienvenida: text('beneficio_bienvenida'),
  /** Tras cuántas semanas sin sellos se considera inactivo (RN-06) */
  semanasInactividad: smallint('semanas_inactividad').notNull().default(6),
  /** Cuántos días antes del cumpleaños se avisa (RN-05) */
  diasAntesCumple: smallint('dias_antes_cumple').notNull().default(7),
  /** Horas tras el sello para preguntar cómo estuvo la visita (RN-07) */
  horasPostVisita: smallint('horas_post_visita').notNull().default(2),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

/* --------------------------------------------------------- usuarios panel */

export const usuariosLocal = pgTable('usuarios_local', {
  id: uuid('id').primaryKey().defaultRandom(),
  localId: uuid('local_id')
    .notNull()
    .references(() => locales.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  hashContrasena: text('hash_contrasena').notNull(),
  nombre: text('nombre').notNull(),
  activo: boolean('activo').notNull().default(true),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

/* --------------------------------------------------------------- clientes */

export const clientes = pgTable(
  'clientes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    localId: uuid('local_id')
      .notNull()
      .references(() => locales.id, { onDelete: 'cascade' }),
    nombre: text('nombre').notNull(),
    /** Normalizado a formato internacional sin signos (RF-02) */
    telefono: text('telefono').notNull(),
    email: text('email'),
    fechaNacimiento: date('fecha_nacimiento'),
    /**
     * RL-01 y RL-02: sin estos dos campos el cliente no se puede guardar.
     * `consentimientoVersion` permite demostrar qué texto aceptó.
     */
    consentimientoEn: timestamp('consentimiento_en', { withTimezone: true }).notNull(),
    consentimientoVersion: text('consentimiento_version').notNull(),
    /** Cómo entró al club: el token del tag o 'qr' / 'panel' */
    origen: text('origen'),
    /** RF-12: si tiene fecha, no recibe más mensajes. Nunca se borra el registro. */
    bajaEn: timestamp('baja_en', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** Un teléfono identifica a un cliente dentro de un local, no entre locales (RN-03) */
    unique('clientes_local_telefono_unico').on(t.localId, t.telefono),
    index('clientes_local_idx').on(t.localId),
    /** Para la selección diaria de cumpleaños (RN-05) */
    index('clientes_cumple_idx').on(t.localId, t.fechaNacimiento),
  ],
);

/* ------------------------------------------------------------------- tags */

/** Los chips NFC y los QR impresos. Viven en el local, no en el cliente. */
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    localId: uuid('local_id')
      .notNull()
      .references(() => locales.id, { onDelete: 'cascade' }),
    /** Lo que va en la URL /t/[token]. No debe ser adivinable (RNF-06). */
    token: text('token').notNull().unique(),
    /** UID del chip, cuando es NFC */
    uid: text('uid'),
    /** Dónde está: "media luna de la caja", "mesa 4" */
    objeto: text('objeto'),
    /**
     * Último contador de lecturas visto en el chip. Un contador repetido o
     * menor se rechaza (RN-04). Null mientras se use QR o NTAG213 simple.
     */
    ultimoContador: integer('ultimo_contador'),
    activo: boolean('activo').notNull().default(true),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tags_local_idx').on(t.localId)],
);

/* ----------------------------------------------------------------- sellos */

export const sellos = pgTable(
  'sellos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    localId: uuid('local_id')
      .notNull()
      .references(() => locales.id, { onDelete: 'cascade' }),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    /**
     * El día del sello en la zona horaria del local, no en UTC. Es la columna
     * que hace cumplir "un sello por día" y la que se usa para contar visitas.
     */
    fecha: date('fecha').notNull(),
    origen: origenSello('origen').notNull(),
    tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'set null' }),
    /** Contador del chip en este tap, para detectar replays (RN-04) */
    contadorChip: integer('contador_chip'),
    /** Quién lo sumó a mano, cuando origen = 'manual' (RF-16) */
    usuarioLocalId: uuid('usuario_local_id').references(() => usuariosLocal.id, {
      onDelete: 'set null',
    }),
    /**
     * RN-02: el canje que consumió este sello, o null si está disponible.
     *
     * Se marca el sello en vez de comparar fechas con el último canje. Así
     * "¿cuántos sellos tiene?" es contar los que tienen null, sin aritmética de
     * fechas, y queda registrado exactamente qué sellos pagaron qué premio.
     * La referencia se declara abajo con `foreignKey` porque `canjes` se define
     * después de esta tabla.
     */
    canjeId: uuid('canje_id'),
    ip: text('ip'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * RN-01. Esta línea es la regla de negocio más importante del sistema.
     * Vive acá, y no solo en el código, para que resista dos taps simultáneos.
     */
    unique('sellos_cliente_fecha_unico').on(t.clienteId, t.fecha),
    index('sellos_local_fecha_idx').on(t.localId, t.fecha),
    index('sellos_cliente_idx').on(t.clienteId),
    /** Para contar los sellos disponibles de un cliente (los que tienen canje_id nulo) */
    index('sellos_cliente_canje_idx').on(t.clienteId, t.canjeId),
    foreignKey({
      columns: [t.canjeId],
      foreignColumns: [canjes.id],
      name: 'sellos_canje_fk',
    }).onDelete('set null'),
  ],
);

/* ----------------------------------------------------------------- canjes */

export const canjes = pgTable(
  'canjes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    localId: uuid('local_id')
      .notNull()
      .references(() => locales.id, { onDelete: 'cascade' }),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    /** Copia del texto del premio al momento del canje: el programa puede cambiar después */
    premio: text('premio').notNull(),
    sellosUsados: smallint('sellos_usados').notNull(),
    usuarioLocalId: uuid('usuario_local_id').references(() => usuariosLocal.id, {
      onDelete: 'set null',
    }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('canjes_cliente_idx').on(t.clienteId), index('canjes_local_idx').on(t.localId)],
);

/* --------------------------------------------------------------- tarjetas */

/** La tarjeta en el wallet del cliente. Opcional (RF-04). Se usa en la Fase 4. */
export const tarjetas = pgTable(
  'tarjetas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    plataforma: plataformaTarjeta('plataforma').notNull(),
    /** Identificador del pase en Google o Apple */
    serial: text('serial').notNull(),
    /** Para el PassKit Web Service de Apple. Null en Google. */
    authToken: text('auth_token'),
    pushToken: text('push_token'),
    /** Última vez que se logró reflejar los sellos en el wallet */
    sincronizadoEn: timestamp('sincronizado_en', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tarjetas_cliente_plataforma_unico').on(t.clienteId, t.plataforma),
    index('tarjetas_cliente_idx').on(t.clienteId),
  ],
);

/* ------------------------------------------------------------- plantillas */

/** Textos editables por local para cada tipo de mensaje (RF-25). Fase 5. */
export const plantillas = pgTable(
  'plantillas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    localId: uuid('local_id')
      .notNull()
      .references(() => locales.id, { onDelete: 'cascade' }),
    tipo: tipoMensaje('tipo').notNull(),
    /** Admite marcadores como {nombre} y {sellos} */
    texto: text('texto').notNull(),
    activa: boolean('activa').notNull().default(true),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('plantillas_local_tipo_unico').on(t.localId, t.tipo)],
);

/* ---------------------------------------------------------------- mensajes */

/**
 * La bandeja de pendientes del panel (RF-26). En las primeras fases nadie
 * envía nada automáticamente: el local hace clic en un link wa.me y el
 * registro pasa a 'enviado'.
 */
export const mensajes = pgTable(
  'mensajes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    localId: uuid('local_id')
      .notNull()
      .references(() => locales.id, { onDelete: 'cascade' }),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    tipo: tipoMensaje('tipo').notNull(),
    /** Texto ya resuelto, con los marcadores reemplazados */
    texto: text('texto').notNull(),
    estado: estadoMensaje('estado').notNull().default('pendiente'),
    programadoPara: timestamp('programado_para', { withTimezone: true }).notNull(),
    enviadoEn: timestamp('enviado_en', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('mensajes_local_estado_idx').on(t.localId, t.estado, t.programadoPara),
    index('mensajes_cliente_idx').on(t.clienteId),
  ],
);

/* ---------------------------------------------------------- alertas fraude */

/** RN-09: avisan, no bloquean. Fase 6. */
export const alertasFraude = pgTable(
  'alertas_fraude',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    localId: uuid('local_id')
      .notNull()
      .references(() => locales.id, { onDelete: 'cascade' }),
    clienteId: uuid('cliente_id').references(() => clientes.id, { onDelete: 'set null' }),
    selloId: uuid('sello_id').references(() => sellos.id, { onDelete: 'set null' }),
    /** Regla que se disparó: 'contador_repetido', 'rafaga', 'fuera_de_horario' */
    motivo: text('motivo').notNull(),
    detalle: text('detalle'),
    estado: estadoAlerta('estado').notNull().default('nueva'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('alertas_local_estado_idx').on(t.localId, t.estado)],
);

/* ------------------------------------------------------------------ tipos */

export type Local = typeof locales.$inferSelect;
export type Programa = typeof programas.$inferSelect;
export type Cliente = typeof clientes.$inferSelect;
export type NuevoCliente = typeof clientes.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type Sello = typeof sellos.$inferSelect;
export type Canje = typeof canjes.$inferSelect;
export type Mensaje = typeof mensajes.$inferSelect;
export type UsuarioLocal = typeof usuariosLocal.$inferSelect;
