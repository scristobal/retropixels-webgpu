
@group(0) @binding(0) var<uniform> resolution: vec2f;
@group(0) @binding(1) var<uniform> camera: mat4x4<f32>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) texture_coords: vec2f,
};

@vertex fn vertex_main(@location(0) position: vec3f, @location(1) texture_coords: vec2f ) -> VertexOutput {


    var output: VertexOutput;
    output.position = camera * vec4f(position.xyz, 1.0);

    output.texture_coords = texture_coords;

    return output;
}

@group(0) @binding(2) var texture_sampler: sampler;
@group(0) @binding(3) var texture: texture_2d<f32>;


@fragment fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    return textureSample(texture, texture_sampler, input.texture_coords);
}
