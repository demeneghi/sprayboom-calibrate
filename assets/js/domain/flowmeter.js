// Dominio C: rotametro. Correccion por presion, ecuacion maestra de masa
// y los tres despejes, todos con verificacion (redundante y de ida y
// vuelta).
//
// La escala del rotametro esta calibrada a una presion de referencia; si
// el gas entra comprimido es mas denso y el flotador subestima el flujo
// real. El factor sale del balance de fuerzas del flotador.

import { SEG_POR_MIN } from './constants.js';
import { aviso, requierePositivo, requiereFinito } from './validate.js';
import { paso, redondeoLegible } from './speed.js';
import { masaGasRutaSI, compararRutas, verificarIdaVuelta } from './verify.js';

function avisoRedundante(datos) {
  return aviso(
    'error',
    'calculo-no-verificado',
    'Las dos rutas de calculo no coinciden: el resultado no esta verificado y no debe ' +
      'usarse. Reporta este error.',
    datos
  );
}

// Factor de correccion por presion del rotametro.
export function factorPresion({ psiManometrica, presionAtmosfericaLocal, presionEstandarCalibracion }) {
  requiereFinito('la presion manometrica', psiManometrica);
  requierePositivo('la presion atmosferica local', presionAtmosfericaLocal);
  requierePositivo('la presion estandar de calibracion', presionEstandarCalibracion);
  const presionAbsoluta = psiManometrica + presionAtmosfericaLocal;
  requierePositivo('la presion absoluta resultante', presionAbsoluta);
  return Math.sqrt(presionAbsoluta / presionEstandarCalibracion);
}

// Ecuacion maestra: masa inyectada en gramos.
export function masaGas({
  scfm,
  psiManometrica,
  tiempoS,
  gPorScf,
  presionAtmosfericaLocal,
  presionEstandarCalibracion,
}) {
  requierePositivo('la lectura del flotador', scfm);
  requierePositivo('el tiempo', tiempoS);
  requierePositivo('la masa por pie cubico estandar', gPorScf);

  const factor = factorPresion({ psiManometrica, presionAtmosfericaLocal, presionEstandarCalibracion });
  const masaG = scfm * factor * gPorScf * (tiempoS / SEG_POR_MIN);

  const redundante = compararRutas(
    masaG,
    masaGasRutaSI({
      scfm,
      psiManometrica,
      presionAtmosfericaLocalPsia: presionAtmosfericaLocal,
      presionEstandarCalibracionPsia: presionEstandarCalibracion,
      tiempoS,
      gPorScf,
    })
  );
  const avisos = redundante.ok ? [] : [avisoRedundante(redundante)];

  return {
    valores: { masaG, factor },
    desglose: [
      paso(
        'Factor de correccion por presion',
        'raiz((psi_manometrica + presion_atmosferica_local) / presion_estandar)',
        `raiz((${redondeoLegible(psiManometrica)} + ${redondeoLegible(presionAtmosfericaLocal)}) / ${redondeoLegible(presionEstandarCalibracion)})`,
        factor,
        ''
      ),
      paso(
        'Masa inyectada',
        'scfm * factor * g_por_scf * (tiempo / 60)',
        `${redondeoLegible(scfm)} * ${redondeoLegible(factor)} * ${redondeoLegible(gPorScf)} * (${redondeoLegible(tiempoS)} / ${SEG_POR_MIN})`,
        masaG,
        'g'
      ),
    ],
    avisos,
    verificacion: { redundante },
  };
}

// Despeje de presion: que presion manometrica se necesita para inyectar
// una masa objetivo con una lectura y un tiempo dados.
//
// Cuando la presion estandar y la atmosferica local difieren, se resta
// la ATMOSFERICA LOCAL (el resultado es una lectura manometrica del
// sitio), no la estandar.
export function despejePresion({
  masaObjetivoG,
  scfm,
  tiempoS,
  gPorScf,
  presionAtmosfericaLocal,
  presionEstandarCalibracion,
}) {
  requierePositivo('la masa objetivo', masaObjetivoG);
  requierePositivo('la lectura del flotador', scfm);
  requierePositivo('el tiempo', tiempoS);
  requierePositivo('la masa por pie cubico estandar', gPorScf);
  requierePositivo('la presion estandar de calibracion', presionEstandarCalibracion);
  requierePositivo('la presion atmosferica local', presionAtmosfericaLocal);

  const factorRequerido = masaObjetivoG / (scfm * gPorScf * (tiempoS / SEG_POR_MIN));
  const psi = presionEstandarCalibracion * factorRequerido ** 2 - presionAtmosfericaLocal;

  const avisos = [];
  let idaVuelta = null;
  if (psi < 0) {
    avisos.push(
      aviso(
        'advertencia',
        'objetivo-bajo-atmosferica',
        `El objetivo exigiria una presion de ${redondeoLegible(psi)} psi, por debajo de la ` +
          'atmosferica local: con esa lectura y ese tiempo ya se excede el consumo objetivo ' +
          'sin presurizar. Baja la lectura del flotador o acorta el tiempo.',
        { psiRequerida: psi }
      )
    );
  } else {
    const reproducida = masaGas({
      scfm,
      psiManometrica: psi,
      tiempoS,
      gPorScf,
      presionAtmosfericaLocal,
      presionEstandarCalibracion,
    });
    idaVuelta = verificarIdaVuelta(masaObjetivoG, reproducida.valores.masaG);
    if (!idaVuelta.ok) avisos.push(avisoRedundante(idaVuelta));
  }

  return {
    valores: { psiManometrica: psi, factorRequerido },
    desglose: [
      paso(
        'Factor requerido',
        'masa / (scfm * g_por_scf * tiempo / 60)',
        `${redondeoLegible(masaObjetivoG)} / (${redondeoLegible(scfm)} * ${redondeoLegible(gPorScf)} * ${redondeoLegible(tiempoS)} / ${SEG_POR_MIN})`,
        factorRequerido,
        ''
      ),
      paso(
        'Presion manometrica requerida',
        'presion_estandar * factor^2 - presion_atmosferica_local',
        `${redondeoLegible(presionEstandarCalibracion)} * ${redondeoLegible(factorRequerido)}^2 - ${redondeoLegible(presionAtmosfericaLocal)}`,
        psi,
        'psi'
      ),
    ],
    avisos,
    verificacion: { idaVuelta },
  };
}

// Despeje de tiempo: cuanto tiempo inyectar para una masa objetivo.
export function despejeTiempo({
  masaObjetivoG,
  scfm,
  psiManometrica,
  gPorScf,
  presionAtmosfericaLocal,
  presionEstandarCalibracion,
}) {
  requierePositivo('la masa objetivo', masaObjetivoG);
  requierePositivo('la lectura del flotador', scfm);
  requierePositivo('la masa por pie cubico estandar', gPorScf);

  const factor = factorPresion({ psiManometrica, presionAtmosfericaLocal, presionEstandarCalibracion });
  const tiempoS = (masaObjetivoG / (scfm * factor * gPorScf)) * SEG_POR_MIN;

  const reproducida = masaGas({
    scfm,
    psiManometrica,
    tiempoS,
    gPorScf,
    presionAtmosfericaLocal,
    presionEstandarCalibracion,
  });
  const idaVuelta = verificarIdaVuelta(masaObjetivoG, reproducida.valores.masaG);

  return {
    valores: { tiempoS, factor },
    desglose: [
      paso(
        'Tiempo requerido',
        'masa / (scfm * factor * g_por_scf) * 60',
        `${redondeoLegible(masaObjetivoG)} / (${redondeoLegible(scfm)} * ${redondeoLegible(factor)} * ${redondeoLegible(gPorScf)}) * ${SEG_POR_MIN}`,
        tiempoS,
        's'
      ),
    ],
    avisos: idaVuelta.ok ? [] : [avisoRedundante(idaVuelta)],
    verificacion: { idaVuelta },
  };
}

// Despeje de lectura del flotador: que SCFM marcar para una masa
// objetivo. Si se da el rotametro, advierte cuando la lectura requerida
// cae fuera de la escala configurada (la escala solo alimenta
// advertencias; nunca trunca el calculo).
export function despejeScfm({
  masaObjetivoG,
  psiManometrica,
  tiempoS,
  gPorScf,
  presionAtmosfericaLocal,
  presionEstandarCalibracion,
  rotametro = null,
}) {
  requierePositivo('la masa objetivo', masaObjetivoG);
  requierePositivo('el tiempo', tiempoS);
  requierePositivo('la masa por pie cubico estandar', gPorScf);

  const factor = factorPresion({ psiManometrica, presionAtmosfericaLocal, presionEstandarCalibracion });
  const scfm = masaObjetivoG / (factor * gPorScf * (tiempoS / SEG_POR_MIN));

  const reproducida = masaGas({
    scfm,
    psiManometrica,
    tiempoS,
    gPorScf,
    presionAtmosfericaLocal,
    presionEstandarCalibracion,
  });
  const idaVuelta = verificarIdaVuelta(masaObjetivoG, reproducida.valores.masaG);

  const avisos = idaVuelta.ok ? [] : [avisoRedundante(idaVuelta)];
  if (rotametro && (scfm < rotametro.escalaMin || scfm > rotametro.escalaMax)) {
    avisos.push(
      aviso(
        'advertencia',
        'fuera-de-escala-rotametro',
        `La lectura requerida (${redondeoLegible(scfm)} SCFM) cae fuera de la escala del ` +
          `${rotametro.modelo} (${redondeoLegible(rotametro.escalaMin)} a ` +
          `${redondeoLegible(rotametro.escalaMax)} SCFM). El numero mostrado es el real, no ` +
          'recortado; ajusta presion o tiempo para entrar en escala.',
        { scfm, escalaMin: rotametro.escalaMin, escalaMax: rotametro.escalaMax }
      )
    );
  }

  return {
    valores: { scfm, factor },
    desglose: [
      paso(
        'Lectura de flotador requerida',
        'masa / (factor * g_por_scf * tiempo / 60)',
        `${redondeoLegible(masaObjetivoG)} / (${redondeoLegible(factor)} * ${redondeoLegible(gPorScf)} * ${redondeoLegible(tiempoS)} / ${SEG_POR_MIN})`,
        scfm,
        'SCFM'
      ),
    ],
    avisos,
    verificacion: { idaVuelta },
  };
}
