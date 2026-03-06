import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Users ───────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 12);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash, email: 'admin@gridvision.local' },
    create: {
      username: 'admin',
      passwordHash,
      name: 'System Administrator',
      email: 'admin@gridvision.local',
      role: 'ADMIN',
    },
  });

  const operatorHash = await bcrypt.hash('operator123', 12);
  const operator = await prisma.user.upsert({
    where: { username: 'operator1' },
    update: { passwordHash: operatorHash },
    create: {
      username: 'operator1',
      passwordHash: operatorHash,
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@msedcl.in',
      role: 'OPERATOR',
    },
  });

  const engineerHash = await bcrypt.hash('engineer123', 12);
  const engineer = await prisma.user.upsert({
    where: { username: 'engineer1' },
    update: { passwordHash: engineerHash },
    create: {
      username: 'engineer1',
      passwordHash: engineerHash,
      name: 'Sunil Patil',
      email: 'sunil.patil@msedcl.in',
      role: 'ENGINEER',
    },
  });

  const viewerHash = await bcrypt.hash('viewer123', 12);
  const viewer = await prisma.user.upsert({
    where: { username: 'viewer1' },
    update: { passwordHash: viewerHash },
    create: {
      username: 'viewer1',
      passwordHash: viewerHash,
      name: 'Priya Deshmukh',
      email: 'priya.deshmukh@msedcl.in',
      role: 'VIEWER',
    },
  });

  console.log('Created users:', { admin: admin.id, operator: operator.id, engineer: engineer.id, viewer: viewer.id });

  // ─── 33/11 kV Substation (WALUJ) ────────────────
  const waluj = await prisma.substation.upsert({
    where: { code: 'WALUJ' },
    update: {},
    create: {
      name: 'Waluj 33/11 kV Substation',
      code: 'WALUJ',
      type: '33/11kV',
      location: 'Waluj MIDC, Aurangabad, Maharashtra',
      latitude: 19.8762,
      longitude: 75.3433,
      status: 'ACTIVE',
    },
  });

  // 33kV HV Side
  const waluj33kv = await prisma.voltageLevel.create({
    data: {
      substationId: waluj.id,
      nominalKv: 33,
      levelType: 'HV',
      busConfig: 'SINGLE_BUS_SECTION',
    },
  });

  // 11kV LV Side
  const waluj11kv = await prisma.voltageLevel.create({
    data: {
      substationId: waluj.id,
      nominalKv: 11,
      levelType: 'LV',
      busConfig: 'SINGLE_BUS_SECTION',
    },
  });

  // IED Connection for Waluj
  const walujIed = await prisma.iedConnection.create({
    data: {
      substationId: waluj.id,
      name: 'Waluj Main RTU',
      protocol: 'MODBUS_TCP',
      ipAddress: '192.168.1.10',
      port: 502,
      slaveId: 1,
      pollingIntervalMs: 1000,
      timeoutMs: 5000,
    },
  });

  // 33kV Incomer Bay
  const inc33kv = await prisma.bay.create({
    data: {
      voltageLevelId: waluj33kv.id,
      name: '33kV Incomer 1',
      bayType: 'INCOMER',
      bayNumber: 1,
    },
  });

  // 33kV Incomer CB
  const inc33kvCb = await prisma.equipment.create({
    data: {
      bayId: inc33kv.id,
      type: 'CIRCUIT_BREAKER',
      tag: 'WALUJ_33KV_INC1_CB',
      name: '33kV Incomer 1 Circuit Breaker',
      ratedVoltage: 36,
      ratedCurrent: 1250,
      sldX: 400,
      sldY: 80,
    },
  });

  // CB Status data point
  await prisma.dataPoint.create({
    data: {
      equipmentId: inc33kvCb.id,
      tag: 'WALUJ_33KV_INC1_CB_STATUS',
      name: '33kV Incomer 1 CB Status',
      paramType: 'DIGITAL',
      iedConnectionId: walujIed.id,
      registerAddress: 0,
      registerType: 'COIL',
    },
  });

  // 33kV Bus Section
  const bsc33kv = await prisma.bay.create({
    data: {
      voltageLevelId: waluj33kv.id,
      name: '33kV Bus Section',
      bayType: 'BUS_SECTION',
      bayNumber: 1,
    },
  });

  const bsc33kvCb = await prisma.equipment.create({
    data: {
      bayId: bsc33kv.id,
      type: 'CIRCUIT_BREAKER',
      tag: 'WALUJ_33KV_BSC_CB',
      name: '33kV Bus Section CB',
      ratedVoltage: 36,
      ratedCurrent: 1250,
      sldX: 500,
      sldY: 150,
    },
  });

  await prisma.dataPoint.create({
    data: {
      equipmentId: bsc33kvCb.id,
      tag: 'WALUJ_33KV_BSC_CB_STATUS',
      name: '33kV Bus Section CB Status',
      paramType: 'DIGITAL',
      iedConnectionId: walujIed.id,
      registerAddress: 1,
      registerType: 'COIL',
    },
  });

  // Bus Bars
  await prisma.equipment.create({
    data: {
      bayId: bsc33kv.id,
      type: 'BUS_BAR',
      tag: 'WALUJ_33KV_BUS1',
      name: '33kV Bus Section 1',
      ratedVoltage: 36,
      sldX: 200,
      sldY: 150,
    },
  });

  await prisma.equipment.create({
    data: {
      bayId: bsc33kv.id,
      type: 'BUS_BAR',
      tag: 'WALUJ_33KV_BUS2',
      name: '33kV Bus Section 2',
      ratedVoltage: 36,
      sldX: 600,
      sldY: 150,
    },
  });

  // Transformer 1 Bay
  const tr1Bay = await prisma.bay.create({
    data: {
      voltageLevelId: waluj33kv.id,
      name: 'Transformer 1',
      bayType: 'TRANSFORMER',
      bayNumber: 1,
    },
  });

  const tr1HvCb = await prisma.equipment.create({
    data: {
      bayId: tr1Bay.id,
      type: 'CIRCUIT_BREAKER',
      tag: 'WALUJ_33KV_TR1_CB',
      name: 'TR1 33kV CB',
      ratedVoltage: 36,
      ratedCurrent: 630,
      sldX: 300,
      sldY: 200,
    },
  });

  await prisma.dataPoint.create({
    data: {
      equipmentId: tr1HvCb.id,
      tag: 'WALUJ_33KV_TR1_CB_STATUS',
      name: 'TR1 33kV CB Status',
      paramType: 'DIGITAL',
      iedConnectionId: walujIed.id,
      registerAddress: 2,
      registerType: 'COIL',
    },
  });

  const tr1 = await prisma.equipment.create({
    data: {
      bayId: tr1Bay.id,
      type: 'POWER_TRANSFORMER',
      tag: 'WALUJ_TR1',
      name: 'Power Transformer 1 (33/11 kV, 8 MVA)',
      ratedVoltage: 33,
      ratedMva: 8,
      sldX: 300,
      sldY: 280,
      metadata: { hvVoltage: 33, lvVoltage: 11, mva: 8, coolingType: 'ONAN/ONAF' },
    },
  });

  // TR1 data points
  const tr1DataPoints = [
    { tag: 'WALUJ_TR1_V_HV', name: 'TR1 HV Voltage', paramType: 'ANALOG', unit: 'kV', regAddr: 100, scaleFactor: 0.1 },
    { tag: 'WALUJ_TR1_V_LV', name: 'TR1 LV Voltage', paramType: 'ANALOG', unit: 'kV', regAddr: 101, scaleFactor: 0.1 },
    { tag: 'WALUJ_TR1_I_HV', name: 'TR1 HV Current', paramType: 'ANALOG', unit: 'A', regAddr: 102, scaleFactor: 0.1 },
    { tag: 'WALUJ_TR1_P_3PH', name: 'TR1 3-Phase Power', paramType: 'ANALOG', unit: 'MW', regAddr: 106, scaleFactor: 0.01 },
    { tag: 'WALUJ_TR1_TAP_POS', name: 'TR1 Tap Position', paramType: 'ANALOG', unit: '', regAddr: 110 },
    { tag: 'WALUJ_TR1_OIL_TEMP', name: 'TR1 Oil Temperature', paramType: 'ANALOG', unit: '°C', regAddr: 111, scaleFactor: 0.1 },
  ];

  for (const dp of tr1DataPoints) {
    await prisma.dataPoint.create({
      data: {
        equipmentId: tr1.id,
        tag: dp.tag,
        name: dp.name,
        paramType: dp.paramType as string,
        unit: dp.unit || undefined,
        iedConnectionId: walujIed.id,
        registerAddress: dp.regAddr,
        registerType: 'HOLDING',
        scaleFactor: dp.scaleFactor || 1.0,
      },
    });
  }

  // 11kV Feeders (6 feeders)
  for (let i = 1; i <= 6; i++) {
    const fdrBay = await prisma.bay.create({
      data: {
        voltageLevelId: waluj11kv.id,
        name: `11kV Feeder ${i}`,
        bayType: 'FEEDER',
        bayNumber: i,
      },
    });

    const fdrNum = String(i).padStart(2, '0');

    const fdrCb = await prisma.equipment.create({
      data: {
        bayId: fdrBay.id,
        type: 'CIRCUIT_BREAKER',
        tag: `WALUJ_11KV_FDR${fdrNum}_CB`,
        name: `11kV Feeder ${i} CB`,
        ratedVoltage: 12,
        ratedCurrent: 630,
        sldX: 100 + (i - 1) * 120,
        sldY: 480,
      },
    });

    await prisma.dataPoint.create({
      data: {
        equipmentId: fdrCb.id,
        tag: `WALUJ_11KV_FDR${fdrNum}_CB_STATUS`,
        name: `Feeder ${i} CB Status`,
        paramType: 'DIGITAL',
        iedConnectionId: walujIed.id,
        registerAddress: 10 + i,
        registerType: 'COIL',
      },
    });

    const feederLine = await prisma.equipment.create({
      data: {
        bayId: fdrBay.id,
        type: 'FEEDER_LINE',
        tag: `WALUJ_11KV_FDR${fdrNum}`,
        name: `11kV Feeder ${i}`,
        ratedVoltage: 11,
        ratedCurrent: 400,
        sldX: 100 + (i - 1) * 120,
        sldY: 520,
      },
    });

    // Feeder data points
    const fdrDataPoints = [
      { tag: `WALUJ_11KV_FDR${fdrNum}_V_RY`, name: `Feeder ${i} R-Y Voltage`, unit: 'kV', regAddr: 200 + (i - 1) * 20 },
      { tag: `WALUJ_11KV_FDR${fdrNum}_I_R`, name: `Feeder ${i} R Current`, unit: 'A', regAddr: 203 + (i - 1) * 20 },
      { tag: `WALUJ_11KV_FDR${fdrNum}_I_Y`, name: `Feeder ${i} Y Current`, unit: 'A', regAddr: 204 + (i - 1) * 20 },
      { tag: `WALUJ_11KV_FDR${fdrNum}_I_B`, name: `Feeder ${i} B Current`, unit: 'A', regAddr: 205 + (i - 1) * 20 },
      { tag: `WALUJ_11KV_FDR${fdrNum}_P_3PH`, name: `Feeder ${i} 3-Phase Power`, unit: 'MW', regAddr: 206 + (i - 1) * 20 },
      { tag: `WALUJ_11KV_FDR${fdrNum}_Q_3PH`, name: `Feeder ${i} Reactive Power`, unit: 'MVAR', regAddr: 207 + (i - 1) * 20 },
      { tag: `WALUJ_11KV_FDR${fdrNum}_PF`, name: `Feeder ${i} Power Factor`, unit: '', regAddr: 208 + (i - 1) * 20 },
    ];

    for (const dp of fdrDataPoints) {
      await prisma.dataPoint.create({
        data: {
          equipmentId: feederLine.id,
          tag: dp.tag,
          name: dp.name,
          paramType: 'ANALOG',
          unit: dp.unit || undefined,
          iedConnectionId: walujIed.id,
          registerAddress: dp.regAddr,
          registerType: 'HOLDING',
          scaleFactor: dp.unit === 'kV' ? 0.1 : dp.unit === 'MW' || dp.unit === 'MVAR' ? 0.01 : dp.unit === '' ? 0.001 : 0.1,
        },
      });
    }
  }

  // ─── Sample 33/11kV Substation (SAMPLE) ─────────
  // Idempotent: only create if the SAMPLE substation does not yet exist
  const existingSample = await prisma.substation.findUnique({ where: { code: 'SAMPLE' } });

  if (!existingSample) {
    console.log('Creating Sample 33/11kV Substation...');

    const sampleSub = await prisma.substation.create({
      data: {
        name: 'Sample 33/11kV Substation',
        code: 'SAMPLE',
        type: '33/11kV',
        location: 'Demo Environment',
        latitude: 19.0760,
        longitude: 72.8777,
        status: 'ACTIVE',
      },
    });

    // Voltage levels
    const sample33kv = await prisma.voltageLevel.create({
      data: {
        substationId: sampleSub.id,
        nominalKv: 33,
        levelType: 'HV',
        busConfig: 'SINGLE_BUS',
      },
    });

    const sample11kv = await prisma.voltageLevel.create({
      data: {
        substationId: sampleSub.id,
        nominalKv: 11,
        levelType: 'LV',
        busConfig: 'SINGLE_BUS',
      },
    });

    // IED Connection — simulator on localhost
    const sampleIed = await prisma.iedConnection.create({
      data: {
        substationId: sampleSub.id,
        name: 'Sample Simulator RTU',
        protocol: 'MODBUS_TCP',
        ipAddress: '127.0.0.1',
        port: 5020,
        slaveId: 1,
        pollingIntervalMs: 1000,
        timeoutMs: 5000,
      },
    });

    // ── 33kV Incoming Bays (2) ──
    for (let i = 1; i <= 2; i++) {
      const num = String(i).padStart(2, '0');
      const incBay = await prisma.bay.create({
        data: {
          voltageLevelId: sample33kv.id,
          name: `33kV Incomer ${i}`,
          bayType: 'INCOMER',
          bayNumber: i,
        },
      });

      // Circuit Breaker
      const incCb = await prisma.equipment.create({
        data: {
          bayId: incBay.id,
          type: 'CIRCUIT_BREAKER',
          tag: `SAMPLE_33KV_INC${num}_CB`,
          name: `33kV Incomer ${i} Circuit Breaker`,
          ratedVoltage: 36,
          ratedCurrent: 1250,
          sldX: 200 + (i - 1) * 250,
          sldY: 80,
        },
      });
      await prisma.dataPoint.create({
        data: {
          equipmentId: incCb.id,
          tag: `SAMPLE_33KV_INC${num}_CB_STATUS`,
          name: `33kV Incomer ${i} CB Status`,
          paramType: 'DIGITAL',
          iedConnectionId: sampleIed.id,
          registerAddress: 500 + (i - 1),
          registerType: 'COIL',
        },
      });

      // Current Transformer
      const incCt = await prisma.equipment.create({
        data: {
          bayId: incBay.id,
          type: 'CURRENT_TRANSFORMER',
          tag: `SAMPLE_33KV_INC${num}_CT`,
          name: `33kV Incomer ${i} CT`,
          ratedVoltage: 36,
          ratedCurrent: 1250,
          sldX: 200 + (i - 1) * 250,
          sldY: 110,
        },
      });
      // CT current measurement
      await prisma.dataPoint.create({
        data: {
          equipmentId: incCt.id,
          tag: `SAMPLE_33KV_INC${num}_I_R`,
          name: `33kV Incomer ${i} R Current`,
          paramType: 'ANALOG',
          unit: 'A',
          iedConnectionId: sampleIed.id,
          registerAddress: 600 + (i - 1) * 10,
          registerType: 'HOLDING',
          scaleFactor: 0.1,
        },
      });

      // Potential Transformer
      const incPt = await prisma.equipment.create({
        data: {
          bayId: incBay.id,
          type: 'POTENTIAL_TRANSFORMER',
          tag: `SAMPLE_33KV_INC${num}_PT`,
          name: `33kV Incomer ${i} PT`,
          ratedVoltage: 36,
          sldX: 200 + (i - 1) * 250,
          sldY: 140,
        },
      });
      // PT voltage measurement
      await prisma.dataPoint.create({
        data: {
          equipmentId: incPt.id,
          tag: `SAMPLE_33KV_INC${num}_V_RY`,
          name: `33kV Incomer ${i} R-Y Voltage`,
          paramType: 'ANALOG',
          unit: 'kV',
          iedConnectionId: sampleIed.id,
          registerAddress: 620 + (i - 1) * 10,
          registerType: 'HOLDING',
          scaleFactor: 0.1,
        },
      });

      // Line Isolator
      await prisma.equipment.create({
        data: {
          bayId: incBay.id,
          type: 'ISOLATOR',
          tag: `SAMPLE_33KV_INC${num}_ISO_LINE`,
          name: `33kV Incomer ${i} Line Isolator`,
          ratedVoltage: 36,
          ratedCurrent: 1250,
          sldX: 200 + (i - 1) * 250,
          sldY: 50,
        },
      });

      // Bus Isolator
      await prisma.equipment.create({
        data: {
          bayId: incBay.id,
          type: 'ISOLATOR',
          tag: `SAMPLE_33KV_INC${num}_ISO_BUS`,
          name: `33kV Incomer ${i} Bus Isolator`,
          ratedVoltage: 36,
          ratedCurrent: 1250,
          sldX: 200 + (i - 1) * 250,
          sldY: 170,
        },
      });
    }

    // ── 11kV Outgoing Feeder Bays (2) ──
    for (let i = 1; i <= 2; i++) {
      const num = String(i).padStart(2, '0');
      const fdrBay = await prisma.bay.create({
        data: {
          voltageLevelId: sample11kv.id,
          name: `11kV Feeder ${i}`,
          bayType: 'FEEDER',
          bayNumber: i,
        },
      });

      // Circuit Breaker
      const fdrCb = await prisma.equipment.create({
        data: {
          bayId: fdrBay.id,
          type: 'CIRCUIT_BREAKER',
          tag: `SAMPLE_11KV_FDR${num}_CB`,
          name: `11kV Feeder ${i} Circuit Breaker`,
          ratedVoltage: 12,
          ratedCurrent: 630,
          sldX: 200 + (i - 1) * 250,
          sldY: 400,
        },
      });
      await prisma.dataPoint.create({
        data: {
          equipmentId: fdrCb.id,
          tag: `SAMPLE_11KV_FDR${num}_CB_STATUS`,
          name: `11kV Feeder ${i} CB Status`,
          paramType: 'DIGITAL',
          iedConnectionId: sampleIed.id,
          registerAddress: 510 + (i - 1),
          registerType: 'COIL',
        },
      });

      // Current Transformer
      const fdrCt = await prisma.equipment.create({
        data: {
          bayId: fdrBay.id,
          type: 'CURRENT_TRANSFORMER',
          tag: `SAMPLE_11KV_FDR${num}_CT`,
          name: `11kV Feeder ${i} CT`,
          ratedVoltage: 12,
          ratedCurrent: 630,
          sldX: 200 + (i - 1) * 250,
          sldY: 430,
        },
      });
      // CT current measurements (3 phases)
      for (const [phase, offset] of [['R', 0], ['Y', 1], ['B', 2]] as [string, number][]) {
        await prisma.dataPoint.create({
          data: {
            equipmentId: fdrCt.id,
            tag: `SAMPLE_11KV_FDR${num}_I_${phase}`,
            name: `11kV Feeder ${i} ${phase} Current`,
            paramType: 'ANALOG',
            unit: 'A',
            iedConnectionId: sampleIed.id,
            registerAddress: 700 + (i - 1) * 20 + offset,
            registerType: 'HOLDING',
            scaleFactor: 0.1,
          },
        });
      }

      // Potential Transformer
      const fdrPt = await prisma.equipment.create({
        data: {
          bayId: fdrBay.id,
          type: 'POTENTIAL_TRANSFORMER',
          tag: `SAMPLE_11KV_FDR${num}_PT`,
          name: `11kV Feeder ${i} PT`,
          ratedVoltage: 12,
          sldX: 200 + (i - 1) * 250,
          sldY: 460,
        },
      });
      // PT voltage measurement
      await prisma.dataPoint.create({
        data: {
          equipmentId: fdrPt.id,
          tag: `SAMPLE_11KV_FDR${num}_V_RY`,
          name: `11kV Feeder ${i} R-Y Voltage`,
          paramType: 'ANALOG',
          unit: 'kV',
          iedConnectionId: sampleIed.id,
          registerAddress: 720 + (i - 1) * 20,
          registerType: 'HOLDING',
          scaleFactor: 0.1,
        },
      });

      // Line Isolator
      await prisma.equipment.create({
        data: {
          bayId: fdrBay.id,
          type: 'ISOLATOR',
          tag: `SAMPLE_11KV_FDR${num}_ISO_LINE`,
          name: `11kV Feeder ${i} Line Isolator`,
          ratedVoltage: 12,
          ratedCurrent: 630,
          sldX: 200 + (i - 1) * 250,
          sldY: 370,
        },
      });

      // Bus Isolator
      await prisma.equipment.create({
        data: {
          bayId: fdrBay.id,
          type: 'ISOLATOR',
          tag: `SAMPLE_11KV_FDR${num}_ISO_BUS`,
          name: `11kV Feeder ${i} Bus Isolator`,
          ratedVoltage: 12,
          ratedCurrent: 630,
          sldX: 200 + (i - 1) * 250,
          sldY: 490,
        },
      });
    }

    console.log('Created Sample 33/11kV Substation with bays, equipment, and IED connection.');
  } else {
    console.log('Sample substation already exists, skipping.');
  }

  // ─── Alarm Definitions ──────────────────────────
  // Get all analog data points for alarm creation
  const analogPoints = await prisma.dataPoint.findMany({
    where: { paramType: 'ANALOG' },
    include: { equipment: true },
  });

  for (const dp of analogPoints) {
    if (dp.tag.includes('_V_') && dp.unit === 'kV') {
      const nominalVoltage = dp.tag.includes('33KV') ? 33 : 11;
      const highThreshold = nominalVoltage * 1.05;
      const highHighThreshold = nominalVoltage * 1.1;
      const lowThreshold = nominalVoltage * 0.95;
      const lowLowThreshold = nominalVoltage * 0.9;

      await prisma.alarmDefinition.createMany({
        data: [
          { dataPointId: dp.id, alarmType: 'HIGH_HIGH', threshold: highHighThreshold, priority: 1, messageTemplate: `${dp.name} HIGH-HIGH: {value} ${dp.unit}`, deadband: 0.5 },
          { dataPointId: dp.id, alarmType: 'HIGH', threshold: highThreshold, priority: 2, messageTemplate: `${dp.name} HIGH: {value} ${dp.unit}`, deadband: 0.3 },
          { dataPointId: dp.id, alarmType: 'LOW', threshold: lowThreshold, priority: 2, messageTemplate: `${dp.name} LOW: {value} ${dp.unit}`, deadband: 0.3 },
          { dataPointId: dp.id, alarmType: 'LOW_LOW', threshold: lowLowThreshold, priority: 1, messageTemplate: `${dp.name} LOW-LOW: {value} ${dp.unit}`, deadband: 0.5 },
        ],
      });
    }

    if (dp.tag.includes('_I_') && dp.unit === 'A') {
      const ratedCurrent = Number(dp.equipment.ratedCurrent) || 400;
      await prisma.alarmDefinition.createMany({
        data: [
          { dataPointId: dp.id, alarmType: 'HIGH_HIGH', threshold: ratedCurrent * 1.2, priority: 1, messageTemplate: `${dp.name} OVERLOAD: {value} A`, deadband: 5 },
          { dataPointId: dp.id, alarmType: 'HIGH', threshold: ratedCurrent * 1.0, priority: 2, messageTemplate: `${dp.name} HIGH: {value} A`, deadband: 3 },
        ],
      });
    }
  }

  // CB state change alarms
  const digitalPoints = await prisma.dataPoint.findMany({
    where: { paramType: 'DIGITAL', tag: { contains: 'CB_STATUS' } },
  });

  for (const dp of digitalPoints) {
    await prisma.alarmDefinition.create({
      data: {
        dataPointId: dp.id,
        alarmType: 'STATE_CHANGE',
        priority: 1,
        messageTemplate: `${dp.name} TRIPPED`,
        isEnabled: true,
      },
    });
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
