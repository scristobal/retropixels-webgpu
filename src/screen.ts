/**
 *
 * Resize canvas and contents correctly
 *
 */

export function screenManager(scale: number, maxTextureDimension: number, canvasElement: HTMLCanvasElement) {
    const canvasResolution = new Float32Array([canvasElement.width, canvasElement.height]);
    const quadResolution = new Float32Array([canvasResolution[0] / scale, canvasResolution[1] / scale]);

    let resizeFlag = false;

    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const contentBoxSize = entry.contentBoxSize[0];

            if (!contentBoxSize) continue;

            resizeFlag = true;

            canvasResolution[0] = Math.max(1, Math.min(contentBoxSize.inlineSize, maxTextureDimension));
            canvasResolution[1] = Math.max(1, Math.min(contentBoxSize.blockSize, maxTextureDimension));
        }
    });

    observer.observe(canvasElement);

    return {
        scale,
        canvasResolution,
        quadResolution,

        _rescaleQuad() {
            this.quadResolution = new Float32Array([this.canvasResolution[0] / scale, this.canvasResolution[1] / scale]);
        },

        get needsResize() {
            if (!resizeFlag) return false;

            this._rescaleQuad();

            canvasElement.width = this.canvasResolution[0];
            canvasElement.height = this.canvasResolution[1];

            resizeFlag = false;

            return true;
        }
    };
}
