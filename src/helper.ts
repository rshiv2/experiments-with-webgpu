export const CheckWebGPU = () => {
    let result = "Great, your current browser supports WebGPU!";

    if (!navigator.gpu) {
        result = `Your current browser does not support WebGPU! Make sure you are on a system 
        with WebGPU enabled. Currently, WebGPU is supported in  
        <a href="https://www.google.com/chrome/canary/">Chrome canary</a>
        with the flag "enable-unsafe-webgpu" enabled. See the 
        <a href="https://github.com/gpuweb/gpuweb/wiki/Implementation-Status"> 
        Implementation Status</a> page for more details.   
        You can also use your regular Chrome to try a pre-release version of WebGPU via
        <a href="https://developer.chrome.com/origintrials/#/view_trial/118219490218475521">Origin Trial</a>.                
        `;
    } 

    return result;
}

export const CreateGPUBuffer = (device : GPUDevice, data:Float32Array,
    usageFlag : GPUBufferUsageFlags = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST) => {
        const buffer = device.createBuffer({
            size: data.byteLength,
            usage: usageFlag,
            mappedAtCreation: true
        });
        new Float32Array(buffer.getMappedRange()).set(data);
        buffer.unmap();
        return buffer;
    }

export const InitGPU = async() => {
    const checkgpu = CheckWebGPU();
    if (checkgpu.includes("Your current browser does not support WebGPU!")) {
        console.log(checkgpu);
        throw(checkgpu);
    }

    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice() as GPUDevice;
    const context = canvas.getContext('webgpu') as unknown as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device: device,
        format: format,
        alphaMode:'opaque'
    });

    return { device, canvas, format, context };
    
}