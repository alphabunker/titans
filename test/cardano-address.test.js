import test from 'node:test';
import assert from 'node:assert/strict';
import { CardanoAddressError, cardanoAddressFromHex, decodeBech32, encodeCardanoAddress, parseCardanoAddress } from '../src/cardano-address.js';

const paymentAddress = 'addr1qy2jt0qpqz2z2z9zx5w4xemekkce7yderz53kjue53lpqv90lkfa9sgrfjuz6uvt4uqtrqhl2kj0a9lnr9ndzutx32gqleeckv';
const stakeAddress = 'stake1uyrx65wjqjgeeksd8hptmcgl5jfyrqkfq0xe8xlp367kphsckq250';

test('Cardano address parser accepts checksummed mainnet payment and stake addresses', () => {
  assert.deepEqual(parseCardanoAddress(paymentAddress), { address: paymentAddress, kind: 'payment', network: 'mainnet' });
  assert.deepEqual(parseCardanoAddress(stakeAddress), { address: stakeAddress, kind: 'stake', network: 'mainnet' });
});

test('Cardano address parser distinguishes malformed and wrong-network addresses', () => {
  assert.throws(() => parseCardanoAddress(`${paymentAddress.slice(0, -1)}x`), error => error instanceof CardanoAddressError && error.code === 'invalid_address');
  assert.throws(() => parseCardanoAddress('addr_test1qq2jt0qpqz2z2z9zx5w4xemekkce7yderz53kjue53lpqv90lkfa9sgrfjuz6uvt4uqtrqhl2kj0a9lnr9ndzutx32gqu0yc6n'), error => error instanceof CardanoAddressError && error.code === 'wrong_network');
});

test('Cardano address encoder converts CIP-30 bytes and hex back to mainnet Bech32', () => {
  for (const address of [paymentAddress, stakeAddress]) {
    const { bytes } = decodeBech32(address);
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    assert.equal(encodeCardanoAddress(bytes), address);
    assert.equal(cardanoAddressFromHex(hex), address);
  }
  assert.throws(() => cardanoAddressFromHex('not-hex'), error => error.code === 'invalid_address');
});
