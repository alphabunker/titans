const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const CHARACTER_VALUES = new Map([...CHARSET].map((character, index) => [character, index]));

export class CardanoAddressError extends TypeError {
  constructor(code, message) {
    super(message);
    this.name = 'CardanoAddressError';
    this.code = code;
  }
}

function polymod(values) {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let index = 0; index < generators.length; index += 1) {
      if ((top >>> index) & 1) checksum ^= generators[index];
    }
  }
  return checksum >>> 0;
}

function expandHrp(hrp) {
  return [...hrp].map(character => character.charCodeAt(0) >>> 5)
    .concat(0, [...hrp].map(character => character.charCodeAt(0) & 31));
}

function convertBits(values, fromBits, toBits, pad) {
  let accumulator = 0;
  let bitCount = 0;
  const result = [];
  const maxValue = (1 << toBits) - 1;
  for (const value of values) {
    if (value < 0 || value >>> fromBits !== 0) throw new CardanoAddressError('invalid_address', 'Address contains invalid Bech32 data');
    accumulator = (accumulator << fromBits) | value;
    bitCount += fromBits;
    while (bitCount >= toBits) {
      bitCount -= toBits;
      result.push((accumulator >>> bitCount) & maxValue);
    }
  }
  if (pad && bitCount > 0) result.push((accumulator << (toBits - bitCount)) & maxValue);
  if (!pad && (bitCount >= fromBits || ((accumulator << (toBits - bitCount)) & maxValue))) {
    throw new CardanoAddressError('invalid_address', 'Address has invalid Bech32 padding');
  }
  return result;
}

export function decodeBech32(value) {
  if (typeof value !== 'string') throw new CardanoAddressError('invalid_address', 'Address must be a string');
  const address = value.trim();
  if (address.length < 8 || address.length > 200 || (address !== address.toLowerCase() && address !== address.toUpperCase())) {
    throw new CardanoAddressError('invalid_address', 'Address is not valid Bech32');
  }
  const normalized = address.toLowerCase();
  const separator = normalized.lastIndexOf('1');
  if (separator < 1 || separator + 7 > normalized.length) throw new CardanoAddressError('invalid_address', 'Address is not valid Bech32');
  const hrp = normalized.slice(0, separator);
  const values = [...normalized.slice(separator + 1)].map(character => CHARACTER_VALUES.get(character));
  if (values.some(value => value === undefined) || polymod([...expandHrp(hrp), ...values]) !== 1) {
    throw new CardanoAddressError('invalid_address', 'Address checksum is invalid');
  }
  return { normalized, hrp, bytes: Uint8Array.from(convertBits(values.slice(0, -6), 5, 8, false)) };
}

export function parseCardanoAddress(value, { network = 'mainnet' } = {}) {
  if (network !== 'mainnet') throw new TypeError('Only the mainnet address boundary is supported');
  const decoded = decodeBech32(value);
  const kind = decoded.hrp === 'addr' || decoded.hrp === 'addr_test'
    ? 'payment'
    : decoded.hrp === 'stake' || decoded.hrp === 'stake_test' ? 'stake' : null;
  if (!kind || decoded.bytes.length === 0) throw new CardanoAddressError('invalid_address', 'Enter a Cardano payment or stake address');

  const addressType = decoded.bytes[0] >>> 4;
  const networkId = decoded.bytes[0] & 15;
  const typeMatches = kind === 'stake' ? addressType === 14 || addressType === 15 : addressType >= 0 && addressType <= 7;
  if (!typeMatches) throw new CardanoAddressError('invalid_address', 'Address type does not match its Bech32 prefix');
  if (networkId !== 1 || decoded.hrp.endsWith('_test')) {
    throw new CardanoAddressError('wrong_network', 'Only Cardano mainnet addresses are supported');
  }
  return Object.freeze({ address: decoded.normalized, kind, network: 'mainnet' });
}
