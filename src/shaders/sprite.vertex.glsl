#version 300 es

layout (location = 0) in vec3 a_coord;
layout (location = 1) in vec2 a_texCoord;

uniform mat4 u_modelTransform;
uniform mat4 u_texTransform;

out vec2 v_texCoord;

void main() {
    gl_Position = u_modelTransform *  vec4(a_coord, 1.0);
    v_texCoord =  (u_texTransform * vec4(a_texCoord.xy, 1.0, 1.0)).xy;
}
