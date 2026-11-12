import { describe, expect, it } from 'vitest';

import { calcularEstado } from '../../src/dominio/sellos';
import {
  construirCargaJwt,
  construirClase,
  construirObjeto,
  construirParcheSellos,
  enlaceParaAgregar,
  idDeClase,
  idDeObjeto,
} from '../../src/dominio/wallet';

const ISSUER = '3388000000012345678';
const LOCAL_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const CLIENTE_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

const DATOS_CLASE = {
  issuerId: ISSUER,
  localId: LOCAL_ID,
  localNombre: 'La Esquina',
  premio: 'Una cena para dos',
  sellosObjetivo: 10,
  logoUrl: 'https://ejemplo.test/logo.png',
};

const DATOS_OBJETO = {
  issuerId: ISSUER,
  localId: LOCAL_ID,
  clienteId: CLIENTE_ID,
  clienteNombre: 'Marta Fiel',
  estado: calcularEstado(7, 10),
  premio: 'Una cena para dos',
  urlTarjeta: 'https://sellofiel.test/c/la-esquina/tarjeta',
};

describe('identificadores', () => {
  it('se forman con el issuer id por delante, como exige Google', () => {
    expect(idDeClase(ISSUER, LOCAL_ID)).toBe(`${ISSUER}.local_${LOCAL_ID}`);
    expect(idDeObjeto(ISSUER, CLIENTE_ID)).toBe(`${ISSUER}.cliente_${CLIENTE_ID}`);
  });

  it('son estables: el mismo local da siempre el mismo id', () => {
    // Importa porque Google NO permite borrar clases ni objetos. Si el id
    // cambiara, quedaría basura imborrable en la cuenta de emisor.
    expect(idDeClase(ISSUER, LOCAL_ID)).toBe(idDeClase(ISSUER, LOCAL_ID));
  });

  it('no distingue clases de objetos, para que no puedan colisionar', () => {
    // Un local y un cliente podrían tener el mismo UUID por accidente de
    // copiado; los prefijos evitan que se pisen.
    expect(idDeClase(ISSUER, LOCAL_ID)).not.toBe(idDeObjeto(ISSUER, LOCAL_ID));
  });

  it('limpia caracteres que Google no admite en un sufijo', () => {
    expect(idDeClase(ISSUER, 'con espacio/y-barra')).toBe(`${ISSUER}.local_con_espacio_y-barra`);
  });
});

describe('construirClase', () => {
  it('incluye el nombre del programa y el premio', () => {
    const clase = construirClase(DATOS_CLASE);

    expect(clase.id).toBe(idDeClase(ISSUER, LOCAL_ID));
    expect(clase.issuerName).toBe('La Esquina');
    expect(clase.programName).toBe('Club de La Esquina');
    expect(clase.rewardsTier).toBe('Una cena para dos');
  });

  it('explica cómo funciona el club, con el objetivo real del local', () => {
    const clase = construirClase({ ...DATOS_CLASE, sellosObjetivo: 6 });
    const textos = clase.textModulesData as Array<{ body: string }>;

    expect(textos[0].body).toContain('6 sellos');
    expect(textos[0].body).toContain('Una cena para dos');
  });

  it('usa merchantLocations para el aviso por cercanía, NO el campo locations', () => {
    // `locations` está deprecado en Google Wallet y ya no dispara avisos.
    // Si alguien lo "arregla" volviendo a ese campo, esta prueba lo atrapa.
    const clase = construirClase({ ...DATOS_CLASE, lat: '4.6533', lng: '-74.0836' });

    expect(clase.merchantLocations).toEqual([{ latitude: 4.6533, longitude: -74.0836 }]);
    expect(clase.locations).toBeUndefined();
  });

  it('omite la ubicación si el local no la configuró', () => {
    const clase = construirClase(DATOS_CLASE);
    expect(clase.merchantLocations).toBeUndefined();
  });

  it('omite la ubicación si las coordenadas no son números', () => {
    // El dueño escribe las coordenadas a mano en el panel: puede pegar texto.
    const clase = construirClase({ ...DATOS_CLASE, lat: 'cerca del parque', lng: '-74' });
    expect(clase.merchantLocations).toBeUndefined();
  });

  it('añade el enlace de WhatsApp cuando el local tiene número', () => {
    const clase = construirClase({ ...DATOS_CLASE, whatsapp: '573001112233' });
    const enlaces = clase.linksModuleData as { uris: Array<{ uri: string }> };

    expect(enlaces.uris[0].uri).toBe('https://wa.me/573001112233');
  });

  it('exige logo, porque Google rechaza la plantilla sin él', () => {
    // Comprobado contra la API real: "LoyaltyClass cannot be created without
    // a program logo". La documentación lo presenta como opcional y NO lo es.
    expect(() => construirClase({ ...DATOS_CLASE, logoUrl: null })).toThrow(/logo/i);
    expect(() => construirClase({ ...DATOS_CLASE, logoUrl: undefined })).toThrow(/logo/i);
  });

  it('incluye el logo con su descripción accesible', () => {
    const clase = construirClase(DATOS_CLASE);
    const logo = clase.programLogo as { sourceUri: { uri: string } };
    expect(logo.sourceUri.uri).toBe('https://ejemplo.test/logo.png');
  });
});

describe('construirObjeto', () => {
  it('pone los sellos como saldo de puntos', () => {
    const objeto = construirObjeto(DATOS_OBJETO);

    expect(objeto.loyaltyPoints.balance.int).toBe(7);
    expect(objeto.loyaltyPoints.label).toBe('Sellos');
  });

  it('apunta a la clase de su local', () => {
    expect(construirObjeto(DATOS_OBJETO).classId).toBe(idDeClase(ISSUER, LOCAL_ID));
  });

  it('lleva un QR a la tarjeta web, para que el local pueda escanearla', () => {
    const objeto = construirObjeto(DATOS_OBJETO);

    expect(objeto.barcode.type).toBe('QR_CODE');
    expect(objeto.barcode.value).toBe(DATOS_OBJETO.urlTarjeta);
    expect(objeto.barcode.alternateText).toBe('7/10 sellos');
  });

  it('dice cuántos faltan cuando aún no llegó al premio', () => {
    const objeto = construirObjeto(DATOS_OBJETO);
    expect(objeto.textModulesData[0].body).toContain('3 sellos');
  });

  it('anuncia el premio cuando ya lo tiene', () => {
    const objeto = construirObjeto({ ...DATOS_OBJETO, estado: calcularEstado(10, 10) });

    expect(objeto.textModulesData[0].header).toContain('Premio disponible');
    expect(objeto.textModulesData[0].body).toContain('Una cena para dos');
  });

  it('usa el singular cuando falta un solo sello', () => {
    const objeto = construirObjeto({ ...DATOS_OBJETO, estado: calcularEstado(9, 10) });
    expect(objeto.textModulesData[0].body).toContain('1 sello para');
  });
});

describe('construirParcheSellos', () => {
  it('solo cambia el saldo y el texto, para no pisar el resto del objeto', () => {
    const parche = construirParcheSellos(calcularEstado(5, 10), 'Un café');

    expect(Object.keys(parche).sort()).toEqual(['loyaltyPoints', 'textModulesData']);
    expect(parche.loyaltyPoints.balance.int).toBe(5);
  });

  it('refleja el premio disponible', () => {
    const parche = construirParcheSellos(calcularEstado(10, 10), 'Un café');
    expect(parche.textModulesData[0].header).toContain('Premio disponible');
  });
});

describe('construirCargaJwt', () => {
  it('lleva los valores fijos que exige Google', () => {
    const carga = construirCargaJwt({
      cuentaServicioEmail: 'sellofiel@proyecto.iam.gserviceaccount.com',
      objeto: construirObjeto(DATOS_OBJETO),
      origenes: ['https://sellofiel.test'],
      ahora: new Date('2026-11-11T12:00:00Z'),
    });

    expect(carga.aud).toBe('google');
    expect(carga.typ).toBe('savetowallet');
    expect(carga.iss).toBe('sellofiel@proyecto.iam.gserviceaccount.com');
    expect(carga.iat).toBe(Math.floor(Date.UTC(2026, 10, 11, 12) / 1000));
  });

  it('restringe los dominios desde los que vale el enlace', () => {
    const carga = construirCargaJwt({
      cuentaServicioEmail: 'x@y.iam.gserviceaccount.com',
      objeto: construirObjeto(DATOS_OBJETO),
      origenes: ['https://sellofiel.test', 'https://www.sellofiel.test'],
    });

    expect(carga.origins).toEqual(['https://sellofiel.test', 'https://www.sellofiel.test']);
  });

  it('mete el objeto dentro de loyaltyObjects', () => {
    const carga = construirCargaJwt({
      cuentaServicioEmail: 'x@y.iam.gserviceaccount.com',
      objeto: construirObjeto(DATOS_OBJETO),
      origenes: [],
    });

    expect(carga.payload.loyaltyObjects).toHaveLength(1);
    expect(carga.payload.loyaltyObjects[0].id).toBe(idDeObjeto(ISSUER, CLIENTE_ID));
  });
});

describe('enlaceParaAgregar', () => {
  it('apunta al guardado de pases de Google', () => {
    expect(enlaceParaAgregar('eyJhbGciOi.xxx.yyy')).toBe(
      'https://pay.google.com/gp/v/save/eyJhbGciOi.xxx.yyy',
    );
  });
});
