#version 300 es

#ifndef GL_FRAGMENT_PRECISION_HIGH
   precision mediump float;
#else
   precision highp float;
#endif

uniform sampler2D u_texColor;
uniform sampler2D u_texDepth;

in vec2 v_texCoord;

out vec4 v_outColor;

void main() {
    float depth = texture(u_texDepth, v_texCoord).r;
    //v_outColor = vec4(vec3(depth), 1.0);
    v_outColor = texture(u_texColor, v_texCoord);
}
