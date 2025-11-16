import animationData from 'src/data/animation.json';
import { loadImageBitmap } from 'src/helpers/image';
import { resizeHandler } from 'src/helpers/resize';
import shaderCode from 'src/shaders/shaders.wgsl?raw';
import { inputHandler } from 'src/systems/input';
import { movement } from 'src/systems/movement';
import { spriteSheet } from 'src/systems/sprites';

async function renderer(canvasElement: HTMLCanvasElement) {
    /**
     *
     * WebGPU setup
     *
     */

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw 'Unable to request adapter';

    const device = await adapter.requestDevice();
    if (!device) throw 'Unable to request device ';

    const ctx = canvasElement.getContext('webgpu');
    if (!ctx) throw 'Unable to get WebGPU canvas context';

    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ format, device });

    //  3--0
    //  |  |
    //  2--1
    //                                           0              1               2                3
    //                                     x  y  z  u  v
    //                                    |       :     |         :     |          :     |         :     |
    // const verticesData = new Float32Array([1, 1, 1, 1, 1, 1, -1, 1, 1, 0, -1, -1, 1, 0, 0, -1, 1, 1, 1, 0]);
    const verticesData = new Float32Array([1, 1, 0, 1, 0, 1, -1, 0, 1, 1, -1, -1, 0, 0, 1, -1, 1, 0, 0, 0]);

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

    // vertices data indexing

    // 3 - - - 0
    // | A   / |
    // |   /   |
    // | /   B |
    // 2 - - - 1
    //                                      A        B
    //                                  |       |        |
    const indicesData = new Uint32Array([3, 2, 0, 2, 1, 0]);

    const indicesBuffer: GPUBuffer = device.createBuffer({
        label: 'indices',
        size: indicesData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(indicesBuffer, 0, indicesData);

    const indexFormat: GPUIndexFormat = 'uint32';

    // textures

    const url = '/sprite-sheet.png';
    const source = await loadImageBitmap(url);

    const texture = device.createTexture({
        label: url,
        format: format,
        size: [source.width, source.height],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
    });

    device.queue.copyExternalImageToTexture({ source }, { texture }, { width: source.width, height: source.height });

    const resize = resizeHandler(device.limits.maxTextureDimension2D, canvasElement);
    // depth texture

    let depthTexture = device.createTexture({
        label: 'depth',
        size: resize.resolution,
        format: 'depth32float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });

    // uniforms - resolution
    const resolutionBuffer: GPUBuffer = device.createBuffer({
        label: 'resolution',
        size: resize.resolution.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(resolutionBuffer, 0, resize.resolution);

    // uniforms - scaling
    const scale = new Float32Array([10]);
    const scalingBuffer: GPUBuffer = device.createBuffer({
        label: 'scale',
        size: scale.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(scalingBuffer, 0, scale);

    const spriteSystem = spriteSheet(animationData);

    // uniforms - model size
    const modelSize = new Float32Array(spriteSystem.size);
    const modelSizeBuffer: GPUBuffer = device.createBuffer({
        label: 'model size',
        size: modelSize.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(modelSizeBuffer, 0, modelSize);

    const movementSystem = movement({
        center: { x: 0, y: 0, z: 0 },
        speed: { x: 0.02, y: 0.02, z: 0 },
        angle: 0,
        rotationSpeed: 0.01
    });

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

    // bindings

    const bindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout({
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
            },
            {
                binding: 5,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: { type: 'filtering' }
            },
            {
                binding: 6,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: 'float' }
            }
        ]
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
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
            },
            {
                binding: 5,
                resource: device.createSampler()
            },
            {
                binding: 6,
                resource: texture.createView()
            }
        ]
    });

    // shaders
    const shaderModule: GPUShaderModule = device.createShaderModule({
        code: shaderCode
    });

    // pipeline

    const pipelineLayout: GPUPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

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

    /**
     *
     * Update loop
     *
     */

    let lastUpdate = performance.now();

    function update(now: number) {
        const delta = now - lastUpdate;

        if (inputHandler.right) movementSystem.moveRight(delta);
        if (inputHandler.left) movementSystem.moveLeft(delta);
        if (inputHandler.up) movementSystem.moveUp(delta);
        if (inputHandler.down) movementSystem.moveDown(delta);
        if (inputHandler.turnRight) movementSystem.rotateClockWise(delta);
        if (inputHandler.turnLeft) movementSystem.rotateCounterClockWise(delta);

        spriteSystem.update(delta);
    }

    /**
     *
     * Render loop
     *
     */
    function render() {
        if (!ctx) throw 'Canvas context lost';

        if (resize.needsResize) {
            depthTexture = device.createTexture({
                size: resize.resolution,
                format: depthTexture.format,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
            });

            device.queue.writeBuffer(resolutionBuffer, 0, resize.resolution);
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

        renderPass.setBindGroup(0, bindGroup);

        renderPass.drawIndexed(indicesData.length);

        renderPass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    }

    const frameTimes = new Float32Array(1024);
    let frameTimesInd = 0;

    /**
     *
     * Main loop (main function return as Promise)
     *
     */
    function gameLoop(now: number) {
        update(now);
        render();

        requestAnimationFrame(gameLoop);

        frameTimes[++frameTimesInd] = performance.now() - now;

        if (frameTimesInd === frameTimes.length) {
            const average = frameTimes.reduce((acc, cur) => acc + cur, 0) / frameTimes.length;
            console.log(`Last ${frameTimes.length.toFixed(0)} frames draw average time was ${average.toFixed(3)}ms (roughly equivalent to ${(1000 / average).toFixed(3)} frames per second)`);
            frameTimesInd = 0;
        }

        lastUpdate = performance.now();
    }

    return async function () {
        // await load();
        gameLoop(performance.now());
    };
}

export { renderer };
