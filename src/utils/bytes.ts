export enum ByteLength {
  UINT_8 = 2,
  UINT_16 = 4,
  UINT_24 = 6,
  UINT_32 = 8,
  UINT_40 = 10,
  UINT_48 = 12,
  UINT_56 = 14,
  UINT_64 = 16,
  UINT_72 = 18,
  UINT_80 = 20,
  UINT_88 = 22,
  UINT_96 = 24,
  UINT_104 = 26,
  UINT_112 = 28,
  UINT_120 = 30,
  UINT_128 = 32,
  UINT_136 = 34,
  UINT_144 = 36,
  UINT_152 = 38,
  UINT_160 = 40,
  UINT_168 = 42,
  UINT_176 = 44,
  UINT_184 = 46,
  UINT_192 = 48,
  UINT_200 = 50,
  UINT_208 = 52,
  UINT_216 = 54,
  UINT_224 = 56,
  UINT_232 = 58,
  UINT_240 = 60,
  UINT_248 = 62,
  UINT_256 = 64,
}

export class ByteUtils {
  static nToHex(input: bigint | number, byteLength: ByteLength): string {
    const hex = BigInt(input).toString(16);
    return this.formatToByteLength(hex, byteLength);
  }

  static formatToByteLength(hex: string, byteLength: ByteLength): string {
    hex = hex.toLowerCase().startsWith('0x') ? hex.slice(2) : hex;
    return `0x${hex.padStart(byteLength, '0')}`;
  }
  
  // Serializer helper to handle BigInt values in objects
  static bigIntSerializer(key: string, value: any): any {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }
}