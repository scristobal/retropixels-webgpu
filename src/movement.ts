type State = {
    center: number[];
    speed: number[];
    axis: number[];
    angle: number;
    rotation: number;
};

export function createMovement(state: State) {
    return {
        center: new Float32Array(state.center),
        speed: new Float32Array(state.speed),
        axis: new Float32Array(state.axis),
        angle: state.angle,
        rotation: state.rotation,
        moveRight(dt: number) {
            this.center[0] += this.speed[0] * dt;
        },
        moveLeft(dt: number) {
            this.center[0] -= this.speed[0] * dt;
        },
        moveUp(dt: number) {
            this.center[1] += this.speed[1] * dt;
        },
        moveDown(dt: number) {
            this.center[1] -= this.speed[1] * dt;
        },
        rotateClockWise(dt: number) {
            this.angle += this.rotation * dt;
        },
        rotateCounterClockWise(dt: number) {
            this.angle -= this.rotation * dt;
        }
    };
}
