# experiments-with-webgpu
This code serves as a first foray into the WebGPU Graphics API. I provide a simple graphics engine that runs in the browser via JavaScript. I've also provided a high-level overview of the major moving parts of a WebGPU Application.

# Features
This code provides a simple WebGPU app. It sets up a render pipeline, loads OBJs, passes vertex data and uniforms to the GPU, sets render attachments, and includes vertex and fragment shaders (see [WebGPU Overview](#Webgpu-Overview)).

From there, I went on to incorporate lighting effects, including Blinn-Phong lighting and shadow-mapping with Poisson disc sampling. 

I've also provided a simple OBJ-parser for loading in meshes. The parser is pretty basic, as it does not load in .mtl files or textures. While I would like to incorporate these features in the near-future, I've omitted them for now in the interest of getting a minimum viable product up and running. Currently, the OBJ parser is meant to load in  vertices and normals. 

# Installation
1. Download [Chrome Canary](https://www.google.com/chrome/canary/)
    - WebGPU is currently supported only in Canary, which is Google's experimental 
      release of Chrome. This may change in the future as the WebGPU API becomes more mature. 
2. Clone and enter repository with  
    - ```git clone [repo name] && cd [repo name]```
3. Install dependencies with
    - ```npm install```
4. Bundle code with 
    - ```npm run prod```
5. View the index.html
    - If you are using Visual Studio Code, you can view the index.html using the __Live Server__ Extension. 
        - After you've installed it, go to ```settings.json```
        - Change __Live Server__'s default server to Chrome Canary by including the line ```"liveServer.settings.AdvanceCustomBrowserCmdLine": "/Path/to/Chrome Canary App.app"```.
        - Navigate back to the repo and click __Go Live__ in the corner of the Visual Studio window.
    - You can also open a localhost with ```npm install http-server && npx http-server```. After running the latter command, make note of the server port. You'll see something like ```Available on: http://127.0.0.1:8080```. In your Canary Browser, open ```localhost:8080```.

# WebGPU Overview
If you're like me and you haven't worked much with Graphics APIs in the past, you might be a bit overwhelmed with the sheer number of steps required to render even a single triangle on your screen.

While there are lots of resources online that provide detailed, step-by-step instructions for setting up a WebGPU engine, but I think that these tutorials can be so detailed that they cause readers to miss the forest for the trees. Here, I'll give a high-level overview of the major pieces of a WebGPU application. What I've included below is by no means a tutorial in WebGPU - it's just meant to give readers a better idea of how all the pieces fit together.

1. [Set up a render pipeline](#set-up-a-render-pipeline)
2. [Declare input data](#declare-input-data)
    - [Declare Vertex Data](#declare-vertex-data)
    - [Declare uniform data](#declare-uniform-data)
3. [Declare pipeline outputs](#declare-pipeline-outputs)
4. [Write and include shaders](#write-and-include-shaders)
5. [Run a rendering pass](#run-a-render-pass)

## Set up a render pipeline
A __GPURenderPipeline__ does two things: it makes a promise to the GPU as to what kind of data, code, and outputs it should expect to see during rendering pass; and it tells the GPU how it should parse all of this data. The render pipeline really is just a promise. It doesn't actually provide the GPU with any data (though it does expose your shader code). The __GPURenderPipeline__ object basically makes the following promises to the GPU:

- I'm going to pass you some vertex data. 
- I'll tell you how you should read this data, and at which stage you will need that it (vertex or fragment stage). 
- I'll also tell you where to find the code (shaders) that tell you what to do with the data. 
- Lastly, I'll tell you what type out output you will write to.
- I'm not explicitly providing you with any of the input data or output targets, but I promise that it will be there when I run the render pass

The last bullet point is important. When creating the render pipeline, you tell the GPU what data and shaders it can _expect_ to see, and the output you'd like it to write to (ie. a texture), but you aren't giving the GPU any actual data or code. You are merely making a promise to the GPU that all of the data will be available by the time you've executed a render pass. 



Here is a simple example of a render pipeline:

```
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
```

While this may seem a bit overwhelming, if you take a look you'll see that all this code does is declare to the GPU what kind of data it can expect to see in its vertex and fragment stages. The vertex stage, as outlined in the ```vertex``` property,  will have buffer of vec3<float32> elements. As each of these elements in 12 bytes, we tell the GPU to iterate through the vertex buffer with stride 12. We also tell the GPU that it will have a vertex shader which we have provided through the ```module``` property. The variable `shader.vertex` holds our vertex shader as a string.

The fragment shader, as outlined in the ```fragment``` property has a fragment shader, again exposed through the ```module``` property. Lastly, we use the ```primitive``` property to tell the GPU how to group together consecutive elements of our vertex buffers. The ```triangle-list``` topology means that each consecutive triplet of three vertices defines a triangle primitive.

Note that __GPURenderPipeline__ does not tell the GPU the exact contents of the data we're passing to it. The render pipeline is indeed just an blueprint - it tells the GPU what kind of data it can expect to see, where it can access our shaders, and what kind of output the GPU is going to write to (in this case, a texture). 

One last remark: note that we have indicated a ```shaderLocation``` for our vertex data. This tells the GPU that the first shader in our pipeline, the vertex shader, will access data by reading from `location 0`. Again, this is just a promise to the GPU that there will be data at `location 0`. We have not actually attached any data to this location yet. Later on, when we create our rendering pass, we will manually attach a vertex buffer to `location 0`. Stay tuned.

## Declare input data

### Declare Vertex data
Any data that is unique to each vertex in our scene must go into a vertex buffer. This includes position data, normals, texture coordinates, etc. 

We create a buffer with ```device.createBuffer()```. If we are specifically trying to create a vertex buffer, our code would look something like:

```
let data = /* Float32Array containing all of our vertex positions */
const buffer = device.createBuffer({
            size: data.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
            mappedAtCreation: true
        });

new Float32Array(buffer.getMappedRange()).set(data);
buffer.unmap();
 return buffer;
```

We then "attach" this buffer to `location 0` in our shader code (remember that in our __GPURenderPipeline__ we made a promise that the GPU could find vertex data at this location). Peeking ahead, this looks like 

```
/* in render pass */
...
const commandEncoder = device.createCommandEncoder();
const renderPass = commandEncoder.beginRenderPass(...);
renderPass.setVertexBuffer(/* shader location */ 0, vertexBuffer);
```

### Declare uniform data
A uniform is any data that is the same for all of your vertices. This includes transformation matrices, textures, samplers (which you use to sample textures), light sources, shadow maps, etc.

The process of creating uniforms and passing them to the GPU is a bit more involved than creating and passing vertex data.

At a high level, a uniform is exposed to the GPU as  __GPUBindGroup__ entry. A __GPUBindGroup__ lets the GPU know exactly what kind of data it should expect to see. To create a __GPUBindGroup__ we must

1.  Create all the __GPUBuffers__, __GPUTextures__, __GPUSamplers__, etc. that we want to attach to the bind group. 

```
/* Create a GPUBuffer */
const modelViewProjectionMat = device.createBuffer({
    size: mat4x4ByteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

/* Create a GPUTexture */
const texture = device.createTexture({
    size: [gpu.canvas.width, gpu.canvas.height, 1],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT /* the GPU will write to this texture */
});
```

2. Create a __GPUBindGroupLayout__. This object gives the GPU a high-level look at what kind of data we are going to pass it, where that data should be visible, and the binding number we'll use to access that data in our shaders.

```
const bindGroupLayout = device.createBindGroupLayout({
    entries: [
        {
            binding: 0, 
            visibility: GPUShaderStage.VERTEX,
            buffer: {
                type: "uniform",
            } // binding for modelViewProjectionMat
        },
    ]
});
```

3. Create a __GPUBindGroup__ using the __GPUBindGroupLayout__. Add whatever __GPUBuffers__ we've created to the __GPUBindGroup__ as "entries". 

```
let entries = []
entries.push({
    binding: 0,
    resource: {
        buffer: modelViewProjectionMat,
        offset: 0,
        size: modelViewProjectionMat.size
    }
});

const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: entries
})
```

I know, this is a bit much, especially given that __GPUBindGroupLayout__ and __GPUBindGroup__ contain very similar information, and they have to match _perfectly_. Otherwise, WebGPU will error messages at you.

I think it still helps to remember that a __GPUBindGroup__, like __GPURenderPipelines__ is really just a promise to the GPU. We haven't actually loaded any data into the __GPUBuffers__. We are one again just promising to the GPU

- In this bind group, you'll find a collection of uniforms, textures, whatever. 
- You can find uniform data in these __GPUBuffer__ objects, but I haven't necessarily loaded any data into them yet. I promise it'll be there by the time I've run my render pass. 
- I've also told you the binding number of each entry in this bind group. This way, if my shader accesses a uniform with a binding number 0, for instance, you'll exactly which uniform my code is referring to.

Note that we have created the bind group, but we haven't told the GPU how to find it. In other words, our shaders do not know yet how to access this bind group. It's sort of just floating out in the ether for now. We'll "attach" this bind group to our shader during the render pass.

### So when do we actually put data into the __GPUBuffer__? 
It depends. If this data is going to change on each frame, then you'll want to update the __GPUBuffer__ before each render pass. This would be the case if you have anything in your scene that is dynamic, such as a moving object or light source. On the other hand, if the data is not going to change, then you can write to the __GPUBuffer__ before starting your render loop. In either case, you'd want to use the function `device.writeBuffer()`.


## Declare pipeline outputs
We now have to tell the GPU where we want it to write all of its results. We refer to these output locations as "attachments". An attachment will hold a texture to write to, along with some extraneous settings like the texture's "clear value". For a simple render pass, we'd have two attachments: a depth stencil attachment for depth testing, and a color attachment for our render.

```
const renderPassDescriptor = {
    colorAttachments: [{
        view: gpu.context.getCurrentTexture().createView(),
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
```

Remember that your WebGPU context will create a new texture each time a your screen refreshes. The above code will not technically work, since the WebGPU context's current texture will change over time. The solution is fairly straightforward:

```
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

/* ... */

/* In render pass */
const textureView = gpu.context.getCurrentTexture().createView();
renderPassDescriptor.colorAttachments[0].view = textureView as GPUTextureView;
```


## Write and include shaders
While shaders themselves are quite difficult to write, attaching them to your application is very straightforward. In fact, we actually already did it when creating our __GPURenderPipeline__. Take a look at that [section](#set-up-a-render-pipeline) and you'll see that we used the `device.createShaderModule()` function, passing in a variable called `shader.vertex` or `shader.fragment`, which hold our shader code as a string.

## Run a render pass
Everything comes together here. If you're working with a screen that refreshes and not just writing to an image to disk, you'll want to wrap your render pass in a loop:

```
function draw() {
    
    // 1. Create a GPUCommandEncoder 
    const commandEncoder = device.createCommandEncoder();

    /* code from previous steps */
    const textureView = gpu.context.getCurrentTexture().createView();
    renderPassDescriptor.colorAttachments[0].view = textureView as GPUTextureView; 
 
    // 2. Use the __GPUCommandEncoder__ to begin a __GPURenderPassEncoder__. 
    const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor as GPURenderPassDescriptor);

    // 3. Attach our render pipeline
    renderPass.setPipeline(renderPipeline);

    // 4. Attach our vertex buffers 
    renderPass.setVertexBuffer(0, vertexBuffer);   

    // 5. Set bind groups
    renderPass.setBindGroup(0, bindGroup);

    // 6. Issue a draw call
    renderPass.draw(...);

    // 7. Submit command to GPU
    device.queue.submit([commandEncoder.finish()]);

    // 8. Loop
    requestAnimationFrame(draw)
}
```

Make note of point 4. Up until this point, we've declared to the GPU that there will be a buffer at `location 0`, and we've created a vertex buffer and populated it with data. During the render pass, we are finally fulfilling our promise to the GPU by providing it with a vertex buffer at `location 0`.

There are a lot more steps, but this is the high-level idea of how the major pieces of WebGPU fit together.
