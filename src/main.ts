import $ from 'jquery';
import { InitGPU, CreateGPUBuffer, CreateViewProjection, CreateTransforms } from './helper';
import { Shaders } from './shaders';
import { CubeData, FloorData } from './vertex_data';
import { mat4, vec4, vec3 } from 'gl-matrix';


const GetVertexData = async(device: GPUDevice) => {

    const cubeData = CubeData();
    const floorData = FloorData();

    const numCubeVertices = cubeData.positions.length / 3;
    const numFloorVertices = floorData.positions.length / 3;
    const numVertices = numCubeVertices + numFloorVertices;

    let vertexData = new Float32Array(numCubeVertices*3 + numFloorVertices*3);
    vertexData.set(cubeData.positions);
    vertexData.set(floorData.positions, numCubeVertices*3);

    let colorData = new Float32Array(numCubeVertices*3 + numFloorVertices*3);
    colorData.set(cubeData.colors);
    colorData.set(floorData.colors, numCubeVertices*3);

    let normalData = new Float32Array(numCubeVertices*3 + numFloorVertices*3);
    normalData.set(cubeData.normals);
    normalData.set(floorData.normals, numCubeVertices*3);

    const vertexBuffer = CreateGPUBuffer(device, vertexData);
    const colorBuffer = CreateGPUBuffer(device, colorData);
    const normalBuffer = CreateGPUBuffer(device, normalData);

    return {
        vertexBuffer,
        colorBuffer,
        normalBuffer,
        numVertices
    }
}

const CreateRenderPipeline = async (
    device: GPUDevice, 
    pipelineLayout: GPUPipelineLayout, 
    gpuTextureFormat: GPUTextureFormat, 
    shader: any) => {

    const pipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: device.createShaderModule({                    
                    code: shader.vertex,
                }),
                entryPoint: "main",
                buffers: [
                    {   // vertex positions
                        arrayStride: 12,
                        attributes: [{
                            shaderLocation: 0,
                            format: "float32x3",
                            offset: 0
                        }]
                    },  
                    {   // vertex color
                        arrayStride: 12,
                        attributes: [{
                            shaderLocation: 1,
                            format: "float32x3",
                            offset: 0
                        }]
                    },
                    {   // vertex normal
                        arrayStride: 12,
                        attributes: [{
                            shaderLocation: 2,
                            format: "float32x3",
                            offset: 0
                        }]
                    }
                ]
            },
            fragment: {
                module: device.createShaderModule({                    
                    code: shader.fragment,
                }),
                entryPoint: "main",
                targets: [{
                    format: gpuTextureFormat as GPUTextureFormat
                }]
            },
            primitive:{
                topology: "triangle-list", 
                cullMode: "back"
            },
            depthStencil:{
                format: "depth24plus",
                depthWriteEnabled: true,
                depthCompare: "less"
            }
    });
    return pipeline;
}

const CreateShadowPipeline = async (
    device: GPUDevice,
    pipelineLayout: GPUPipelineLayout,
    gpuTextureFormat: GPUTextureFormat,
    shader: any) => {

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: device.createShaderModule({
                code: shader.vertex,
            }),
            entryPoint: "main",
            buffers: [
                {   // vertex positions
                    arrayStride: 12,
                    attributes: [{
                        shaderLocation: 0,
                        format: "float32x3",
                        offset: 0
                    }]
                }],
        },
        primitive: {
            topology: "triangle-list",
        },
        depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less"
        }
    });

    return pipeline;
}

const CreateBindGroup = async (
    device: GPUDevice, 
    bindGroupLayout: GPUBindGroupLayout,
    buffers: Array<GPUBuffer> = [],
    textures: Array<GPUTexture> = [],
    samplers: Array<GPUSampler> = []) => {

    let entries = []
    for (let i = 0; i < buffers.length; i++) {
        entries.push({
            binding: i,
            resource: {
                buffer: buffers[i],
                offset: 0,
                size: buffers[i].size
            }
        });
    }

    for (let i = 0; i < textures.length; i++) {
        entries.push({
            binding: buffers.length + i,
            resource: textures[i].createView(),
        });
    }

    for (let i = 0; i < samplers.length; i++) {
        entries.push({
            binding: buffers.length + textures.length + i,
            resource: samplers[i]
        })
    }

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: entries
    });

    return bindGroup;

}

const CreateSquare = async () => {
    const gpu = await InitGPU();
    const device = gpu.device;

    const vertexData = GetVertexData(device);
    const vertexBuffer = (await vertexData).vertexBuffer;
    const colorBuffer = (await vertexData).colorBuffer;
    const normalBuffer = (await vertexData).normalBuffer;
    const numVertices = (await vertexData).numVertices;

    const shader = Shaders();

    /* Create Uniforms for matrix transforms*/
    let modelMatrix = mat4.create();
    const vp = CreateViewProjection(gpu.canvas.width/gpu.canvas.height);

    const viewMatrix = vp.viewMatrix;
    const projectionMatrix = vp.projectionMatrix;
    const mat4x4ByteLength = 16 * 4;
    const uniformTransformBuffer = device.createBuffer({
        size: mat4x4ByteLength * 3,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const shadowMVPMat = device.createBuffer({
        size: mat4x4ByteLength * 3,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(uniformTransformBuffer, 0, modelMatrix as ArrayBuffer);
    device.queue.writeBuffer(uniformTransformBuffer, mat4x4ByteLength, viewMatrix as ArrayBuffer);
    device.queue.writeBuffer(uniformTransformBuffer, mat4x4ByteLength * 2, projectionMatrix as ArrayBuffer);

    /* Create uniforms for light source and camera */
    const lightSourceColor = vec4.fromValues(1,1,1,1);

    const uniformLightSrcBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const cameraPos = vec4.fromValues(0,0,0,1);                         // view space

    const uniformCameraPos = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    /* Create uniforms for material properties */
    const uniformMaterialBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(uniformLightSrcBuffer, 16, lightSourceColor as ArrayBuffer);
    device.queue.writeBuffer(uniformCameraPos, 0, cameraPos as ArrayBuffer);

    /* Create bind groups */
    const shadowBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: "uniform",
                }   // light transform matrices
            },
        ]
    });

    const shadowBuffers = [shadowMVPMat];
    const shadowPassBindGroup = await CreateBindGroup(device, shadowBindGroupLayout, shadowBuffers);

    const uniformBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0, 
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: "uniform",
                }   // transform matrices
            },
            {
                binding: 1,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: "uniform",
                }   // transform matrices for shadow pass
            },
            {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                }   // light source
            },
            {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform"
                }   // camera position
            },
            {
                binding: 4,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform"
                }   // material
            },
            {
                binding: 5,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "depth"
                } // shadow map
            },
            {
                binding: 6,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "comparison"
                } // sampler for shadow map texture 
            }
        ]
    });

    const shadowMap = device.createTexture({
        size: [gpu.canvas.width * 2, gpu.canvas.height * 2, 1],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });

    const shadowMapSampler = device.createSampler({
        compare: "less",
        magFilter: "linear"
    })

    const buffers = [uniformTransformBuffer, shadowMVPMat, uniformLightSrcBuffer, uniformCameraPos, uniformMaterialBuffer];
    const textures = [shadowMap];
    const samplers = [shadowMapSampler];
    const renderPassBindGroup = await CreateBindGroup(device, uniformBindGroupLayout, buffers, textures, samplers);

    /* Define pipeline
        Describe layout of render pipeline, including
        what the shaders are, what data they will use,
        what textures will be used, etc.
    */
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            uniformBindGroupLayout,
        ]
    });

    const pipeline = await CreateRenderPipeline(device, pipelineLayout, gpu.format, shader.renderPass);

    const shadowPipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            shadowBindGroupLayout
        ]
    });

    const shadowPipeline = await CreateShadowPipeline(device, shadowPipelineLayout, gpu.format, shader.shadowPass)

    /* Declare render pass and render attachments */
    const depthTexture = device.createTexture({
        size: [gpu.canvas.width, gpu.canvas.height, 1],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    const renderPassDescriptor = {
        colorAttachments: [{
            view: undefined as unknown as GPUTextureView,
            clearValue: { r: 0.5, g: 0.5, b: 0.8, a: 1.0 }, //background color
            loadOp: 'clear',
            storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthLoadOp: 'clear',
            depthClearValue: 1.0,
            depthStoreOp: 'store',
        }
    };

    const shadowPassDescriptor = {
        colorAttachments: [],
        depthStencilAttachment: {
            view: shadowMap.createView(),
            depthLoadOp: 'clear',
            depthClearValue: 1.0,
            depthStoreOp: 'store'
        }
    };

    function draw() {

        /* get material constants */
        const material = getMaterial();
        device.queue.writeBuffer(uniformMaterialBuffer, 0, material as ArrayBuffer);

        /* update light source */
        const angle = getLightAngle();
        const height = getLightYPos();
        const lightSourcePos = vec4.fromValues(6*Math.cos(angle),height,6*Math.sin(angle),1);      // world space
 
        /* update mvp matrix for shadow pass */
        CreateTransforms(modelMatrix);
        let shadowVPMatrices = CreateViewProjection(1.0, 
            vec3.fromValues(lightSourcePos[0], lightSourcePos[1], lightSourcePos[2]));

        device.queue.writeBuffer(shadowMVPMat, 0, modelMatrix as ArrayBuffer);
        device.queue.writeBuffer(shadowMVPMat, mat4x4ByteLength, shadowVPMatrices.viewMatrix as ArrayBuffer);
        device.queue.writeBuffer(shadowMVPMat, 2*mat4x4ByteLength, shadowVPMatrices.projectionMatrix as ArrayBuffer);
        
        

        vec4.transformMat4(lightSourcePos, lightSourcePos, viewMatrix);     // view space
        device.queue.writeBuffer(uniformLightSrcBuffer, 0, lightSourcePos as ArrayBuffer);

        /* shadow pass draw call */
        const shadowCommandEncoder = device.createCommandEncoder();
        const shadowPass = shadowCommandEncoder.beginRenderPass(shadowPassDescriptor as GPURenderPassDescriptor);
        shadowPass.setVertexBuffer(0, vertexBuffer);
        shadowPass.setPipeline(shadowPipeline);
        shadowPass.setBindGroup(0, shadowPassBindGroup);
        shadowPass.draw(numVertices);
        shadowPass.end();

        /* render pass draw call */
        const commandEncoder = device.createCommandEncoder();
        const textureView = gpu.context.getCurrentTexture().createView();
        renderPassDescriptor.colorAttachments[0].view = textureView as GPUTextureView;
        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor as GPURenderPassDescriptor);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setVertexBuffer(1, colorBuffer);
        renderPass.setVertexBuffer(2, normalBuffer);
        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, renderPassBindGroup);
        renderPass.draw(numVertices);
        renderPass.end();

        /* submit to device */
        device.queue.submit([shadowCommandEncoder.finish(), commandEncoder.finish()]);
        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
}

function getLightYPos() {
    const y = $("#light-height").val() as number;
    return y;
}
function getLightAngle() {
    const angle = $("#light-angle").val() as number;
    return angle * Math.PI / 180;
}

function getMaterial() {
    const kAmbient = $("#ambient").val() as number;
    const kDiffuse = $("#diffuse").val() as number;
    const kSpecular = $("#specular").val() as number;
    const shininess = $("#shininess").val() as number;

    const material = vec4.fromValues(kAmbient, kDiffuse, kSpecular, shininess);
    return material;
}

$(document).ready(function() {
    CreateSquare();
});
