import animationData from 'src/data/animation.json';
import { loadImageData } from 'src/helpers/image';
import { resizeHandler } from 'src/helpers/resize';
import fragmentShaderCode from 'src/shaders/fragment.glsl?raw';
import vertexShaderCode from 'src/shaders/vertex.glsl?raw';
import { inputHandler } from 'src/systems/input';
import { movement } from 'src/systems/movement';
import { spriteSheet } from 'src/systems/sprites';

async function renderer(canvasElement: HTMLCanvasElement) {
    /**
     * Initialization
     */
    const gl = canvasElement.getContext('webgl2');
    if (!gl) throw 'WebGL2 not supported in this browser';

    // Shaders - vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw 'Failed to create shader';

    gl.shaderSource(vertexShader, vertexShaderCode);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(vertexShader));
        gl.deleteShader(vertexShader);
        throw 'Failed to compile vertex shader';
    }

    // shaders - fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw 'Failed to create fragment shader';

    gl.shaderSource(fragmentShader, fragmentShaderCode);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(fragmentShader));
        gl.deleteShader(fragmentShader);
        throw 'Failed to compile fragment shader';
    }

    // shaders - program
    const program = gl.createProgram();
    if (!program) throw 'Failed to create program';

    // const verticesAttributeLocation = 0;
    // gl.bindAttribLocation(program, verticesAttributeLocation, 'a_coord');

    // const verticesTextureLocation = 1;
    // gl.bindAttribLocation(program, verticesTextureLocation, 'a_texCoord');

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        throw 'Failed to link the program';
    }

    gl.useProgram(program);

    // Vertex array object (vao)
    const verticesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer);

    // vertices
    //  3--0
    //  |  |
    //  2--1
    //                                     x  y  z  u  v
    //                                    |------0------|-------1-------|-------2--------|-------3-------|
    const verticesData = new Float32Array([1, 1, 0, 1, 0, 1, -1, 0, 1, 1, -1, -1, 0, 0, 1, -1, 1, 0, 0, 0]);

    gl.bufferData(gl.ARRAY_BUFFER, verticesData, gl.STATIC_DRAW);

    const verticesAttributeLocation = gl.getAttribLocation(program, 'a_coord');
    gl.enableVertexAttribArray(verticesAttributeLocation);
    gl.vertexAttribPointer(verticesAttributeLocation, 3, gl.FLOAT, false, 3 * 4 + 2 * 4, 0);

    const verticesTextureLocation = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(verticesTextureLocation);
    gl.vertexAttribPointer(verticesTextureLocation, 2, gl.FLOAT, false, 3 * 4 + 2 * 4, 3 * 4);

    // vao - indexing
    const indicesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);

    // vertex indices
    //  3 - - - 0
    //  | A   / |
    //  |   /   |
    //  | /   B |
    //  2 - - - 1
    //                                  |---A---|----B---|
    const indicesData = new Uint16Array([3, 2, 0, 2, 1, 0]);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesData, gl.STATIC_DRAW);

    // enable culling of back facing (clock wise) triangles
    gl.enable(gl.CULL_FACE);

    // enable depth buffer
    gl.enable(gl.DEPTH_TEST);

    // uniforms - resolution
    const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');

    // uniforms - scaling
    const scalingData = 10;
    const scalingUniformLocation = gl.getUniformLocation(program, 'u_scaling');
    gl.uniform1f(scalingUniformLocation, scalingData);

    // uniforms - xyz vertex position transform
    const positionTransformUniformLocation = gl.getUniformLocation(program, 'u_modelTransform');

    // uniforms - texture
    const textureIndex = gl.TEXTURE0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const texture = gl.createTexture();

    gl.activeTexture(textureIndex);

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // texture
    gl.activeTexture(textureIndex);

    const imgData = await loadImageData('/sprite-sheet.png');
    if (!imgData) throw 'Failed to load sprite sheet';

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, imgData.width, imgData.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imgData);

    // uniforms - texture size
    const spriteSizeUniformLocation = gl.getUniformLocation(program, 'u_modelSize');

    // uniform - uv texture transform
    const texTransformUniformLocation = gl.getUniformLocation(program, 'u_texTransform');

    const resize = resizeHandler(gl.getParameter(gl.MAX_TEXTURE_SIZE), canvasElement);

    const spriteSystem = spriteSheet(animationData);

    const movementSystem = movement({
        center: { x: 0, y: 0, z: 0 },
        speed: { x: 0.02, y: 0.02, z: 0 },
        angle: 0,
        rotationSpeed: 0.01
    });

    let lastUpdate = performance.now();
    const frameTimes = new Float32Array(1024);
    let frameTimesInd = 0;

    /**
     * Update loop function
     */
    function update(now: number) {
        const delta = now - lastUpdate;

        if (inputHandler.right) movementSystem.moveRight(delta);
        if (inputHandler.left) movementSystem.moveLeft(delta);
        if (inputHandler.up) movementSystem.moveUp(delta);
        if (inputHandler.down) movementSystem.moveDown(delta);
        if (inputHandler.turnRight) movementSystem.rotateClockWise(delta);
        if (inputHandler.turnLeft) movementSystem.rotateCounterClockWise(delta);

        spriteSystem.update(delta);

        frameTimes[++frameTimesInd] = performance.now() - now;

        if (frameTimesInd === frameTimes.length) {
            const average = frameTimes.reduce((acc, cur) => acc + cur, 0) / frameTimes.length;
            console.log(`${average.toFixed(3)}ms ~${(1000 / average).toFixed(3)}fps`);
            frameTimesInd = 0;
        }

        lastUpdate = performance.now();
    }

    // const fb = gl.createFramebuffer();
    // gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

    // const fbTexture = gl.createTexture();
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbTexture, 0);

    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasElement.width, canvasElement.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    /**
     * Render loop
     */
    function render() {
        if (!gl) throw 'Canvas context lost';

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        if (resize.needsResize) {
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            gl.uniform2fv(resolutionUniformLocation, resize.resolution);
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.uniformMatrix4fv(texTransformUniformLocation, false, spriteSystem.transform);

        gl.uniform2fv(spriteSizeUniformLocation, spriteSystem.size);

        gl.uniformMatrix4fv(positionTransformUniformLocation, false, movementSystem.transform);

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    /**
     * Game loop
     */
    return function gameLoop(now: number) {
        update(now);
        render();

        requestAnimationFrame(gameLoop);
    };
}

export { renderer };
