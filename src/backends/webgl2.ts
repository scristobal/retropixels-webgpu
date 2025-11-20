import animationData from 'src/data/animation.json';
import { canvasManager } from 'src/helpers/canvas';
import quadFragmentShaderCode from 'src/shaders/quad.fragment.glsl?raw';
import quadVertexShaderCode from 'src/shaders/quad.vertex.glsl?raw';
import fragmentShaderCode from 'src/shaders/sprite.fragment.glsl?raw';
import vertexShaderCode from 'src/shaders/sprite.vertex.glsl?raw';
import { inputHandler } from 'src/systems/input';
import { movement } from 'src/systems/movement';
import { spriteSheet } from 'src/systems/sprites';

async function renderer(canvasElement: HTMLCanvasElement) {
    // init
    const gl = canvasElement.getContext('webgl2');
    if (!gl) throw 'WebGL2 not supported in this browser';

    // init - movement
    const movementSystem = movement({
        center: { x: 0, y: 0, z: 0 },
        speed: { x: 0.01, y: 0.01, z: 0 },
        rotationAxis: { x: 0, y: 0, z: 1 },
        angle: 0,
        rotationSpeed: 0.005
    });

    // init - sprites
    const spriteSystem = await spriteSheet(animationData);

    // init - screen manager
    const screen = canvasManager(gl.getParameter(gl.MAX_TEXTURE_SIZE), canvasElement);

    // init - sprite relative size
    const spriteScalingData = 2;

    // init - quad resolution
    const quadSize = new Float32Array([100, 100]);

    // pass - texture quad
    const quadVertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(quadVertexShader, quadVertexShaderCode);
    gl.compileShader(quadVertexShader);

    if (!gl.getShaderParameter(quadVertexShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(quadVertexShader));
        gl.deleteShader(quadVertexShader);
        throw 'Failed to compile fragment shader';
    }

    const quadFragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(quadFragmentShader, quadFragmentShaderCode);
    gl.compileShader(quadFragmentShader);

    if (!gl.getShaderParameter(quadFragmentShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(quadFragmentShader));
        gl.deleteShader(quadFragmentShader);
        throw 'Failed to compile fragment shader';
    }

    const quadProgram = gl.createProgram()!;
    gl.attachShader(quadProgram, quadVertexShader);
    gl.attachShader(quadProgram, quadFragmentShader);
    gl.linkProgram(quadProgram);

    if (!gl.getProgramParameter(quadProgram, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(quadProgram));
        gl.deleteProgram(quadProgram);
        throw 'Failed to link the program';
    }

    gl.useProgram(quadProgram);

    // uniform - scaling
    const ratioUniformLocation = gl.getUniformLocation(quadProgram, 'u_ratio');

    gl.activeTexture(gl.TEXTURE1);

    const quadTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, quadTexture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, quadSize[0], quadSize[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    const quadTextureUniformLocation = gl.getUniformLocation(quadProgram, 'u_tex');
    gl.uniform1i(quadTextureUniformLocation, 1);

    const quadFrameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, quadFrameBuffer);
    gl.viewport(0, 0, screen.resolution[0], screen.resolution[1]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, quadTexture, 0);

    // shaders - vertex shader
    const spriteVertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!spriteVertexShader) throw 'Failed to create shader';

    gl.shaderSource(spriteVertexShader, vertexShaderCode);
    gl.compileShader(spriteVertexShader);

    if (!gl.getShaderParameter(spriteVertexShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(spriteVertexShader));
        gl.deleteShader(spriteVertexShader);
        throw 'Failed to compile vertex shader';
    }

    // shaders - fragment shader
    const spriteFragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!spriteFragmentShader) throw 'Failed to create fragment shader';

    gl.shaderSource(spriteFragmentShader, fragmentShaderCode);
    gl.compileShader(spriteFragmentShader);

    if (!gl.getShaderParameter(spriteFragmentShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(spriteFragmentShader));
        gl.deleteShader(spriteFragmentShader);
        throw 'Failed to compile fragment shader';
    }

    // program
    const spriteProgram = gl.createProgram();
    if (!spriteProgram) throw 'Failed to create program';

    gl.attachShader(spriteProgram, spriteVertexShader);
    gl.attachShader(spriteProgram, spriteFragmentShader);

    gl.linkProgram(spriteProgram);

    if (!gl.getProgramParameter(spriteProgram, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(spriteProgram));
        gl.deleteProgram(spriteProgram);
        throw 'Failed to link the program';
    }

    gl.useProgram(spriteProgram);

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

    const spriteVerticesCoordsLocation = 0;
    gl.bindAttribLocation(spriteProgram, spriteVerticesCoordsLocation, 'a_coord');
    gl.enableVertexAttribArray(spriteVerticesCoordsLocation);
    gl.vertexAttribPointer(spriteVerticesCoordsLocation, 3, gl.FLOAT, false, 3 * 4 + 2 * 4, 0);

    const spriteVerticesTextureCoordsLocation = 1;
    gl.bindAttribLocation(spriteProgram, spriteVerticesTextureCoordsLocation, 'a_texCoord');
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

    // enable culling of back facing (clock wise) triangles
    gl.enable(gl.CULL_FACE);

    // enable depth buffer
    gl.enable(gl.DEPTH_TEST);

    // enable alpha blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // uniform - resolution
    const resolutionUniformLocation = gl.getUniformLocation(spriteProgram, 'u_resolution');
    gl.uniform2fv(resolutionUniformLocation, quadSize);

    // uniform - scaling
    const scalingUniformLocation = gl.getUniformLocation(spriteProgram, 'u_scaling');
    gl.uniform1f(scalingUniformLocation, spriteScalingData);

    // uniform - vertex position transform
    const spritePositionTransformUniformLocation = gl.getUniformLocation(spriteProgram, 'u_modelTransform');

    // uniform - texture
    gl.activeTexture(gl.TEXTURE0);

    const spriteTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, spriteTexture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, spriteSystem.sheetSize.width, spriteSystem.sheetSize.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, spriteSystem.imgData);

    const spriteTextureUniformLocation = gl.getUniformLocation(spriteProgram, 'u_tex');
    gl.uniform1i(spriteTextureUniformLocation, 0);

    // uniform - texture size
    const spriteSizeUniformLocation = gl.getUniformLocation(spriteProgram, 'u_modelSize');

    // uniform - texture transformation matrix
    const spriteTextureTransformUniformLocation = gl.getUniformLocation(spriteProgram, 'u_texTransform');

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
        if (!gl) throw 'Canvas context lost';

        // 1st pass draw sprite on quad
        gl.bindFramebuffer(gl.FRAMEBUFFER, quadFrameBuffer);
        gl.viewport(0, 0, quadSize[0], quadSize[1]);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(spriteProgram);

        // gl.uniform2fv(resolutionUniformLocation, quadSize);
        gl.uniformMatrix4fv(spriteTextureTransformUniformLocation, false, spriteSystem.transform);
        gl.uniform2fv(spriteSizeUniformLocation, spriteSystem.spriteSize);
        gl.uniformMatrix4fv(spritePositionTransformUniformLocation, false, movementSystem.transform);

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        // 2nd pass draw quad on screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const resize = screen.needsResize;

        gl.viewport(0, 0, screen.resolution[0], screen.resolution[1]);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(quadProgram);

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
