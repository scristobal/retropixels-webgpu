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

function movement(initial: State) {
    return {
        ...initial,
        _transform: m4().identity,

        moveRight(dt: number) {
            this.center.x += this.speed.x * dt;
            this._update();
        },
        moveLeft(dt: number) {
            this.center.x -= this.speed.x * dt;
            this._update();
        },
        moveUp(dt: number) {
            this.center.y += this.speed.y * dt;
            this._update();
        },
        moveDown(dt: number) {
            this.center.y -= this.speed.y * dt;
            this._update();
        },
        rotateClockWise(dt: number) {
            this.angle += this.rotationSpeed * dt;
            this._update();
        },
        rotateCounterClockWise(dt: number) {
            this.angle -= this.rotationSpeed * dt;
            this._update();
        },

        _update() {
            this._transform.identity.translate(this.center.x, this.center.y, this.center.z).rotate(this.rotationAxis.x, this.rotationAxis.y, this.rotationAxis.z, this.angle);
        },

        get transform(): Float32Array<ArrayBuffer> {
            return this._transform.data;
        }
    };
}

export { movement };
