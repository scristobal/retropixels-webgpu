/**
 *
 * Resize canvas and contents correctly
 *
 */

function canvasManager(maxTextureDimension: number, canvasElement: HTMLCanvasElement) {
    const resolution = new Float32Array([canvasElement.width, canvasElement.height]);

    let resizeFlag = false;

    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const contentBoxSize = entry.contentBoxSize[0];

            if (!contentBoxSize) continue;

            resizeFlag = true;

            resolution[0] = Math.max(1, Math.min(contentBoxSize.inlineSize, maxTextureDimension));
            resolution[1] = Math.max(1, Math.min(contentBoxSize.blockSize, maxTextureDimension));
        }
    });

    observer.observe(canvasElement);

    return {
        resolution,

        get needsResize() {
            if (!resizeFlag) return false;

            canvasElement.width = this.resolution[0];
            canvasElement.height = this.resolution[1];

            resizeFlag = false;

            return true;
        }
    };
}

export { canvasManager };
