
@group(0) @binding(0) var<uniform> u_resolution: vec2f;
@group(0) @binding(1) var<uniform> u_scaling: f32;
@group(0) @binding(2) var<uniform> u_modelSize: vec2f;
@group(0) @binding(3) var<uniform> u_modelTransform: mat4x4<f32>;

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

    var position =  u_modelTransform * vec4f(input.a_coord.xyz, 1.0);

    output.a_coord = vec4f(position.xy * u_scaling * u_modelSize / u_resolution.xy, position.z, position.w);
    output.a_texCoord = input.a_texCoord;

    return output;
}

@group(0) @binding(4) var texture_sampler: sampler;
@group(0) @binding(5) var texture: texture_2d<f32>;

@fragment fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    return textureSample(texture, texture_sampler, input.a_texCoord);
}
