export const Shaders = () => {
    const vertexShaderForRenderPass = `
        struct Transforms {
            model : mat4x4<f32>,
            view : mat4x4<f32>,
            proj : mat4x4<f32>
        };

        @binding(0) @group(0) var<uniform> transforms : Transforms;
        @binding(1) @group(0) var<uniform> lightTransform : Transforms;

        struct Output {
            @builtin(position) Position : vec4<f32>,
            @location(0) vColor : vec4<f32>,
            @location(1) vNormal : vec4<f32>,
            @location(2) vViewSpacePosition : vec4<f32>,
            @location(3) vLightSpacePosition : vec4<f32>
        };

        @vertex
        fn main(
            @location(0) pos: vec3<f32>, 
            @location(1) color: vec3<f32>, 
            @location(2) normal: vec3<f32>) -> Output {
                var output: Output;

                output.Position = transforms.proj * transforms.view * transforms.model * vec4<f32>(pos, 1.0);
                output.vNormal = normalize(transforms.model * vec4<f32>(normal, 0.0));
                output.vColor = vec4<f32>(color, 1.0); 
                output.vViewSpacePosition = transforms.view * transforms.model * vec4<f32>(pos, 1.0);

                var lightSpacePosition = lightTransform.proj * lightTransform.view * lightTransform.model * vec4<f32>(pos, 1.0);
                output.vLightSpacePosition = lightSpacePosition;
                return output;
        } 
    `;

    const fragmentShaderForRenderPass = `
        struct Light {
            pos : vec4<f32>,
            color: vec4<f32>,
        };

        struct Material {
            kAmbient : f32,
            kDiffuse : f32,
            kSpecular : f32,
            shininess : f32
        }

        @binding(2) @group(0) var<uniform> light : Light;
        @binding(3) @group(0) var<uniform> cameraPos : vec4<f32>;
        @binding(4) @group(0) var<uniform> material : Material;
        @binding(5) @group(0) var shadowMap : texture_depth_2d;
        @binding(6) @group(0) var shadowSampler : sampler_comparison;

        fn rand(seed4: vec4<f32>) -> f32 {

            // return random number between [-1, 1]
            var dot_product = dot(seed4, vec4(12.9898, 78.233, 45.164, 94.673));
            return fract(sin(dot_product) * 43758.5453);
        }

        @fragment
        fn main(
            @location(0) fColor: vec4<f32>,
            @location(1) fNormal: vec4<f32>,
            @location(2) fViewSpacePosition : vec4<f32>,
            @location(3) fLightSpacePosition : vec4<f32>) -> @location(0) vec4<f32> {
        
                var L = normalize(light.pos.xyz - fViewSpacePosition.xyz);
                var V = normalize(cameraPos.xyz - fViewSpacePosition.xyz);
                var R = 2 * dot(L, fNormal.xyz) * fNormal.xyz - L;

                var lightIntensity = material.kAmbient; 

                var eps: f32 = 0.001;
                var texCoord = fLightSpacePosition.xy / fLightSpacePosition.w;
                texCoord = (texCoord * vec2(0.5,-0.5)) + vec2(0.5, 0.5);
                var shadowZValue = clamp(fLightSpacePosition.z / fLightSpacePosition.w, 0.0, 1.0);
                var visibility: f32 = 0.0;

                var numSamples: f32 = 16.0;

                var textureDims = vec2<f32>(textureDimensions(shadowMap));
                for (var y: f32 = -1.5; y <= 1.5; y += 1.0) {
                    for (var x: f32 = -1.5; x <= 1.5; x += 1.0) {
                        var offsetX = rand(vec4<f32>(fViewSpacePosition.xyy, x));
                        var offsetY = rand(vec4<f32>(fViewSpacePosition.xyz, y));
                        var offset = vec2<f32>(x + offsetX, y + offsetY) / textureDims;
                        visibility += textureSampleCompare(
                            shadowMap, 
                            shadowSampler, 
                            texCoord + offset,
                            shadowZValue - eps);
                    }
                }
                visibility /= numSamples;

                lightIntensity += visibility * (
                    material.kDiffuse * max(dot(L, fNormal.xyz), 0)
                    + material.kSpecular * pow(max(dot(R, V), 0), material.shininess));

                var red = light.color[0] * fColor[0] * lightIntensity;
                var green = light.color[1] * fColor[1] * lightIntensity;
                var blue = light.color[2] * fColor[2] * lightIntensity;

                red = clamp(red, 0.0, 1.0);
                green = clamp(green, 0.0, 1.0);
                blue = clamp(blue, 0.0, 1.0);
                return vec4<f32>(red, green, blue, 1.0);
                
        }
    `;

    const vertexShaderForShadowPass = `
        struct Transforms {
            model : mat4x4<f32>,
            view : mat4x4<f32>,
            proj : mat4x4<f32>
        }

        @binding(0) @group(0) var<uniform> transforms : Transforms;

        struct Output {
            @builtin(position) Position : vec4<f32>
        }

        @vertex
        fn main(@location(0) pos: vec4<f32>) -> Output {
            var output : Output;
            output.Position = transforms.proj * transforms.view * transforms.model * pos;
            return output;
        }
    `;

    return {
        renderPass: {
            vertex: vertexShaderForRenderPass, 
            fragment: fragmentShaderForRenderPass
        },
        shadowPass: {
            vertex: vertexShaderForShadowPass,
        }
    }
}