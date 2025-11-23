
@group(0) @binding(0) var<uniform> u_modelTransform: mat4x4<f32>;
@group(0) @binding(1) var<uniform> u_texTransform: mat4x4<f32>;

struct VertexInput {
    @location(0) a_coord: vec3f,
    @location(1) a_texCoord: vec2f
}

struct VertexOutput {
    @builtin(position) a_coord: vec4f,
    @location(0) a_texCoord: vec2f,
};

@vertex fn vertex_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    output.a_coord = u_modelTransform * vec4f(input.a_coord.xyz, 1.0);
    output.a_texCoord = (u_texTransform * vec4f(input.a_texCoord.xy, 1.0, 0.0)).xy;

    return output;
}

@group(1) @binding(0) var texture_sampler: sampler;
@group(1) @binding(1) var texture: texture_2d<f32>;

@fragment fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let texColor : vec4f = textureSample(texture, texture_sampler, input.a_texCoord);

    // skip transparent fragments in depth buffer
    if (texColor.a == 0.0) {
        discard;
    };

    return texColor;
}
