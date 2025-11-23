import { expect, test } from 'vitest';
import { m4 } from './m4';

test('identity does nothing', () => {
    const x = new Float32Array([1, 1, 0, 1]);
    const tx = m4().identity.apply(x);

    expect(tx).toEqual(x);
});

test('translate moves point by offset', () => {
    const point = new Float32Array([1, 2, 3, 1]);
    const translation = new Float32Array([5, 10, 15]);
    const result = m4().identity.translate(translation).apply(point);

    expect(result).toEqual(new Float32Array([6, 12, 18, 1]));
});
