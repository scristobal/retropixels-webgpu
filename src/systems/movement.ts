import { m4 } from 'src/helpers/matrix';

type Coords = {
    x: number;
    y: number;
    z: number;
};

type State = {
    center: Coords;
    speed: Coords;
    rotationAxis: Coords;
    angle: number;
    rotationSpeed: number;
};

function movement(state: State) {
    const c = {
        ...state,
        _transform: m4(),

        moveRight(dt: number) {
            this.center.x += this.speed.x * dt;
            this._updateTransform();
        },
        moveLeft(dt: number) {
            this.center.x -= this.speed.x * dt;
            this._updateTransform();
        },
        moveUp(dt: number) {
            this.center.y += this.speed.y * dt;
            this._updateTransform();
        },
        moveDown(dt: number) {
            this.center.y -= this.speed.y * dt;
            this._updateTransform();
        },
        rotateClockWise(dt: number) {
            this.angle += this.rotationSpeed * dt;
            this._updateTransform();
        },
        rotateCounterClockWise(dt: number) {
            this.angle -= this.rotationSpeed * dt;
            this._updateTransform();
        },

        _updateTransform() {
            this._transform.identity.translate(this.center.x, this.center.y, this.center.z).rotate(this.rotationAxis.x, this.rotationAxis.y, this.rotationAxis.z, this.angle);
        },

        get transform(): Float32Array<ArrayBuffer> {
            return this._transform.data;
        }
    };

    c._updateTransform();

    return c;
}

export { movement };
