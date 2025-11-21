import animationData from 'src/data/animation.json';
import { canvasManager } from 'src/helpers/canvas';
import { frameReporter } from 'src/helpers/frames';
import quadFragmentShaderCode from 'src/shaders/quad.fragment.glsl?raw';
import quadVertexShaderCode from 'src/shaders/quad.vertex.glsl?raw';
import spriteFragmentShaderCode from 'src/shaders/sprite.fragment.glsl?raw';
import spriteVertexShaderCode from 'src/shaders/sprite.vertex.glsl?raw';
import { inputHandler } from 'src/systems/input';
import { movement } from 'src/systems/movement';
import { spriteSheet } from 'src/systems/sprites';

function createProgram(gl: WebGL2RenderingContext, vertexShaderCode: string, fragmentShaderCode: string) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderCode);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(vertexShader));
        gl.deleteShader(vertexShader);
        throw 'Failed to compile fragment shader';
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderCode);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(fragmentShader));
        gl.deleteShader(fragmentShader);
        throw 'Failed to compile fragment shader';
    }

    const program = gl.createProgram();
    if (!program) throw 'Failed to create program';

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        throw 'Failed to link the program';
    }

    return program;
}

async function renderer(canvasElement: HTMLCanvasElement) {
    const gl = canvasElement.getContext('webgl2');
    if (!gl) throw 'WebGL2 not supported in this browser';

    const movementSystem = movement({
        center: { x: 0, y: 0, z: 0 },
        speed: { x: 0.01, y: 0.01, z: 0 },
        rotationAxis: { x: 0, y: 0, z: 1 },
        angle: 0,
        rotationSpeed: 0.005
    });
    const spriteSystem = await spriteSheet(animationData);
    const screen = canvasManager(gl.getParameter(gl.MAX_TEXTURE_SIZE), canvasElement);
    const spriteScalingData = 2;
    const quadSize = new Float32Array([100, 100]);

    // globals
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // 2nd pass program, render to a quad
    const quadProgram = createProgram(gl, quadVertexShaderCode, quadFragmentShaderCode);
    gl.useProgram(quadProgram);

    const ratioUniformLocation = gl.getUniformLocation(quadProgram, 'u_ratio');
    const quadTextureUniformLocation = gl.getUniformLocation(quadProgram, 'u_texColor');
    const quadDepthTextureUniformLocation = gl.getUniformLocation(quadProgram, 'u_texDepth');

    gl.uniform1f(ratioUniformLocation, screen.resolution[1] / screen.resolution[0]);

    gl.activeTexture(gl.TEXTURE1);
    const quadTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, quadTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, quadSize[0], quadSize[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.uniform1i(quadTextureUniformLocation, 1);

    gl.activeTexture(gl.TEXTURE2);
    const depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, quadSize[0], quadSize[1], 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.uniform1i(quadDepthTextureUniformLocation, 2);

    const quadFrameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, quadFrameBuffer);
    gl.viewport(0, 0, screen.resolution[0], screen.resolution[1]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, quadTexture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);

    // 1st pass program, animated sprite
    const spriteProgram = createProgram(gl, spriteVertexShaderCode, spriteFragmentShaderCode);
    gl.useProgram(spriteProgram);

    const spriteVerticesCoordsLocation = gl.getAttribLocation(spriteProgram, 'a_coord');
    const spriteVerticesTextureCoordsLocation = gl.getAttribLocation(spriteProgram, 'a_texCoord');

    // vertices array object (vao)- position and texture coordinates
    //
    //  3--0
    //  |  |
    //  2--1
    //                                           x  y  z  u  v
    //                                          |------0------|-------1-------|-------2--------|-------3-------|
    const spriteVerticesData = new Float32Array([1, 1, 0, 1, 0, 1, -1, 0, 1, 1, -1, -1, 0, 0, 1, -1, 1, 0, 0, 0]);

    const spriteVerticesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spriteVerticesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, spriteVerticesData, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(spriteVerticesCoordsLocation);
    gl.vertexAttribPointer(spriteVerticesCoordsLocation, 3, gl.FLOAT, false, 3 * 4 + 2 * 4, 0);

    gl.enableVertexAttribArray(spriteVerticesTextureCoordsLocation);
    gl.vertexAttribPointer(spriteVerticesTextureCoordsLocation, 2, gl.FLOAT, false, 3 * 4 + 2 * 4, 3 * 4);

    // vao - indexing
    //
    //  3 - - - 0
    //  | A   / |
    //  |   /   |
    //  | /   B |
    //  2 - - - 1
    //                                        |---A---|----B---|
    const spriteIndicesData = new Uint16Array([3, 2, 0, 2, 1, 0]);

    const spriteIndicesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spriteIndicesBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, spriteIndicesData, gl.STATIC_DRAW);

    const resolutionUniformLocation = gl.getUniformLocation(spriteProgram, 'u_resolution');
    const spriteSizeUniformLocation = gl.getUniformLocation(spriteProgram, 'u_modelSize');
    const scalingUniformLocation = gl.getUniformLocation(spriteProgram, 'u_scaling');
    const spritePositionTransformUniformLocation = gl.getUniformLocation(spriteProgram, 'u_modelTransform');
    const spriteTextureUniformLocation = gl.getUniformLocation(spriteProgram, 'u_texColor');
    const spriteTextureTransformUniformLocation = gl.getUniformLocation(spriteProgram, 'u_texTransform');

    gl.uniform2fv(resolutionUniformLocation, quadSize);
    gl.uniform2fv(spriteSizeUniformLocation, spriteSystem.spriteSize);
    gl.uniform1f(scalingUniformLocation, spriteScalingData);
    gl.uniformMatrix4fv(spritePositionTransformUniformLocation, false, movementSystem.transform);
    gl.uniform1i(spriteTextureUniformLocation, 0);
    gl.uniformMatrix4fv(spriteTextureTransformUniformLocation, false, spriteSystem.transform);

    gl.activeTexture(gl.TEXTURE0);
    const spriteTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, spriteTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, spriteSystem.sheetSize.width, spriteSystem.sheetSize.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, spriteSystem.imgData);

    let lastUpdate = performance.now();
    const reportFps = frameReporter();

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

        reportFps(delta);

        lastUpdate = performance.now();
    }

    function render() {
        if (!gl) throw 'Canvas context lost';
        const resize = screen.needsResize;

        // 1st pass draw sprite on quad
        gl.bindFramebuffer(gl.FRAMEBUFFER, quadFrameBuffer);
        gl.viewport(0, 0, quadSize[0], quadSize[1]);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(spriteProgram);

        // gl.uniform2fv(resolutionUniformLocation, quadSize); // quad size does not change dynamically
        gl.uniformMatrix4fv(spriteTextureTransformUniformLocation, false, spriteSystem.transform);
        gl.uniform2fv(spriteSizeUniformLocation, spriteSystem.spriteSize);
        gl.uniformMatrix4fv(spritePositionTransformUniformLocation, false, movementSystem.transform);

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        // 2nd pass draw quad on screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, screen.resolution[0], screen.resolution[1]);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(quadProgram);

        // Bind depth texture instead of color texture
        // gl.activeTexture(gl.TEXTURE1);
        // gl.bindTexture(gl.TEXTURE_2D, depthTexture);

        if (resize) {
            gl.uniform1f(ratioUniformLocation, screen.resolution[0] / screen.resolution[1]);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 5);
    }

    return function gameLoop(now: number) {
        update(now);
        render();

        requestAnimationFrame(gameLoop);
    };
}

export { renderer };
