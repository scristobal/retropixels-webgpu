#version 300 es

vec2 v_coords[5] = vec2[](
    vec2(-1.0, 1.0),
    vec2(-1.0, -1.0),
    vec2(1.0, -1.0),
    vec2(1.0, 1.0),
    vec2(-1.0, 1.0)
);

vec2 v_texCoords[5] = vec2[](
    vec2(0.0, 1.0),
    vec2(0.0, 0.0),
    vec2(1.0, 0.0),
    vec2(1.0, 1.0),
    vec2(0.0, 1.0)
);

out vec2 v_texCoord;

void main() {
    vec2 coords = vec2(v_coords[gl_VertexID].x, v_coords[gl_VertexID].y);

    gl_Position = vec4(coords, 0.0, 1.0);
    v_texCoord = v_texCoords[gl_VertexID];
}
