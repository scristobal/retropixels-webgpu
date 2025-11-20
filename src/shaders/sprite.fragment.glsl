#version 300 es

#ifndef GL_FRAGMENT_PRECISION_HIGH
    precision mediump float;
#else
    precision highp float;
#endif

uniform sampler2D u_tex;

in vec2 v_texCoord;

out vec4 v_outColor;

void main() {
    v_outColor = texture(u_tex, v_texCoord);
}
