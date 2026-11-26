/**
 * Cod QR minim, generat local, pentru linkuri scurte.
 *
 * Versiunea 4, corecție L, un singur bloc de date: 80 de cuvinte de date și
 * 20 de corecție. Este suficient pentru un link de forma
 * `https://syncsonic.example/calibrate?c=ABCD1234` și nu trimite nimic
 * către un serviciu extern.
 */
const SIZE = 33;
const DATA_CODEWORDS = 80;
const EC_CODEWORDS = 20;
const MAX_BYTES = 78;

const EXP = new Array(512);
const LOG = new Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

const multiply = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generatorPoly(count) {
  let poly = [1];
  for (let i = 0; i < count; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= multiply(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function remainder(data, count) {
  const generator = generatorPoly(count);
  const result = new Array(count).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    if (factor !== 0) {
      for (let i = 0; i < count; i += 1) result[i] ^= multiply(generator[i + 1], factor);
    }
  });
  return result;
}

function formatBits(mask) {
  const data = (1 << 3) | mask; // nivel L = 01
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return (((data << 10) | (rem & 0x3ff)) ^ 0x5412) & 0x7fff;
}

function dataCodewords(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > MAX_BYTES) throw new Error('Linkul este prea lung pentru codul QR local.');
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  bytes.forEach((byte) => push(byte, 8));
  const capacity = DATA_CODEWORDS * 8;
  const terminator = Math.min(4, capacity - bits.length);
  for (let i = 0; i < terminator; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
    codewords.push(value);
  }
  const pads = [0xec, 0x11];
  let index = 0;
  while (codewords.length < DATA_CODEWORDS) {
    codewords.push(pads[index % 2]);
    index += 1;
  }
  return codewords;
}

function drawFunctionPatterns(modules, isFunction) {
  const set = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, distance !== 2 && distance !== 4);
      }
    }
  };
  finder(3, 3);
  finder(SIZE - 4, 3);
  finder(3, SIZE - 4);

  for (let i = 8; i < SIZE - 8; i += 1) {
    set(i, 6, i % 2 === 0);
    set(6, i, i % 2 === 0);
  }

  // Versiunea 4 are un singur model de aliniere, în afara colțurilor.
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      set(26 + dx, 26 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  set(8, SIZE - 8, true); // modulul întunecat obligatoriu

  // Rezervă zonele informației de format, ca datele să nu le acopere.
  for (let i = 0; i <= 5; i += 1) set(8, i, false);
  set(8, 7, false);
  set(8, 8, false);
  set(7, 8, false);
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, false);
  for (let i = 0; i < 8; i += 1) set(SIZE - 1 - i, 8, false);
  for (let i = 8; i < 15; i += 1) set(8, SIZE - 15 + i, false);
}

function placeData(modules, isFunction, codewords) {
  let bit = 0;
  const total = codewords.length * 8;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? SIZE - 1 - vertical : vertical;
        if (!isFunction[y][x] && bit < total) {
          modules[y][x] = ((codewords[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
          bit += 1;
        }
      }
    }
  }
}

function applyMask(modules, isFunction) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!isFunction[y][x] && (x + y) % 2 === 0) modules[y][x] = !modules[y][x];
    }
  }
}

function placeFormat(modules, bits) {
  const bit = (index) => ((bits >>> index) & 1) === 1;
  for (let i = 0; i <= 5; i += 1) modules[i][8] = bit(i);
  modules[7][8] = bit(6);
  modules[8][8] = bit(7);
  modules[8][7] = bit(8);
  for (let i = 9; i < 15; i += 1) modules[8][14 - i] = bit(i);

  for (let i = 0; i < 8; i += 1) modules[8][SIZE - 1 - i] = bit(i);
  for (let i = 8; i < 15; i += 1) modules[SIZE - 15 + i][8] = bit(i);
  modules[SIZE - 8][8] = true;
}

export function qrMatrix(text) {
  const codewords = dataCodewords(text);
  const all = [...codewords, ...remainder(codewords, EC_CODEWORDS)];
  const modules = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  const isFunction = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  drawFunctionPatterns(modules, isFunction);
  placeData(modules, isFunction, all);
  applyMask(modules, isFunction);
  placeFormat(modules, formatBits(0));
  return modules;
}

export const QR_MAX_BYTES = MAX_BYTES;
