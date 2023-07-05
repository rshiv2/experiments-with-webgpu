import $ from 'jquery';
import { InitGPU, CreateGPUBuffer } from './helper';
import { Shaders } from './shaders';

const CreateSquare = async () => {
    const gpu = await InitGPU();
    const device = gpu.device;

    const vertexData = new Float32Array([
        -0.5, -0.5,
        0.5, -0.5,
        -0.5, 0.5,
        -0.5, 0.5,
        0.5, -0.5,
        0.5, 0.5,
    ]);

    const colorData = new Float32Array([
        1, 0, 0,
        0, 1, 0,
        1, 1, 0,
        1, 1, 0,
        0, 1, 0,
        0, 0, 1,
    ]);

    const vertexBuffer = CreateGPUBuffer(device, vertexData);
    const colorBuffer = CreateGPUBuffer(device, colorData);
    
    const shader = Shaders();
    const pipeline = device.createRenderPipeline({
        layout:'auto',
        vertex: {
            module: device.createShaderModule({                    
                code: shader.vertex,
            }),
            entryPoint: "main",
            buffers: [
                {
                    arrayStride: 8,
                    attributes: [{
                        shaderLocation: 0,
                        format: "float32x2",
                        offset: 0
                    }]
                },
                {
                    arrayStride: 12,
                    attributes: [{
                        shaderLocation: 1,
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
                format: gpu.format as GPUTextureFormat
            }]
         },
        primitive:{
           topology: "triangle-list", 
        }
    });

    const commandEncoder = device.createCommandEncoder();
    const textureView = gpu.context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: textureView,
            clearValue: { r: 0.5, g: 0.5, b: 0.8, a: 1.0 }, //background color
            loadOp: 'clear',
            storeOp: 'store'
        }]
    });
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setVertexBuffer(1, colorBuffer);
    renderPass.setPipeline(pipeline);
    renderPass.draw(6);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
}

CreateSquare();