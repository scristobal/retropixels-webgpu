#version 300 es

layout (location = 0) in vec3 a_coord;
layout (location = 1) in vec2 a_texCoord;

uniform vec2 u_resolution;
uniform float u_scaling;
uniform vec2 u_modelSize;
uniform mat4 u_modelTransform;
uniform mat4 u_texTransform;

out vec2 v_texCoord;

void main() {
    vec4 v_position = u_modelTransform *  vec4(a_coord, 1.0);

    float ratio = u_resolution.x / u_resolution.y;
    v_position.x = v_position.x * ratio;

    gl_Position = vec4( (v_position.xy * u_scaling * u_modelSize) / u_resolution.xy, v_position.z, v_position.w);
    v_texCoord =  (u_texTransform * vec4(a_texCoord.xy, 1.0, 0.0)).xy;
}
