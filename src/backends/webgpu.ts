import animationData from 'src/data/animation.json';
import { canvasManager } from 'src/helpers/canvas';
import { loadImageBitmap } from 'src/helpers/image';
import shaderCode from 'src/shaders/shaders.wgsl?raw';
import { inputHandler } from 'src/systems/input';
import { movement } from 'src/systems/movement';
import { spriteSheet } from 'src/systems/sprites';

async function renderer(canvasElement: HTMLCanvasElement) {
    // init - context
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw 'Unable to request adapter';

    const device = await adapter.requestDevice();
    if (!device) throw 'Unable to request device ';

    const ctx = canvasElement.getContext('webgpu');
    if (!ctx) throw 'Unable to get WebGPU canvas context';

    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ format, device });

    // init - movement system
    const movementSystem = movement({
        center: { x: 0, y: 0, z: 0 },
        speed: { x: 0.02, y: 0.02, z: 0 },
        rotationAxis: { x: 0, y: 0, z: 1 },
        angle: 0,
        rotationSpeed: 0.01
    });

    // init - sprites
    const spriteSystem = await spriteSheet(animationData);

    // init - screen manager
    const screen = canvasManager(device.limits.maxTextureDimension2D, canvasElement);

    // vertices data - position and texture coordinates
    //
    //  3--0
    //  |  |
    //  2--1
    //                                     x  y  z  u  v
    //                                    |------0------|-------1-------|-------2--------|-------3-------|
    const verticesData = new Float32Array([1, 1, 0, 1, 0, 1, -1, 0, 1, 1, -1, -1, 0, 0, 1, -1, 1, 0, 0, 0]);
    // const verticesData = new Float32Array([1, 1, 1, 1, 1, 1, -1, 1, 1, 0, -1, -1, 1, 0, 0, -1, 1, 1, 1, 0]);

    const verticesBuffer: GPUBuffer = device.createBuffer({
        label: 'vertices',
        size: verticesData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(verticesBuffer, 0, verticesData);

    const verticesBufferLayout: GPUVertexBufferLayout = {
        arrayStride: 3 * 4 + 2 * 4, // f32 is 32 bits = 4 bytes
        stepMode: 'vertex', // optional
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

    // texture - sprites
    const texture = device.createTexture({
        label: spriteSystem.url,
        format: format,
        size: [spriteSystem.sheetSize.width, spriteSystem.sheetSize.height],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
    });

    device.queue.copyExternalImageToTexture({ source: spriteSystem.bitmap }, { texture }, { width: spriteSystem.sheetSize.width, height: spriteSystem.sheetSize.height });

    // texture - depth
    let depthTexture = device.createTexture({
        label: 'depth',
        size: screen.resolution,
        format: 'depth32float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });

    // uniforms - resolution
    const resolutionBuffer: GPUBuffer = device.createBuffer({
        label: 'resolution',
        size: screen.resolution.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(resolutionBuffer, 0, screen.resolution);

    // uniforms - scaling
    const scale = new Float32Array([10]);
    const scalingBuffer: GPUBuffer = device.createBuffer({
        label: 'scale',
        size: scale.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(scalingBuffer, 0, scale);

    // uniforms - model size
    const modelSize = new Float32Array(spriteSystem.spriteSize);
    const modelSizeBuffer: GPUBuffer = device.createBuffer({
        label: 'model size',
        size: modelSize.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(modelSizeBuffer, 0, modelSize);

    // uniforms - model transformation matrix
    const modelTransformData = movementSystem.transform;
    const modelTransformBuffer = device.createBuffer({
        label: 'model transform',
        size: modelTransformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(modelTransformBuffer, 0, modelTransformData);

    // uniforms - texture transformation matrix
    const textureTransformData = spriteSystem.transform;
    const textureTransformBuffer = device.createBuffer({
        label: 'texture transform',
        size: textureTransformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(textureTransformBuffer, 0, textureTransformData);

    // bindings - vertex
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
            },
            {
                binding: 2,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' }
            },
            {
                binding: 4,
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
                resource: { buffer: resolutionBuffer }
            },
            {
                binding: 1,
                resource: { buffer: scalingBuffer }
            },
            {
                binding: 2,
                resource: { buffer: modelSizeBuffer }
            },
            {
                binding: 3,
                resource: { buffer: modelTransformBuffer }
            },
            {
                binding: 4,
                resource: { buffer: textureTransformBuffer }
            }
        ]
    });

    // bindings - fragment
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

    // shaders
    const shaderModule: GPUShaderModule = device.createShaderModule({
        code: shaderCode
    });

    // pipeline
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

    let lastUpdate = performance.now();
    const frameTimes = new Float32Array(1024);
    let frameTimesInd = 0;

    function update(now: number) {
        const delta = now - lastUpdate;

        // movement system affects the position of the model
        if (inputHandler.right) movementSystem.moveRight(delta);
        if (inputHandler.left) movementSystem.moveLeft(delta);
        if (inputHandler.up) movementSystem.moveUp(delta);
        if (inputHandler.down) movementSystem.moveDown(delta);
        if (inputHandler.turnRight) movementSystem.rotateClockWise(delta);
        if (inputHandler.turnLeft) movementSystem.rotateCounterClockWise(delta);

        // sprite system affects the animation
        spriteSystem.update(delta);

        // performance report
        frameTimes[++frameTimesInd] = performance.now() - now;

        if (frameTimesInd === frameTimes.length) {
            const average = frameTimes.reduce((acc, cur) => acc + cur, 0) / frameTimes.length;
            console.log(`${average.toFixed(3)}ms ~${(1000 / average).toFixed(3)}fps`);
            frameTimesInd = 0;
        }

        lastUpdate = performance.now();
    }

    function render() {
        if (!ctx) throw 'Canvas context lost';

        if (screen.needsResize) {
            depthTexture = device.createTexture({
                size: screen.resolution,
                format: depthTexture.format,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
            });

            device.queue.writeBuffer(resolutionBuffer, 0, screen.resolution);
        }

        device.queue.writeBuffer(modelTransformBuffer, 0, modelTransformData);
        device.queue.writeBuffer(textureTransformBuffer, 0, textureTransformData);

        const encoder = device.createCommandEncoder();

        const canvasView = ctx.getCurrentTexture().createView();
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
        update(now);
        render();

        requestAnimationFrame(gameLoop);
    };
}

export { renderer };
