/**
 * MMS Browse Service
 *
 * Browses IEC 61850 MMS servers to discover data models at runtime.
 * The relay's internal data model IS the ICD — you just read it live.
 *
 * Key IEC 61850 Logical Node Classes:
 *   MMXU — Measurement (V, I, P, Q, Hz, PF)
 *   XCBR — Circuit Breaker
 *   XSWI — Disconnector / Switch
 *   PTOC — Overcurrent Protection
 *   PDIS — Distance Protection
 *   PDIF — Differential Protection
 *   PTRC — Protection Trip Conditioning
 *   RREC — Auto-Reclosing
 *   CSWI — Switch Controller
 *   GGIO — Generic I/O
 *   LLN0 — Logical Node Zero (datasets, reports)
 *   LPHD — Physical Device Info
 */

import {
  IEC61850MmsClient,
  type MmsServerDirectory,
  type LogicalDevice,
  type LogicalNode,
  type DataObject,
  type DataAttribute,
} from '../protocol/iec61850/iec61850-client';

// ─── Semantic Mapping ───────────────────────────────

export interface MeasurementPoint {
  reference: string;
  logicalDevice: string;
  logicalNode: string;
  lnClass: string;
  dataObject: string;
  description: string;
  unit?: string;
  type: 'analog' | 'digital' | 'status';
}

const LN_CLASS_DESCRIPTIONS: Record<string, string> = {
  MMXU: 'Measurement (3-phase)',
  MSQI: 'Sequence & Imbalance',
  MMTR: 'Metering',
  MHAI: 'Harmonics',
  MMXN: 'Measurement (non-phase)',
  XCBR: 'Circuit Breaker',
  XSWI: 'Disconnector/Switch',
  PTOC: 'Overcurrent Protection',
  PDIS: 'Distance Protection',
  PDIF: 'Differential Protection',
  PTRC: 'Protection Trip',
  PTUV: 'Undervoltage Protection',
  PTOV: 'Overvoltage Protection',
  PTUF: 'Underfrequency Protection',
  PTOF: 'Overfrequency Protection',
  RREC: 'Auto-Reclosing',
  RBRF: 'Breaker Failure',
  CSWI: 'Switch Controller',
  CILO: 'Interlocking',
  GGIO: 'Generic I/O',
  LLN0: 'Logical Node Zero',
  LPHD: 'Physical Device',
  SIML: 'Simulation',
  YLTC: 'Tap Changer',
  YEFN: 'Earthing Function',
  ZSAR: 'Auto-Reclose Logic',
};

const MMXU_DATA_OBJECTS: Record<string, { description: string; unit: string; type: 'analog' | 'digital' }> = {
  'PhV': { description: 'Phase Voltage', unit: 'kV', type: 'analog' },
  'PPV': { description: 'Phase-to-Phase Voltage', unit: 'kV', type: 'analog' },
  'A': { description: 'Phase Current', unit: 'A', type: 'analog' },
  'W': { description: 'Active Power', unit: 'MW', type: 'analog' },
  'VAr': { description: 'Reactive Power', unit: 'MVAr', type: 'analog' },
  'VA': { description: 'Apparent Power', unit: 'MVA', type: 'analog' },
  'Hz': { description: 'Frequency', unit: 'Hz', type: 'analog' },
  'PF': { description: 'Power Factor', unit: '', type: 'analog' },
  'TotW': { description: 'Total Active Power', unit: 'MW', type: 'analog' },
  'TotVAr': { description: 'Total Reactive Power', unit: 'MVAr', type: 'analog' },
  'TotVA': { description: 'Total Apparent Power', unit: 'MVA', type: 'analog' },
  'TotPF': { description: 'Total Power Factor', unit: '', type: 'analog' },
};

// ─── Service ────────────────────────────────────────

class MmsBrowseService {

  /**
   * Browse full data model from an IEC 61850 server.
   */
  async browse(host: string, port: number = 102): Promise<MmsServerDirectory> {
    const client = new IEC61850MmsClient(host, port, 15000);
    try {
      await client.connect();
      const model = await client.browseFullModel();
      await client.disconnect();
      return model;
    } catch (err) {
      try { await client.disconnect(); } catch { /* ignore */ }
      throw err;
    }
  }

  /**
   * Discover all measurement nodes (MMXU, MSQI, MMTR etc.) with semantic mapping.
   */
  async discoverMeasurements(host: string, port: number = 102): Promise<MeasurementPoint[]> {
    const model = await this.browse(host, port);
    const points: MeasurementPoint[] = [];

    for (const ld of model.logicalDevices) {
      for (const ln of ld.logicalNodes) {
        // MMXU nodes contain measurement data objects
        if (ln.lnClass === 'MMXU' || ln.lnClass === 'MSQI' || ln.lnClass === 'MMTR' || ln.lnClass === 'MMXN') {
          for (const dataObj of ln.dataObjects) {
            const mapping = MMXU_DATA_OBJECTS[dataObj.name];
            points.push({
              reference: `${ld.name}/${ln.name}$MX$${dataObj.name}`,
              logicalDevice: ld.name,
              logicalNode: ln.name,
              lnClass: ln.lnClass,
              dataObject: dataObj.name,
              description: mapping?.description || dataObj.name,
              unit: mapping?.unit,
              type: mapping?.type || 'analog',
            });
          }
        }

        // XCBR/XSWI — circuit breaker / switch positions
        if (ln.lnClass === 'XCBR' || ln.lnClass === 'XSWI') {
          for (const dataObj of ln.dataObjects) {
            if (dataObj.name === 'Pos' || dataObj.name === 'OpCnt') {
              points.push({
                reference: `${ld.name}/${ln.name}$ST$${dataObj.name}`,
                logicalDevice: ld.name,
                logicalNode: ln.name,
                lnClass: ln.lnClass,
                dataObject: dataObj.name,
                description: dataObj.name === 'Pos' ? 'Position' : 'Operation Counter',
                type: dataObj.name === 'Pos' ? 'digital' : 'analog',
              });
            }
          }
        }

        // Protection nodes — trip/operate status
        if (['PTOC', 'PDIS', 'PDIF', 'PTRC', 'PTOV', 'PTUV', 'PTUF', 'PTOF', 'RBRF'].includes(ln.lnClass)) {
          for (const dataObj of ln.dataObjects) {
            if (dataObj.name === 'Op' || dataObj.name === 'Str' || dataObj.name === 'Tr') {
              points.push({
                reference: `${ld.name}/${ln.name}$ST$${dataObj.name}`,
                logicalDevice: ld.name,
                logicalNode: ln.name,
                lnClass: ln.lnClass,
                dataObject: dataObj.name,
                description: `${LN_CLASS_DESCRIPTIONS[ln.lnClass] || ln.lnClass} — ${
                  dataObj.name === 'Op' ? 'Operate' : dataObj.name === 'Str' ? 'Start' : 'Trip'
                }`,
                type: 'digital',
              });
            }
          }
        }
      }
    }

    return points;
  }

  /**
   * Export discovered model as ICD/SCL XML format.
   * Generates a valid ICD file from the live data model.
   */
  async exportAsICD(host: string, port: number = 102): Promise<string> {
    const model = await this.browse(host, port);
    return this.generateSCL(model, host);
  }

  /**
   * Get descriptions for LN classes.
   */
  getLNClassDescriptions(): Record<string, string> {
    return { ...LN_CLASS_DESCRIPTIONS };
  }

  // ─── SCL/ICD Generation ───────────────────────────

  private generateSCL(model: MmsServerDirectory, host: string): string {
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B">');
    lines.push('  <Header id="generated" version="1.0" revision="1" toolID="Ampris SCADA"/>');
    lines.push('  <Communication>');
    lines.push('    <SubNetwork name="SubNet1" type="8-MMS">');
    lines.push(`      <ConnectedAP iedName="IED1" apName="AP1">`);
    lines.push(`        <Address>`);
    lines.push(`          <P type="IP">${host}</P>`);
    lines.push(`          <P type="IP-SUBNET">255.255.255.0</P>`);
    lines.push(`          <P type="OSI-PSEL">00000001</P>`);
    lines.push(`          <P type="OSI-SSEL">0001</P>`);
    lines.push(`          <P type="OSI-TSEL">0001</P>`);
    lines.push(`        </Address>`);
    lines.push(`      </ConnectedAP>`);
    lines.push('    </SubNetwork>');
    lines.push('  </Communication>');
    lines.push('  <IED name="IED1" manufacturer="ABB" type="ProtectionRelay">');
    lines.push('    <Services>');
    lines.push('      <GetDirectory/>');
    lines.push('      <GetDataObjectDefinition/>');
    lines.push('      <GetDataSetValue/>');
    lines.push('      <ReadWrite/>');
    lines.push('    </Services>');
    lines.push('    <AccessPoint name="AP1">');
    lines.push('      <Server>');

    for (const ld of model.logicalDevices) {
      lines.push(`        <LDevice inst="${ld.name}">`);
      for (const ln of ld.logicalNodes) {
        const lnClass = ln.lnClass;
        const inst = ln.name.replace(lnClass, '') || '1';
        if (ln.name === 'LLN0') {
          lines.push(`          <LN0 lnClass="LLN0" inst="" lnType="${ld.name}_LLN0">`);
          lines.push(`          </LN0>`);
        } else {
          lines.push(`          <LN lnClass="${lnClass}" inst="${inst}" lnType="${ld.name}_${ln.name}">`);
          for (const dataObj of ln.dataObjects) {
            lines.push(`            <DOI name="${dataObj.name}"/>`);
          }
          lines.push(`          </LN>`);
        }
      }
      lines.push(`        </LDevice>`);
    }

    lines.push('      </Server>');
    lines.push('    </AccessPoint>');
    lines.push('  </IED>');

    // DataTypeTemplates
    lines.push('  <DataTypeTemplates>');
    for (const ld of model.logicalDevices) {
      for (const ln of ld.logicalNodes) {
        const lnType = ln.name === 'LLN0' ? `${ld.name}_LLN0` : `${ld.name}_${ln.name}`;
        lines.push(`    <LNodeType id="${lnType}" lnClass="${ln.lnClass}">`);
        for (const dataObj of ln.dataObjects) {
          const doType = `${lnType}_${dataObj.name}`;
          lines.push(`      <DO name="${dataObj.name}" type="${doType}"/>`);
        }
        lines.push(`    </LNodeType>`);
      }
    }
    lines.push('  </DataTypeTemplates>');
    lines.push('</SCL>');

    return lines.join('\n');
  }
}

export const mmsBrowseService = new MmsBrowseService();
