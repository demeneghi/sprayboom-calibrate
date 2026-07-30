// Dominio A/B: acoplamiento del regimen del motor con la bomba de la
// barra via la toma de fuerza (TDF).
//
// Si la bomba es accionada por la TDF, su velocidad cae con el regimen
// del motor y eso SI cambia el gasto aplicado. Que tanto, depende del
// tipo de bomba: son dos escenarios opuestos con hasta 40 puntos
// porcentuales de dosis de diferencia. Ambos son modelos aproximados:
// la verificacion por aforo al regimen real de trabajo tiene prioridad.

import { PORCIENTO } from './constants.js';
import { aviso, requierePositivo } from './validate.js';
import { paso, redondeoLegible, velocidadEfectiva } from './speed.js';
import { lhaPorBoquilla } from './water.js';

// TDF resultante a un regimen de motor dado.
export function tdfRpm({ tdfNominal, rpmMotor, rpmMotorTdfNominal }) {
  requierePositivo('el régimen nominal de la TDF', tdfNominal);
  requierePositivo('el régimen del motor', rpmMotor);
  requierePositivo('el régimen del motor para TDF nominal', rpmMotorTdfNominal);
  const rpm = tdfNominal * (rpmMotor / rpmMotorTdfNominal);
  const porcentajeNominal = (rpmMotor / rpmMotorTdfNominal) * PORCIENTO;
  return {
    valores: { tdfRpm: rpm, porcentajeNominal },
    desglose: [
      paso(
        'TDF resultante',
        'tdf_nominal * (rpm_motor / rpm_motor_para_tdf_nominal)',
        `${redondeoLegible(tdfNominal)} * (${redondeoLegible(rpmMotor)} / ${redondeoLegible(rpmMotorTdfNominal)})`,
        rpm,
        'rpm'
      ),
    ],
    avisos: [],
  };
}

export const ESCENARIOS_BOMBA = {
  PRESION_SOSTENIDA: 'presion-sostenida',
  CENTRIFUGA_SIN_REGULACION: 'centrifuga-sin-regulacion',
};

// Presion y gasto estimados al regimen de trabajo, a partir de la
// calibracion registrada.
export function estadoBombaARegimen({
  tipoBomba,
  conRegulador,
  rpmMotor,
  rpmCalibracion,
  presionCalibracionBar,
  caudalCalibracionLmin,
}) {
  requierePositivo('el régimen del motor', rpmMotor);
  const avisos = [];

  if (rpmCalibracion === null || rpmCalibracion === undefined) {
    avisos.push(
      aviso(
        'advertencia',
        'sin-calibracion-de-presion',
        'No hay registrado el régimen del motor de la última calibración de presión: no se ' +
          'puede estimar el efecto del régimen sobre el gasto. Captura la calibración en la ' +
          'configuración del equipo.',
        null
      )
    );
    return {
      valores: {
        escenario: null,
        razonRegimen: null,
        presionEstimadaBar: null,
        caudalEstimadoLmin: null,
      },
      desglose: [],
      avisos,
    };
  }
  requierePositivo('el régimen de calibración', rpmCalibracion);

  const razonRegimen = rpmMotor / rpmCalibracion;
  const presionSostenida = tipoBomba === 'independiente' || conRegulador === true;
  const escenario = presionSostenida
    ? ESCENARIOS_BOMBA.PRESION_SOSTENIDA
    : ESCENARIOS_BOMBA.CENTRIFUGA_SIN_REGULACION;

  let presionEstimadaBar = presionCalibracionBar ?? null;
  let caudalEstimadoLmin = caudalCalibracionLmin ?? null;
  const desglose = [
    paso(
      'Razón de régimen',
      'rpm_motor / rpm_calibracion',
      `${redondeoLegible(rpmMotor)} / ${redondeoLegible(rpmCalibracion)}`,
      razonRegimen,
      ''
    ),
  ];

  if (presionSostenida) {
    // Mientras la bomba entregue mas caudal del que demanda la barra, el
    // regulador sostiene presion y gasto por boquilla. Pero la velocidad
    // de avance si bajo: el volumen por hectarea SUBE sin que nada en el
    // manometro lo delate. Este es el error mas caro.
    desglose.push(
      paso(
        'Bomba con presión sostenida',
        'presión y gasto por boquilla no cambian',
        `presión = ${redondeoLegible(presionEstimadaBar)} bar, caudal = ${redondeoLegible(caudalEstimadoLmin)} L/min`,
        presionEstimadaBar,
        'bar'
      )
    );
  } else {
    if (presionCalibracionBar !== null && presionCalibracionBar !== undefined) {
      presionEstimadaBar = presionCalibracionBar * razonRegimen ** 2;
      desglose.push(
        paso(
          'Presión estimada (centrífuga sin regulacion)',
          'presion_calibracion * razon_regimen^2',
          `${redondeoLegible(presionCalibracionBar)} * ${redondeoLegible(razonRegimen)}^2`,
          presionEstimadaBar,
          'bar'
        )
      );
    }
    if (caudalCalibracionLmin !== null && caudalCalibracionLmin !== undefined) {
      caudalEstimadoLmin = caudalCalibracionLmin * razonRegimen;
      desglose.push(
        paso(
          'Gasto estimado (centrífuga sin regulacion)',
          'gasto_calibracion * razon_regimen',
          `${redondeoLegible(caudalCalibracionLmin)} * ${redondeoLegible(razonRegimen)}`,
          caudalEstimadoLmin,
          'L/min'
        )
      );
    }
  }

  if (Math.abs(razonRegimen - 1) > Number.EPSILON) {
    avisos.push(
      aviso(
        'advertencia',
        'regimen-distinto-a-calibracion',
        `El régimen capturado (${redondeoLegible(rpmMotor)} rpm) se aparta del régimen de la ` +
          `última calibración de presión (${redondeoLegible(rpmCalibracion)} rpm). El efecto ` +
          'sobre el gasto depende del tipo de bomba; el aforo al régimen real de trabajo tiene ' +
          'prioridad sobre esta estimación.',
        { rpmMotor, rpmCalibracion, razonRegimen }
      )
    );
  }

  return {
    valores: { escenario, razonRegimen, presionEstimadaBar, caudalEstimadoLmin },
    desglose,
    avisos,
  };
}

// Contraste del volumen por hectarea entre el regimen de calibracion y
// el regimen de trabajo, para la misma marcha. Es lo que convierte el
// dato de rpm en informacion accionable.
export function contrasteVolumenPorRegimen({
  tipoBomba,
  conRegulador,
  rpmTrabajo,
  rpmCalibracion,
  presionCalibracionBar,
  caudalCalibracionLmin,
  kmhNominalMarcha,
  regimenNominalTractor,
  espaciamientoM,
}) {
  requierePositivo('el caudal de calibración', caudalCalibracionLmin);

  const velocidadCalibracion = velocidadEfectiva({
    kmhNominal: kmhNominalMarcha,
    rpm: rpmCalibracion,
    regimenNominal: regimenNominalTractor,
  });
  const velocidadTrabajo = velocidadEfectiva({
    kmhNominal: kmhNominalMarcha,
    rpm: rpmTrabajo,
    regimenNominal: regimenNominalTractor,
  });

  const bomba = estadoBombaARegimen({
    tipoBomba,
    conRegulador,
    rpmMotor: rpmTrabajo,
    rpmCalibracion,
    presionCalibracionBar,
    caudalCalibracionLmin,
  });

  const volumenCalibracion = lhaPorBoquilla({
    caudalLmin: caudalCalibracionLmin,
    velocidadKmh: velocidadCalibracion,
    espaciamientoM,
  });
  const volumenTrabajo = lhaPorBoquilla({
    caudalLmin: bomba.valores.caudalEstimadoLmin ?? caudalCalibracionLmin,
    velocidadKmh: velocidadTrabajo,
    espaciamientoM,
  });

  const a = volumenCalibracion.valores.lha;
  const b = volumenTrabajo.valores.lha;
  const factorVolumen = b / a;
  const desviacionPct = (factorVolumen - 1) * PORCIENTO;

  const avisos = [...bomba.avisos, ...volumenCalibracion.avisos, ...volumenTrabajo.avisos];
  avisos.push(
    aviso(
      'info',
      'modelo-aproximado-bomba',
      'Estos son modelos aproximados del comportamiento de la bomba. La verificación por ' +
        'aforo al régimen real de trabajo tiene prioridad sobre cualquiera de los dos ' +
        'escenarios: si puedes aforar a ese régimen, ese dato manda.',
      null
    )
  );

  return {
    valores: {
      escenario: bomba.valores.escenario,
      razonRegimen: bomba.valores.razonRegimen,
      velocidadCalibracionKmh: velocidadCalibracion,
      velocidadTrabajoKmh: velocidadTrabajo,
      presionEstimadaBar: bomba.valores.presionEstimadaBar,
      caudalEstimadoLmin: bomba.valores.caudalEstimadoLmin,
      volumenCalibracionLha: a,
      volumenTrabajoLha: b,
      factorVolumen,
      desviacionPct,
    },
    desglose: [
      ...bomba.desglose,
      ...volumenCalibracion.desglose,
      ...volumenTrabajo.desglose,
      paso(
        'Cambio de volumen por hectárea',
        'volumen_trabajo / volumen_calibracion',
        `${redondeoLegible(b)} / ${redondeoLegible(a)}`,
        factorVolumen,
        ''
      ),
    ],
    avisos,
    verificacion: {
      redundante: volumenTrabajo.verificacion.redundante,
    },
  };
}
