import animationData from 'src/data/animation.json';
import { canvasManager } from 'src/helpers/canvas';
import { m4 } from 'src/helpers/m4';
import { timeTrack } from 'src/helpers/time';
import quadFragmentShaderCode from 'src/shaders/quad.fragment.glsl?raw';
import quadVertexShaderCode from 'src/shaders/quad.vertex.glsl?raw';
import spriteFragmentShaderCode from 'src/shaders/sprite.fragment.glsl?raw';
import spriteVertexShaderCode from 'src/shaders/sprite.vertex.glsl?raw';
import { inputHandler } from 'src/systems/input';
import { createMovement } from 'src/systems/movement';
import { spriteSheet } from 'src/systems/sprites';

function createProgram(gl: WebGL2RenderingContext, vertexShaderCode: string, fragmentShaderCode: string) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderCode);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderCode);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.deleteShader(vertexShader);

    gl.attachShader(program, fragmentShader);
    gl.deleteShader(fragmentShader);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));

        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(vertexShader));
            gl.deleteShader(vertexShader);
            throw 'Failed to compile vertex shader';
        }

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(fragmentShader));
            gl.deleteShader(fragmentShader);
            throw 'Failed to compile fragment shader';
        }

        gl.deleteProgram(program);
        throw 'Failed to link the program';
    }

    return program;
}

async function renderer(canvasElement: HTMLCanvasElement) {
    const gl = canvasElement.getContext('webgl2');
    if (!gl) throw 'WebGL2 not supported in this browser';

    const movement = createMovement({
        center: [0, 0, 0],
        speed: [0.005, 0.005, 0],
        axis: [0, 0, 1],
        angle: 0,
        rotation: 0.005
    });
    const sprite = await spriteSheet(animationData);
    const timeTracker = timeTrack();
    const screen = canvasManager(gl.getParameter(gl.MAX_TEXTURE_SIZE), canvasElement);
    const quadSize = new Float32Array([100, 100]);

    let spriteModelTransform: Float32Array;
    let spriteTextureTransform: Float32Array;

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

    const spriteModelTransformUniformLocation = gl.getUniformLocation(spriteProgram, 'u_modelTransform');
    const spriteTextureTransformUniformLocation = gl.getUniformLocation(spriteProgram, 'u_texTransform');
    const spriteColorTextureUniformLocation = gl.getUniformLocation(spriteProgram, 'u_texColor');

    gl.uniform1i(spriteColorTextureUniformLocation, 0);

    gl.activeTexture(gl.TEXTURE0);
    const spriteTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, spriteTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sprite.sheetSize.width, sprite.sheetSize.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, sprite.imgData);

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

        // const ratio = screen.resolution[0] / screen.resolution[1];
        // const scale = new Float32Array([2 * sprite.spriteSize[0] / (ratio * quadSize[0]), 2 * ratio * sprite.spriteSize[1] / quadSize[1], 1]);
        const scale = new Float32Array([sprite.spriteSize[0] / quadSize[0], sprite.spriteSize[1] / quadSize[1], 1]);
        spriteModelTransform = m4().identity.scale(scale).translate(movement.center).rotate(movement.axis, movement.angle).data;
        spriteTextureTransform = sprite.transform;
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

        gl.uniformMatrix4fv(spriteModelTransformUniformLocation, false, spriteModelTransform);
        gl.uniformMatrix4fv(spriteTextureTransformUniformLocation, false, spriteTextureTransform);

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

    return function gameLoop() {
        update();
        render();

        requestAnimationFrame(gameLoop);
    };
}

export { renderer };
