/**
 * Datos de prueba.
 *
 * Crea DOS locales a propósito. El segundo no está para tener más datos: está
 * para que cualquier prueba de aislamiento (RNF-05) tenga contra qué comparar.
 * Si una consulta se olvida de filtrar por local, los datos de "Café Vecino"
 * aparecen donde no deben y la prueba falla.
 *
 * Las fechas se calculan relativas a hoy para que los casos interesantes
 * (cliente activo, cliente inactivo, cumpleaños esta semana) sigan siendo
 * interesantes el mes que viene.
 */

import 'dotenv/config';

import { crearConexion } from '../src/db';
import { hashearContrasena } from '../src/lib/contrasena';
import {
  clientes,
  locales,
  plantillas,
  programas,
  sellos,
  tags,
  usuariosLocal,
} from '../src/db/schema';

const VERSION_CONSENTIMIENTO = process.env.CONSENTIMIENTO_VERSION ?? '2026-11-v1';

/**
 * Contraseña de los usuarios de prueba del panel. Es solo para desarrollo: la
 * semilla nunca se corre contra datos reales, y el .env de producción tendría
 * usuarios creados de otra forma.
 */
const CONTRASENA_DEMO = 'sellofiel2026';

/** Fecha ISO (solo día) desplazada N días desde hoy. */
function diaRelativo(dias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Cumpleaños que cae dentro de los próximos `dias` días, con año de nacimiento fijo. */
function cumpleEnDias(dias: number, anio = 1990): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return `${anio}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function sembrar() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL en el .env');

  const { cliente: sql, db } = crearConexion(url, 1);

  try {
    // Se vacía en orden inverso a las dependencias.
    await sql`truncate table sellos, canjes, mensajes, alertas_fraude, tarjetas,
                             clientes, tags, plantillas, programas, usuarios_local, locales
                       restart identity cascade`;

    /* ----------------------------------------------- local 1: La Esquina */

    const [esquina] = await db
      .insert(locales)
      .values({
        slug: 'la-esquina',
        nombre: 'La Esquina',
        // Google Wallet exige logo para crear la plantilla del local.
        logoUrl: 'https://ejemplo.test/la-esquina-logo.png',
        colorPrimario: '#8b1e1e',
        colorFondo: '#fdf6ec',
        lat: '4.6533',
        lng: '-74.0836',
        whatsapp: '573001112233',
        googleMapsUrl: 'https://maps.google.com/?cid=ejemplo-la-esquina',
      })
      .returning();

    await db.insert(programas).values({
      localId: esquina.id,
      sellosObjetivo: 10,
      premio: 'Una cena para dos personas',
      beneficioBienvenida: 'Un café de regalo por unirte al club',
    });

    const hashDemo = await hashearContrasena(CONTRASENA_DEMO);

    await db.insert(usuariosLocal).values({
      localId: esquina.id,
      email: 'dueno@laesquina.test',
      hashContrasena: hashDemo,
      nombre: 'Dueño de La Esquina',
    });

    const [tagCaja, tagMesa] = await db
      .insert(tags)
      .values([
        { localId: esquina.id, token: 'tag-esquina-caja', objeto: 'Media luna de la caja' },
        { localId: esquina.id, token: 'tag-esquina-mesa4', objeto: 'QR de la mesa 4' },
      ])
      .returning();

    await db.insert(plantillas).values([
      {
        localId: esquina.id,
        tipo: 'cumpleanos',
        texto: '¡Feliz cumpleaños, {nombre}! Te esperamos en La Esquina con un postre de regalo.',
      },
      {
        localId: esquina.id,
        tipo: 'inactividad',
        texto: '{nombre}, hace rato no te vemos por La Esquina. Tenemos algo para ti.',
      },
      {
        localId: esquina.id,
        tipo: 'post_visita',
        texto: '{nombre}, ¿cómo estuvo todo hoy en La Esquina?',
      },
    ]);

    /* -- clientes de La Esquina, cada uno con un caso de prueba distinto -- */

    const clientesEsquina = await db
      .insert(clientes)
      .values([
        {
          // Cliente fiel: viene seguido y está cerca del premio.
          localId: esquina.id,
          nombre: 'Marta Fiel',
          telefono: '573001234001',
          fechaNacimiento: '1985-03-14',
          consentimientoEn: new Date(),
          consentimientoVersion: VERSION_CONSENTIMIENTO,
          origen: 'tag-esquina-caja',
        },
        {
          // Cumple esta semana: tiene que aparecer en la selección de cumpleaños.
          localId: esquina.id,
          nombre: 'Carlos Cumple',
          telefono: '573001234002',
          fechaNacimiento: cumpleEnDias(3),
          consentimientoEn: new Date(),
          consentimientoVersion: VERSION_CONSENTIMIENTO,
          origen: 'tag-esquina-caja',
        },
        {
          // Dejó de venir hace meses: tiene que aparecer en la de inactividad.
          localId: esquina.id,
          nombre: 'Ana Perdida',
          telefono: '573001234003',
          fechaNacimiento: '1992-07-22',
          consentimientoEn: new Date(),
          consentimientoVersion: VERSION_CONSENTIMIENTO,
          origen: 'tag-esquina-mesa4',
        },
        {
          // Pidió la baja: no debe aparecer en NINGUNA selección (RN-08).
          localId: esquina.id,
          nombre: 'Pedro Baja',
          telefono: '573001234004',
          fechaNacimiento: cumpleEnDias(2),
          consentimientoEn: new Date(),
          consentimientoVersion: VERSION_CONSENTIMIENTO,
          origen: 'qr',
          bajaEn: new Date(),
        },
        {
          // Recién se unió, sin sellos todavía.
          localId: esquina.id,
          nombre: 'Lucía Nueva',
          telefono: '573001234005',
          consentimientoEn: new Date(),
          consentimientoVersion: VERSION_CONSENTIMIENTO,
          origen: 'tag-esquina-caja',
        },
      ])
      .returning();

    const [marta, carlos, ana] = clientesEsquina;

    // Marta: 8 sellos, le faltan 2 para el premio.
    await db.insert(sellos).values(
      [0, 3, 7, 10, 14, 18, 25, 31].map((atras) => ({
        localId: esquina.id,
        clienteId: marta.id,
        fecha: diaRelativo(-atras),
        origen: 'nfc' as const,
        tagId: tagCaja.id,
      })),
    );

    // Carlos: 2 sellos recientes.
    await db.insert(sellos).values(
      [1, 9].map((atras) => ({
        localId: esquina.id,
        clienteId: carlos.id,
        fecha: diaRelativo(-atras),
        origen: 'qr' as const,
        tagId: tagMesa.id,
      })),
    );

    // Ana: 3 sellos, pero el último hace casi 4 meses.
    await db.insert(sellos).values(
      [100, 110, 120].map((atras) => ({
        localId: esquina.id,
        clienteId: ana.id,
        fecha: diaRelativo(-atras),
        origen: 'nfc' as const,
        tagId: tagCaja.id,
      })),
    );

    /* --------------------------------------------- local 2: Café Vecino */
    /* Existe solo para probar que sus datos NUNCA se filtran al local 1.  */

    const [vecino] = await db
      .insert(locales)
      .values({
        slug: 'cafe-vecino',
        nombre: 'Café Vecino',
        logoUrl: 'https://ejemplo.test/cafe-vecino-logo.png',
        whatsapp: '573009998877',
        lat: '4.6600',
        lng: '-74.0700',
      })
      .returning();

    await db.insert(programas).values({
      localId: vecino.id,
      sellosObjetivo: 6,
      premio: 'Un café con leche',
    });

    await db.insert(usuariosLocal).values({
      localId: vecino.id,
      email: 'dueno@cafevecino.test',
      hashContrasena: hashDemo,
      nombre: 'Dueño de Café Vecino',
    });

    const [tagVecino] = await db
      .insert(tags)
      .values({ localId: vecino.id, token: 'tag-vecino-barra', objeto: 'Corona de la barra' })
      .returning();

    const [vecinoCliente] = await db
      .insert(clientes)
      .values({
        localId: vecino.id,
        nombre: 'Sofía Vecina',
        // Mismo teléfono que Marta en el otro local: tiene que ser válido (RN-03).
        telefono: '573001234001',
        fechaNacimiento: cumpleEnDias(3),
        consentimientoEn: new Date(),
        consentimientoVersion: VERSION_CONSENTIMIENTO,
        origen: 'tag-vecino-barra',
      })
      .returning();

    await db.insert(sellos).values({
      localId: vecino.id,
      clienteId: vecinoCliente.id,
      fecha: diaRelativo(-2),
      origen: 'nfc',
      tagId: tagVecino.id,
    });

    console.log('Semilla lista:');
    console.log(`  La Esquina   (${esquina.slug})  5 clientes, 13 sellos, 2 tags`);
    console.log(`  Café Vecino  (${vecino.slug})  1 cliente,  1 sello,  1 tag`);
    console.log('  Marta Fiel tiene 8/10 sellos. Ana Perdida está inactiva.');
    console.log('  Carlos Cumple y Sofía Vecina cumplen en 3 días.');
    console.log('  Pedro Baja pidió la baja y no debe recibir mensajes.');
    console.log('  Marta y Sofía comparten teléfono en locales distintos, a propósito.');
    console.log('');
    console.log(`  Panel: dueno@laesquina.test / ${CONTRASENA_DEMO}`);
    console.log(`         dueno@cafevecino.test / ${CONTRASENA_DEMO}`);
  } finally {
    await sql.end();
  }
}

sembrar().catch((error) => {
  console.error('Falló la semilla:', error);
  process.exit(1);
});
