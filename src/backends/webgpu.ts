import animationData from 'src/data/animation.json';
import { canvasManager } from 'src/helpers/canvas';
import { m4 } from 'src/helpers/m4';
import { timeTrack } from 'src/helpers/time';
import shaderCode from 'src/shaders/sprite.wgsl?raw';
import { inputHandler } from 'src/systems/input';
import { createMovement } from 'src/systems/movement';
import { spriteSheet } from 'src/systems/sprites';

async function renderer(canvasElement: HTMLCanvasElement) {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw 'Unable to request adapter';

    const device = await adapter.requestDevice();
    if (!device) throw 'Unable to request device ';

    const ctx = canvasElement.getContext('webgpu');
    if (!ctx) throw 'Unable to get WebGPU canvas context';

    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ format, device });

    const movement = createMovement({
        center: [0, 0, 0],
        speed: [0.02, 0.02, 0],
        axis: [0, 0, 1],
        angle: 0,
        rotation: 0.01
    });
    const sprite = await spriteSheet(animationData);
    const timeTracker = timeTrack();
    const screen = canvasManager(device.limits.maxTextureDimension2D, canvasElement);

    let modelTransformMatrix: Float32Array<ArrayBuffer>;
    let textureTransformMatrix: Float32Array<ArrayBuffer>;

    // vertices data - position and texture coordinates
    //
    //  3--0
    //  |  |
    //  2--1
    //                                     x  y  z  u  v
    //                                    |------0------|-------1-------|-------2--------|-------3-------|
    const verticesData = new Float32Array([1, 1, 0, 1, 0, 1, -1, 0, 1, 1, -1, -1, 0, 0, 1, -1, 1, 0, 0, 0]);

    const verticesBuffer: GPUBuffer = device.createBuffer({
        label: 'vertices',
        size: verticesData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(verticesBuffer, 0, verticesData);

    const verticesBufferLayout: GPUVertexBufferLayout = {
        arrayStride: 3 * 4 + 2 * 4, // f32 is 32 bits = 4 bytes
        stepMode: 'vertex', // opt.
        attributes: [
            {
                shaderLocation: 0,
                format: 'float32x3',
                offset: 0
            },
            {
                shaderLocation: 1,
                format: 'float32x2',
                offset: 3 * 4
            }
        ]
    };

    // vertices data - indexing
    //
    //  3 - - - 0
    //  | A   / |
    //  |   /   |
    //  | /   B |
    //  2 - - - 1
    //                                  |---A---|----B---|
    const indicesData = new Uint32Array([3, 2, 0, 2, 1, 0]);

    const indicesBuffer: GPUBuffer = device.createBuffer({
        label: 'indices',
        size: indicesData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(indicesBuffer, 0, indicesData);

    const indexFormat: GPUIndexFormat = 'uint32';

    const texture = device.createTexture({
        label: sprite.url,
        format: format,
        size: [sprite.sheetSize.width, sprite.sheetSize.height],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
    });

    device.queue.copyExternalImageToTexture({ source: sprite.bitmap }, { texture }, { width: sprite.sheetSize.width, height: sprite.sheetSize.height });

    let depthTexture = device.createTexture({
        label: 'depth',
        size: screen.resolution,
        format: 'depth32float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });

    const modelTransformBuffer = device.createBuffer({
        label: 'model transform',
        size: 4 * 4 * 4, // mat4x4<f32>
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const textureTransformBuffer = device.createBuffer({
        label: 'texture transform',
        size: 4 * 4 * 4, // mat4x4<f32>
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const vertexBindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' }
            }
        ]
    });

    const vertexBindGroup = device.createBindGroup({
        layout: vertexBindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: { buffer: modelTransformBuffer }
            },
            {
                binding: 1,
                resource: { buffer: textureTransformBuffer }
            }
        ]
    });

    const fragmentBindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: { type: 'filtering' }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: 'float' }
            }
        ]
    });

    const fragmentBindGroup = device.createBindGroup({
        layout: fragmentBindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: device.createSampler()
            },
            {
                binding: 1,
                resource: texture.createView()
            }
        ]
    });

    const shaderModule: GPUShaderModule = device.createShaderModule({
        code: shaderCode
    });

    const pipelineLayout: GPUPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [vertexBindGroupLayout, fragmentBindGroupLayout] });

    const pipeline: GPURenderPipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            buffers: [verticesBufferLayout]
        },
        fragment: {
            module: shaderModule,
            targets: [
                {
                    format: format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        }
                    },
                    writeMask: GPUColorWrite.ALL
                }
            ]
        },
        depthStencil: {
            format: depthTexture.format,
            depthCompare: 'less-equal',
            depthWriteEnabled: true
        }
    });

    function update() {
        const delta = timeTracker();

        // movement system affects the position of the model
        if (inputHandler.right) movement.moveRight(delta);
        if (inputHandler.left) movement.moveLeft(delta);
        if (inputHandler.up) movement.moveUp(delta);
        if (inputHandler.down) movement.moveDown(delta);
        if (inputHandler.turnRight) movement.rotateClockWise(delta);
        if (inputHandler.turnLeft) movement.rotateCounterClockWise(delta);

        // sprite system affects the animation
        sprite.update(delta);

        const rx = (10 * sprite.spriteSize[0]) / screen.resolution[0];
        const ry = (10 * sprite.spriteSize[1]) / screen.resolution[1];

        const scale = new Float32Array([rx, ry, 1]);

        modelTransformMatrix = m4().identity.scale(scale).translate(movement.center).rotate(movement.axis, movement.angle).data;
        textureTransformMatrix = sprite.transform;
    }

    function render() {
        if (!ctx) throw 'Canvas context lost';

        if (screen.needsResize) {
            depthTexture = device.createTexture({
                size: screen.resolution,
                format: depthTexture.format,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
            });
        }

        device.queue.writeBuffer(modelTransformBuffer, 0, modelTransformMatrix);
        device.queue.writeBuffer(textureTransformBuffer, 0, textureTransformMatrix);

        const encoder = device.createCommandEncoder();

        const currentTexture = ctx.getCurrentTexture();
        const canvasView = currentTexture.createView();
        const depthView = depthTexture.createView();

        const renderPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: canvasView,
                    loadOp: 'clear',
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    storeOp: 'store'
                }
            ],
            depthStencilAttachment: {
                view: depthView,
                depthLoadOp: 'clear',
                depthClearValue: 1.0,
                depthStoreOp: 'store'
            }
        });

        renderPass.setPipeline(pipeline);

        renderPass.setVertexBuffer(0, verticesBuffer);
        renderPass.setIndexBuffer(indicesBuffer, indexFormat);

        renderPass.setBindGroup(0, vertexBindGroup);
        renderPass.setBindGroup(1, fragmentBindGroup);

        renderPass.drawIndexed(indicesData.length);

        renderPass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    }

    return function gameLoop(now: number) {
        update();
        render();

        requestAnimationFrame(gameLoop);
    };
}

export { renderer };
