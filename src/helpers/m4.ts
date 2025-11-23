//
// zero alocation chain matrix operations
//
// usage:
//  m4().identity.scale(s).translate(v).rotate(r,a).data;
//
//
//

export function m4() {
    return {
        data: new Float32Array(16),
        op: new Float32Array(16),
        get identity() {
            // biome-ignore format: custom matrix alignment
            this.data.set([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
            return this;
        },
        perspective(yFov: number, aspect: number, zNear: number, zFar: number) {
            const f = Math.tan(0.5 * (Math.PI - Math.PI*yFov/180));
            const rInv = 1 / (zNear - zFar);

            // biome-ignore format: custom matrix alignment
            this.data = new Float32Array([
                f / aspect, 0,                   0,  0,
                         0, f,                   0,  0,
                         0, 0,         zFar * rInv, -1,
                         0, 0, zNear * zFar * rInv,  0
            ]);

            return this;
        },
        new(data: Float32Array) {
            this.data.set(data);
            return this;
        },
        __apply() {
            // biome-ignore format: custom matrix alignment
            this.data.set([
                this.data[0] * this.op[0] + this.data[4] * this.op[1] + this.data[8] * this.op[2] + this.data[12] * this.op[3],
                this.data[1] * this.op[0] + this.data[5] * this.op[1] + this.data[9] * this.op[2] + this.data[13] * this.op[3],
                this.data[2] * this.op[0] + this.data[6] * this.op[1] + this.data[10] * this.op[2] + this.data[14] * this.op[3],
                this.data[3] * this.op[0] + this.data[7] * this.op[1] + this.data[11] * this.op[2] + this.data[15] * this.op[3],

                this.data[0] * this.op[4] + this.data[4] * this.op[5] + this.data[8] * this.op[6] + this.data[12] * this.op[7],
                this.data[1] * this.op[4] + this.data[5] * this.op[5] + this.data[9] * this.op[6] + this.data[13] * this.op[7],
                this.data[2] * this.op[4] + this.data[6] * this.op[5] + this.data[10] * this.op[6] + this.data[14] * this.op[7],
                this.data[3] * this.op[4] + this.data[7] * this.op[5] + this.data[11] * this.op[6] + this.data[15] * this.op[7],

                this.data[0] * this.op[8] + this.data[4] * this.op[9] + this.data[8] * this.op[10] + this.data[12] * this.op[11],
                this.data[1] * this.op[8] + this.data[5] * this.op[9] + this.data[9] * this.op[10] + this.data[13] * this.op[11],
                this.data[2] * this.op[8] + this.data[6] * this.op[9] + this.data[10] * this.op[10] + this.data[14] * this.op[11],
                this.data[3] * this.op[8] + this.data[7] * this.op[9] + this.data[11] * this.op[10] + this.data[15] * this.op[11],

                this.data[0] * this.op[12] + this.data[4] * this.op[13] + this.data[8] * this.op[14] + this.data[12] * this.op[15],
                this.data[1] * this.op[12] + this.data[5] * this.op[13] + this.data[9] * this.op[14] + this.data[13] * this.op[15],
                this.data[2] * this.op[12] + this.data[6] * this.op[13] + this.data[10] * this.op[14] + this.data[14] * this.op[15],
                this.data[3] * this.op[12] + this.data[7] * this.op[13] + this.data[11] * this.op[14] + this.data[15] * this.op[15]
            ]);
            return this;
        },
        rotate(u: Float32Array, rd: number) {
            const c = Math.cos(rd);
            const s = Math.sin(rd);
            // biome-ignore format: custom matrix alignment
            this.op.set([
                u[0] * u[0] * (1 - c) + c,        u[0] * u[1] * (1 - c) + u[2] * s, u[0] * u[2] * (1 - c) - u[1] * s, 0,
                u[0] * u[1] * (1 - c) - u[2] * s,        u[1] * u[1] * (1 - c) + c, u[1] * u[2] * (1 - c) + u[0] * s, 0,
                u[0] * u[2] * (1 - c) + u[1] * s, u[1] * u[2] * (1 - c) - u[0] * s,        u[2] * u[2] * (1 - c) + c, 0,
                                               0,                                0,                                0, 1
            ]);
            return this.__apply();
        },
        scale(s: Float32Array) {
            // biome-ignore format: custom matrix alignment
            this.op.set([
                s[0],    0,    0, 0,
                   0, s[1],    0, 0,
                   0,    0, s[2], 0,
                   0,    0,    0, 1
            ]);
            return this.__apply();
        },
        translate(t: Float32Array) {
            // biome-ignore format: custom matrix alignment
            this.op.set([
                   1,      0,      0, 0,
                   0,      1,      0, 0,
                   0,      0,      1, 0,
                t[0],   t[1],   t[2], 1
            ]);
            return this.__apply();
        },
        multiply(rhs: Float32Array) {
            this.op.set(rhs);
            return this.__apply();
        },
        apply(vec: Float32Array) {
            // biome-ignore format: custom matrix alignment
            return new Float32Array([
                vec[0] * this.data[0] + vec[1] * this.data[4] + vec[2] * this.data[ 8] + vec[3] * this.data[12],
                vec[0] * this.data[1] + vec[1] * this.data[5] + vec[2] * this.data[ 9] + vec[3] * this.data[13],
                vec[0] * this.data[2] + vec[1] * this.data[6] + vec[2] * this.data[10] + vec[3] * this.data[14],
                vec[0] * this.data[3] + vec[1] * this.data[7] + vec[2] * this.data[11] + vec[3] * this.data[15],
            ]);
        }
    };
}
