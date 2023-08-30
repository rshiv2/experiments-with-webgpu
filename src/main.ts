import $ from 'jquery';
import { InitGPU, CreateVertexBuffer, CreateIndexBuffer, CreateViewProjection, CreateTransforms } from './helper';
import { Shaders } from './shaders';
import { ReadOBJ } from './vertex_data';
import { mat4, vec4, vec3 } from 'gl-matrix';

const SetObjectColor = (colorData: Float32Array, newColor: Float32Array) => {
    for (let i = 0; i < colorData.length; i+=3) {
        colorData[i]   = newColor[0];
        colorData[i+1] = newColor[1];
        colorData[i+2] = newColor[2];
    }
}

const Float32Concat = (first: Float32Array, second: Float32Array) => {
    let firstLength = first.length;
    let result = new Float32Array(firstLength + second.length);
    result.set(first);
    result.set(second, firstLength);
    return result;
}

const Uint32Concat = (first: Uint32Array, second: Uint32Array) => {
    let firstLength = first.length;
    let result = new Uint32Array(firstLength + second.length);
    result.set(first);
    result.set(second, firstLength);
    return result;

}

const GetVertexData = async(device: GPUDevice) => {

    const files: Array<string> = ["../objs/cone.obj", "../objs/sphere.obj", "../objs/cube.obj", "../objs/floor.obj", "../objs/icosahedron.obj"];
    const numObjects = files.length; 

    let vertexData = new Float32Array();
    let colorData  = new Float32Array();
    let normalData = new Float32Array();
    let indexData  = new Uint32Array();
    let objectStartIndices = new Uint32Array(files.length + 1);
    let modelMatrices: Array<mat4> = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const object = (await ReadOBJ(file));
        SetObjectColor(object.colors, new Float32Array([Math.round(Math.random()),
                                                        Math.round(Math.random()),
                                                        Math.round(Math.random())]));
        
        objectStartIndices[i] = indexData.length;
        const offset = vertexData.length / 3;   
        for (let j = 0; j < object.indices.length; j++) {
            object.indices[j] += offset;
        }
        indexData = Uint32Concat(indexData, object.indices);
        vertexData = Float32Concat(vertexData, object.vertices);
        colorData  = Float32Concat(colorData, object.colors);
        normalData = Float32Concat(normalData, object.normals);

        const modelMatrix = mat4.create();
        if (file === "../objs/floor.obj") {
            modelMatrices[i] = modelMatrix;
        } else {
            let translation = vec3.fromValues(5*Math.sin(i / numObjects * 2 * Math.PI),
                                                0, 5*Math.cos(i / numObjects * 2 * Math.PI));

            if (file === "../objs/cone.obj") {
                const rot = vec3.fromValues(-Math.PI/2,0,0);
                const scale = vec3.fromValues(10,10,10);
                vec3.add(translation, translation, vec3.fromValues(0,-1,0));
                CreateTransforms(modelMatrix, translation, rot, scale);
            } else {
                CreateTransforms(modelMatrix, translation);
            }
            modelMatrices[i] = modelMatrix;
        }
    }
    objectStartIndices[objectStartIndices.length-1] = indexData.length;

    const vertexBuffer = CreateVertexBuffer(device, vertexData);
    const indexBuffer  = CreateIndexBuffer(device, indexData);
    const colorBuffer  = CreateVertexBuffer(device, colorData);
    const normalBuffer = CreateVertexBuffer(device, normalData);

    return { 
        vertexBuffer,
        indexBuffer,
        colorBuffer,
        normalBuffer,
        objectStartIndices,
        modelMatrices
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
            //cullMode: "front",
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

interface ObjectInfo {
    modelMatrix:         mat4,   
    shadowPassBindGroup: GPUBindGroup,
    shadowMVPMat:        GPUBuffer,
    renderPassBindGroup: GPUBindGroup,
    renderMVPMat:        GPUBuffer,
    startIndex:          number,
    endIndex:            number

}

const CreateSquare = async () => {
    const gpu = await InitGPU();
    const device = gpu.device;

    const vertexData = GetVertexData(device);
    const shader = Shaders();

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

    /* Create textures + samplers for shadow pass */
    const shadowMap = device.createTexture({
        size: [gpu.canvas.width * 2, gpu.canvas.height * 2, 1],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });

    const shadowMapSampler = device.createSampler({
        compare: "less",
        magFilter: "linear"
    });

    /* Create bind group layouts */
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

    const renderBindGroupLayout = device.createBindGroupLayout({
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

    /* Create bind groups for each object in scene */
    let objects: Array<ObjectInfo> = [];
    const vp = CreateViewProjection(gpu.canvas.width/gpu.canvas.height);
    const viewMatrix = vp.viewMatrix;
    const projectionMatrix = vp.projectionMatrix;
    const mat4x4ByteLength = 16 * 4;
    const objectStartIndices = (await vertexData).objectStartIndices;
    const modelMatrices = (await vertexData).modelMatrices;
    const numObjects = modelMatrices.length;

    for (let i = 0; i < numObjects; i++) {

        /* Create bind group and MVPBuffer for shadow pass */
        const shadowMVPMat = device.createBuffer({
            size: mat4x4ByteLength * 3,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        const shadowBuffers = [shadowMVPMat];
        const shadowPassBindGroup = await CreateBindGroup(device, shadowBindGroupLayout, shadowBuffers);

        /* Create bind group and MVPBuffer for render pass */
        const renderMVPMat = device.createBuffer({
            size: mat4x4ByteLength * 3,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
    
        // will write model matrix to this buffer at draw call
        device.queue.writeBuffer(renderMVPMat, mat4x4ByteLength * 1, viewMatrix as ArrayBuffer);
        device.queue.writeBuffer(renderMVPMat, mat4x4ByteLength * 2, projectionMatrix as ArrayBuffer);
        const buffers = [renderMVPMat, shadowMVPMat, uniformLightSrcBuffer, uniformCameraPos, uniformMaterialBuffer];
        const textures = [shadowMap];
        const samplers = [shadowMapSampler];
        const renderPassBindGroup = await CreateBindGroup(device, renderBindGroupLayout, buffers, textures, samplers);

        const startIndex = objectStartIndices[i];
        const endIndex = objectStartIndices[i+1];
        const modelMatrix = modelMatrices[i];

        objects.push({
            modelMatrix,
            shadowPassBindGroup,
            shadowMVPMat,
            renderPassBindGroup,
            renderMVPMat,
            startIndex: startIndex,
            endIndex: endIndex
        });
    }

    /* Define pipelines */
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            renderBindGroupLayout,
        ]
    });

    const renderPipeline = await CreateRenderPipeline(device, pipelineLayout, gpu.format, shader.renderPass);

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
            clearValue: { r: 0.5, g: 0.5, b: 0.8, a: 1.0 }, // background color
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

    const draw = async () => {

        /* get vertex data */
        const vertexBuffer = (await vertexData).vertexBuffer;
        const indexBuffer  = (await vertexData).indexBuffer;
        const colorBuffer  = (await vertexData).colorBuffer;
        const normalBuffer = (await vertexData).normalBuffer;

        /* get material constants */
        const material = getMaterial();
        device.queue.writeBuffer(uniformMaterialBuffer, 0, material as ArrayBuffer);

        /* update light source and VP matrices for shadow pass */
        const angle = getLightAngle();
        const height = getLightYPos();
        const lightSourcePos = vec4.fromValues(10*Math.cos(angle),height,10*Math.sin(angle),1);      // world space position of light

        let shadowVPMatrices = CreateViewProjection(1.0, 
            vec3.fromValues(lightSourcePos[0], lightSourcePos[1], lightSourcePos[2]));

        vec4.transformMat4(lightSourcePos, lightSourcePos, viewMatrix);     // view space
        device.queue.writeBuffer(uniformLightSrcBuffer, 0, lightSourcePos as ArrayBuffer);

        /* shadow pass draw call */
        const shadowCommandEncoder = device.createCommandEncoder();
        const shadowPass = shadowCommandEncoder.beginRenderPass(shadowPassDescriptor as GPURenderPassDescriptor);
        shadowPass.setVertexBuffer(0, vertexBuffer);
        shadowPass.setIndexBuffer(indexBuffer, "uint32");
        shadowPass.setPipeline(shadowPipeline);
       
 
        for (const object of objects) {
            shadowPass.setBindGroup(0, object.shadowPassBindGroup);
            device.queue.writeBuffer(object.shadowMVPMat, 0, object.modelMatrix as ArrayBuffer);
            device.queue.writeBuffer(object.shadowMVPMat, 1*mat4x4ByteLength, shadowVPMatrices.viewMatrix as ArrayBuffer);
            device.queue.writeBuffer(object.shadowMVPMat, 2*mat4x4ByteLength, shadowVPMatrices.projectionMatrix as ArrayBuffer);
            shadowPass.drawIndexed(object.endIndex - object.startIndex, 1, object.startIndex);
        }
        shadowPass.end();

        /* render pass draw call */
        const commandEncoder = device.createCommandEncoder();
        const textureView = gpu.context.getCurrentTexture().createView();
        renderPassDescriptor.colorAttachments[0].view = textureView as GPUTextureView;
        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor as GPURenderPassDescriptor);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setVertexBuffer(1, colorBuffer);
        renderPass.setVertexBuffer(2, normalBuffer);
        renderPass.setIndexBuffer(indexBuffer, "uint32");
        renderPass.setPipeline(renderPipeline);

        for (const object of objects) {
            renderPass.setBindGroup(0, object.renderPassBindGroup);
            device.queue.writeBuffer(object.renderMVPMat, 0, object.modelMatrix as ArrayBuffer);
            renderPass.drawIndexed(object.endIndex - object.startIndex, 1, object.startIndex);
        }
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
