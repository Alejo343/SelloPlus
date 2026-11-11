/**
 * La cola de sincronización con Google Wallet, contra la base real y con el
 * emisor simulado.
 *
 * El emisor simulado registra lo que habría enviado en vez de llamar a Google.
 * Eso permite verificar todo el circuito sin credenciales, que es exactamente
 * la situación mientras la cuenta de emisor está en trámite.
 */

import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { colaWallet, tarjetas } from '../../src/db/schema';
import { altaCliente } from '../../src/servicios/clientes';
import { canjear, sumarSello } from '../../src/servicios/sellos';
import {
  encolar,
  enlaceDeTarjeta,
  estadoDeLaCola,
  MAXIMO_INTENTOS,
  procesarCola,
} from '../../src/servicios/wallet/cola';
import {
  crearEmisorSimulado,
  fijarEmisor,
  type EmisorSimulado,
} from '../../src/servicios/wallet/emisor';
import { abrirBaseDePruebas, type BaseDePruebas } from '../ayuda/base';
import {
  crearClienteDePrueba,
  crearLocalDePrueba,
  instante,
  type LocalDePrueba,
} from '../ayuda/fabricas';

let base: BaseDePruebas;
let local: LocalDePrueba;
let clienteId: string;
let emisor: EmisorSimulado;

beforeAll(async () => {
  base = await abrirBaseDePruebas();
});

afterAll(async () => {
  await base.cerrar();
  fijarEmisor(null);
});

beforeEach(async () => {
  await base.limpiar();
  local = await crearLocalDePrueba(base.db, { sellosObjetivo: 3, premio: 'Un café' });
  clienteId = await crearClienteDePrueba(base.db, local.localId, { nombre: 'Marta Fiel' });

  emisor = crearEmisorSimulado();
  fijarEmisor(emisor);
});

afterEach(() => {
  fijarEmisor(null);
});

function opcionesSello(extra: Record<string, unknown> = {}) {
  return {
    localId: local.localId,
    clienteId,
    sellosObjetivo: local.sellosObjetivo,
    zonaHoraria: local.zonaHoraria,
    origen: 'nfc' as const,
    tagId: local.tagId,
    ...extra,
  };
}

async function pendientes() {
  return base.db.select().from(colaWallet).where(eq(colaWallet.estado, 'pendiente'));
}

describe('el modo simulado no llama a Google', () => {
  it('no es un emisor real', () => {
    expect(emisor.real).toBe(false);
  });

  it('da un enlace reconocible como falso, para que se note si llega a producción', async () => {
    await encolar({ localId: local.localId, clienteId, tipo: 'crear_objeto' }, base.db);
    await procesarCola({}, base.db);

    const enlace = await enlaceDeTarjeta(clienteId, base.db);
    expect(enlace).toContain('simulado');
    expect(enlace).not.toContain('pay.google.com');
  });
});

describe('sumar un sello encola exactamente una actualización', () => {
  it('encola una sola vez por sello', async () => {
    await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);

    const cola = await pendientes();
    expect(cola).toHaveLength(1);
    expect(cola[0].tipo).toBe('actualizar_sellos');
    expect(cola[0].clienteId).toBe(clienteId);
  });

  it('no encola nada si el sello fue rechazado', async () => {
    await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);
    await procesarCola({}, base.db);
    emisor.limpiar();

    // Segundo sello del mismo día: rechazado, así que no hay nada que sincronizar.
    const segundo = await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);

    expect(segundo.resultado).toBe('rechazado');
    expect(await pendientes()).toHaveLength(0);
    expect(emisor.llamadas).toHaveLength(0);
  });

  it('dos sellos en días distintos, sin procesar entre medias, dejan UN pendiente', async () => {
    // El índice único parcial colapsa los dos: cuando la cola corra, mandará
    // el total correcto de una sola vez. Mandar dos actualizaciones seguidas
    // con el mismo resultado sería gastar cuota de la API por nada.
    await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);
    await sumarSello(opcionesSello({ ahora: instante('2026-11-11') }), base.db);

    expect(await pendientes()).toHaveLength(1);
  });

  it('el canje también encola, porque los sellos bajan', async () => {
    for (const dia of ['2026-11-08', '2026-11-09', '2026-11-10']) {
      await sumarSello(opcionesSello({ ahora: instante(dia) }), base.db);
    }
    await procesarCola({}, base.db);
    expect(await pendientes()).toHaveLength(0);

    await canjear(
      {
        localId: local.localId,
        clienteId,
        sellosObjetivo: local.sellosObjetivo,
        premio: local.premio,
      },
      base.db,
    );

    expect(await pendientes()).toHaveLength(1);
  });
});

describe('procesarCola', () => {
  it('manda el total de sellos correcto, no el incremento', async () => {
    for (const dia of ['2026-11-08', '2026-11-09']) {
      await sumarSello(opcionesSello({ ahora: instante(dia) }), base.db);
    }

    await procesarCola({}, base.db);

    const actualizaciones = emisor.llamadas.filter((l) => l.operacion === 'actualizar_sellos');
    expect(actualizaciones).toHaveLength(1);

    const cuerpo = actualizaciones[0].cuerpo as { loyaltyPoints: { balance: { int: number } } };
    expect(cuerpo.loyaltyPoints.balance.int).toBe(2);
  });

  it('refleja el estado posterior al canje', async () => {
    for (const dia of ['2026-11-08', '2026-11-09', '2026-11-10']) {
      await sumarSello(opcionesSello({ ahora: instante(dia) }), base.db);
    }
    await canjear(
      {
        localId: local.localId,
        clienteId,
        sellosObjetivo: local.sellosObjetivo,
        premio: local.premio,
      },
      base.db,
    );

    await procesarCola({}, base.db);

    const ultima = emisor.llamadas.at(-1)!;
    const cuerpo = ultima.cuerpo as { loyaltyPoints: { balance: { int: number } } };
    expect(cuerpo.loyaltyPoints.balance.int).toBe(0);
  });

  it('marca como hechos los pendientes procesados', async () => {
    await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);

    const resultado = await procesarCola({}, base.db);

    expect(resultado.procesados).toBe(1);
    expect(resultado.fallidos).toBe(0);
    expect(await pendientes()).toHaveLength(0);

    const [item] = await base.db.select().from(colaWallet);
    expect(item.estado).toBe('hecha');
    expect(item.procesadoEn).toBeInstanceOf(Date);
  });

  it('procesarla dos veces no manda nada de nuevo', async () => {
    await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);
    await procesarCola({}, base.db);
    emisor.limpiar();

    await procesarCola({}, base.db);
    expect(emisor.llamadas).toHaveLength(0);
  });

  it('crea la clase del local y guarda la tarjeta del cliente', async () => {
    await encolar({ localId: local.localId, tipo: 'crear_clase' }, base.db);
    await encolar({ localId: local.localId, clienteId, tipo: 'crear_objeto' }, base.db);

    await procesarCola({}, base.db);

    expect(emisor.llamadas.map((l) => l.operacion)).toEqual(['crear_clase', 'crear_objeto']);

    const [tarjeta] = await base.db
      .select()
      .from(tarjetas)
      .where(and(eq(tarjetas.clienteId, clienteId), eq(tarjetas.plataforma, 'google')));

    expect(tarjeta).toBeDefined();
    expect(tarjeta.sincronizadoEn).toBeInstanceOf(Date);
  });

  it('omite sin fallar los cambios de datos que ya no existen', async () => {
    await encolar({ localId: local.localId, clienteId, tipo: 'actualizar_sellos' }, base.db);

    // El cliente se borra entre que se encoló y que se procesa.
    const { clientes } = await import('../../src/db/schema');
    await base.db.delete(clientes).where(eq(clientes.id, clienteId));

    const resultado = await procesarCola({}, base.db);

    // La fila de la cola desaparece con el cliente (borrado en cascada), así
    // que lo que importa es que procesar no lance.
    expect(resultado.fallidos).toBe(0);
  });
});

describe('cuando Google falla', () => {
  /** Emisor que siempre revienta, para probar los reintentos. */
  function emisorQueFalla(mensaje = 'Google no responde') {
    return {
      real: true as const,
      async guardarClase() {
        throw new Error(mensaje);
      },
      async crearObjeto(): Promise<{ enlace: string }> {
        throw new Error(mensaje);
      },
      async actualizarSellos() {
        throw new Error(mensaje);
      },
    };
  }

  it('deja el pendiente para reintentar y guarda el error', async () => {
    await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);
    fijarEmisor(emisorQueFalla());

    const resultado = await procesarCola({}, base.db);

    expect(resultado.fallidos).toBe(1);

    const [item] = await base.db.select().from(colaWallet);
    // Sigue pendiente: un corte de red de un minuto no debe dejar la tarjeta
    // desincronizada para siempre.
    expect(item.estado).toBe('pendiente');
    expect(item.intentos).toBe(1);
    expect(item.ultimoError).toContain('Google no responde');
  });

  it('se rinde tras agotar los intentos, y no lo reintenta más', async () => {
    await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);
    fijarEmisor(emisorQueFalla());

    for (let i = 0; i < MAXIMO_INTENTOS; i += 1) {
      await procesarCola({}, base.db);
    }

    const [item] = await base.db.select().from(colaWallet);
    expect(item.estado).toBe('fallida');
    expect(item.intentos).toBe(MAXIMO_INTENTOS);

    // Ya no se vuelve a tocar.
    const despues = await procesarCola({}, base.db);
    expect(despues.fallidos).toBe(0);
    expect(despues.procesados).toBe(0);
  });

  it('el sello se guarda igual aunque Google esté caído', async () => {
    // Es la razón de ser de la cola: el cliente no puede perder su visita
    // porque un servicio de Google tenga un mal día.
    fijarEmisor(emisorQueFalla());

    const resultado = await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);

    expect(resultado.resultado).toBe('sumado');
    if (resultado.resultado !== 'sumado') return;
    expect(resultado.estado.sellos).toBe(1);
  });
});

describe('estadoDeLaCola', () => {
  it('cuenta pendientes y fallidos de ese local', async () => {
    await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);

    expect(await estadoDeLaCola(local.localId, base.db)).toEqual({ pendientes: 1, fallidos: 0 });

    await procesarCola({}, base.db);
    expect(await estadoDeLaCola(local.localId, base.db)).toEqual({ pendientes: 0, fallidos: 0 });
  });

  it('no cuenta los de otro local', async () => {
    const otro = await crearLocalDePrueba(base.db);
    const suCliente = await crearClienteDePrueba(base.db, otro.localId);
    await encolar({ localId: otro.localId, clienteId: suCliente, tipo: 'crear_objeto' }, base.db);

    expect(await estadoDeLaCola(local.localId, base.db)).toEqual({ pendientes: 0, fallidos: 0 });
    expect(await estadoDeLaCola(otro.localId, base.db)).toEqual({ pendientes: 1, fallidos: 0 });
  });
});

describe('el alta prepara la tarjeta del cliente', () => {
  it('encola la clase del local y el objeto del cliente nuevo', async () => {
    const alta = await altaCliente(
      {
        localId: local.localId,
        datos: { nombre: 'Nuevo Cliente', telefono: '3005554433', consentimiento: true },
      },
      base.db,
    );
    expect(alta.ok).toBe(true);
    if (!alta.ok) return;

    // El alta por servicio no encola (eso lo hace la acción de la pantalla),
    // así que se encola aquí igual que lo hace el formulario.
    await encolar({ localId: local.localId, tipo: 'crear_clase' }, base.db);
    await encolar(
      { localId: local.localId, clienteId: alta.cliente.id, tipo: 'crear_objeto' },
      base.db,
    );

    await procesarCola({}, base.db);

    const operaciones = emisor.llamadas.map((l) => l.operacion);
    expect(operaciones).toContain('crear_clase');
    expect(operaciones).toContain('crear_objeto');

    expect(await enlaceDeTarjeta(alta.cliente.id, base.db)).not.toBeNull();
  });

  it('la clase se encola una sola vez aunque entren varios clientes', async () => {
    await encolar({ localId: local.localId, tipo: 'crear_clase' }, base.db);
    await encolar({ localId: local.localId, tipo: 'crear_clase' }, base.db);
    await encolar({ localId: local.localId, tipo: 'crear_clase' }, base.db);

    const clases = (await pendientes()).filter((p) => p.tipo === 'crear_clase');
    expect(clases).toHaveLength(1);
  });
});
