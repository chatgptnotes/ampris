/**
 * Modbus Register Parser
 * Decodes raw register arrays into typed values with support for multiple byte orders.
 * ABB relays use BIG_ENDIAN by default.
 */

export type ByteOrder = 'BIG_ENDIAN' | 'LITTLE_ENDIAN' | 'MID_BIG' | 'MID_LITTLE';

export interface DecodedValue {
  type: string;
  value: number | boolean | string;
  hex: string;
}

export interface RegisterDecoding {
  register: number;
  rawHex: string;
  decodings: DecodedValue[];
  likelyMeaning?: string;
}

/** Decode a single register as INT16 */
export function decodeInt16(registers: number[], offset = 0): number {
  const val = registers[offset] & 0xFFFF;
  return val > 0x7FFF ? val - 0x10000 : val;
}

/** Decode a single register as UINT16 */
export function decodeUint16(registers: number[], offset = 0): number {
  return registers[offset] & 0xFFFF;
}

/** Decode two registers as INT32 */
export function decodeInt32(registers: number[], offset = 0, byteOrder: ByteOrder = 'BIG_ENDIAN'): number {
  const [hi, lo] = reorderRegisters(registers, offset, 2, byteOrder);
  const val = ((hi & 0xFFFF) << 16) | (lo & 0xFFFF);
  return val | 0; // force signed 32-bit
}

/** Decode two registers as UINT32 */
export function decodeUint32(registers: number[], offset = 0, byteOrder: ByteOrder = 'BIG_ENDIAN'): number {
  const [hi, lo] = reorderRegisters(registers, offset, 2, byteOrder);
  return (((hi & 0xFFFF) << 16) | (lo & 0xFFFF)) >>> 0;
}

/** Decode two registers as IEEE 754 FLOAT32 */
export function decodeFloat32(registers: number[], offset = 0, byteOrder: ByteOrder = 'BIG_ENDIAN'): number {
  const [hi, lo] = reorderRegisters(registers, offset, 2, byteOrder);
  const buf = Buffer.alloc(4);
  buf.writeUInt16BE(hi & 0xFFFF, 0);
  buf.writeUInt16BE(lo & 0xFFFF, 2);
  return buf.readFloatBE(0);
}

/** Decode four registers as IEEE 754 FLOAT64 */
export function decodeFloat64(registers: number[], offset = 0, byteOrder: ByteOrder = 'BIG_ENDIAN'): number {
  const reordered = reorderRegisters(registers, offset, 4, byteOrder);
  const buf = Buffer.alloc(8);
  for (let i = 0; i < 4; i++) {
    buf.writeUInt16BE(reordered[i] & 0xFFFF, i * 2);
  }
  return buf.readDoubleBE(0);
}

/** Extract a single bit from a register */
export function decodeBit(registers: number[], offset = 0, bitIndex: number): boolean {
  return ((registers[offset] >> bitIndex) & 1) === 1;
}

/** Reorder registers based on byte order */
function reorderRegisters(registers: number[], offset: number, count: number, byteOrder: ByteOrder): number[] {
  const regs = registers.slice(offset, offset + count);
  switch (byteOrder) {
    case 'BIG_ENDIAN': // AB CD — standard (most significant first)
      return regs;
    case 'LITTLE_ENDIAN': // CD AB — reversed
      return regs.reverse();
    case 'MID_BIG': // BA DC — byte-swapped within each register
      return regs.map(r => ((r & 0xFF) << 8) | ((r >> 8) & 0xFF));
    case 'MID_LITTLE': // DC BA — byte-swapped and reversed
      return regs.reverse().map(r => ((r & 0xFF) << 8) | ((r >> 8) & 0xFF));
    default:
      return regs;
  }
}

/** Format register array as hex string */
export function registersToHex(registers: number[]): string {
  return registers.map(r => (r & 0xFFFF).toString(16).padStart(4, '0').toUpperCase()).join(' ');
}

/**
 * Show ALL possible decodings for a set of registers.
 * Useful when exploring unknown registers to identify data types.
 */
export function decodeAll(registers: number[], startRegister: number, byteOrder: ByteOrder = 'BIG_ENDIAN'): RegisterDecoding[] {
  const results: RegisterDecoding[] = [];

  for (let i = 0; i < registers.length; i++) {
    const entry: RegisterDecoding = {
      register: startRegister + i,
      rawHex: (registers[i] & 0xFFFF).toString(16).padStart(4, '0').toUpperCase(),
      decodings: [],
    };

    // Single register decodings
    entry.decodings.push({
      type: 'UINT16',
      value: decodeUint16(registers, i),
      hex: entry.rawHex,
    });
    entry.decodings.push({
      type: 'INT16',
      value: decodeInt16(registers, i),
      hex: entry.rawHex,
    });

    // Two-register decodings (if next register exists)
    if (i + 1 < registers.length) {
      const f32 = decodeFloat32(registers, i, byteOrder);
      if (isFinite(f32) && Math.abs(f32) < 1e10 && Math.abs(f32) > 1e-10) {
        entry.decodings.push({
          type: 'FLOAT32',
          value: Math.round(f32 * 10000) / 10000,
          hex: registersToHex(registers.slice(i, i + 2)),
        });
      }
      entry.decodings.push({
        type: 'UINT32',
        value: decodeUint32(registers, i, byteOrder),
        hex: registersToHex(registers.slice(i, i + 2)),
      });
      entry.decodings.push({
        type: 'INT32',
        value: decodeInt32(registers, i, byteOrder),
        hex: registersToHex(registers.slice(i, i + 2)),
      });
    }

    results.push(entry);
  }

  return results;
}

/**
 * Decode a register value using a specified type and parameters.
 */
export function decodeRegisterValue(
  registers: number[],
  offset: number,
  dataType: string,
  byteOrder: ByteOrder = 'BIG_ENDIAN',
  bitIndex?: number,
): number | boolean {
  switch (dataType.toUpperCase()) {
    case 'INT16':
      return decodeInt16(registers, offset);
    case 'UINT16':
      return decodeUint16(registers, offset);
    case 'INT32':
      return decodeInt32(registers, offset, byteOrder);
    case 'UINT32':
      return decodeUint32(registers, offset, byteOrder);
    case 'FLOAT32':
      return decodeFloat32(registers, offset, byteOrder);
    case 'FLOAT64':
      return decodeFloat64(registers, offset, byteOrder);
    case 'BIT':
    case 'BOOLEAN':
      return decodeBit(registers, offset, bitIndex ?? 0);
    default:
      return decodeUint16(registers, offset);
  }
}
