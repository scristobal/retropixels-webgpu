#version 300 es

#ifndef GL_FRAGMENT_PRECISION_HIGH
    precision mediump float;
#else
    precision highp float;
#endif

uniform sampler2D u_texColor;

in vec2 v_texCoord;

out vec4 v_outColor;

void main() {
    vec4 texColor = texture(u_texColor, v_texCoord);

    // no transparent fragments in depth buffer
    if (texColor.a == 0.0) discard;

    v_outColor = texColor;
}
