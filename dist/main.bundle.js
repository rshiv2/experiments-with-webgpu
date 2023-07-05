(()=>{"use strict";const e=(e,t,n=GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST)=>{const o=e.createBuffer({size:t.byteLength,usage:n,mappedAtCreation:!0});return new Float32Array(o.getMappedRange()).set(t),o.unmap(),o},t=()=>{return e=void 0,t=void 0,o=function*(){var e;const t=(()=>{let e="Great, your current browser supports WebGPU!";return navigator.gpu||(e='Your current browser does not support WebGPU! Make sure you are on a system \n        with WebGPU enabled. Currently, WebGPU is supported in  \n        <a href="https://www.google.com/chrome/canary/">Chrome canary</a>\n        with the flag "enable-unsafe-webgpu" enabled. See the \n        <a href="https://github.com/gpuweb/gpuweb/wiki/Implementation-Status"> \n        Implementation Status</a> page for more details.   \n        You can also use your regular Chrome to try a pre-release version of WebGPU via\n        <a href="https://developer.chrome.com/origintrials/#/view_trial/118219490218475521">Origin Trial</a>.                \n        '),e})();if(t.includes("Your current browser does not support WebGPU!"))throw console.log(t),t;const n=document.getElementById("canvas-webgpu"),o=yield null===(e=navigator.gpu)||void 0===e?void 0:e.requestAdapter(),r=yield null==o?void 0:o.requestDevice(),a=n.getContext("webgpu"),i=navigator.gpu.getPreferredCanvasFormat();return a.configure({device:r,format:i,alphaMode:"opaque"}),{device:r,canvas:n,format:i,context:a}},new((n=void 0)||(n=Promise))((function(r,a){function i(e){try{c(o.next(e))}catch(e){a(e)}}function u(e){try{c(o.throw(e))}catch(e){a(e)}}function c(e){var t;e.done?r(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t)}))).then(i,u)}c((o=o.apply(e,t||[])).next())}));var e,t,n,o};var n,o;o=function*(){const n=yield t(),o=n.device,r=new Float32Array([-.5,-.5,.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,.5]),a=new Float32Array([1,0,0,0,1,0,1,1,0,1,1,0,0,1,0,0,0,1]),i=e(o,r),u=e(o,a),c="\n        struct Output {\n            @builtin(position) Position : vec4<f32>,\n            @location(0) vColor : vec4<f32>,\n        };\n\n        @vertex\n        fn main(@location(0) pos: vec4<f32>, @location(1) color: vec4<f32>) -> Output {\n            var output: Output;\n            output.Position = pos;\n            output.vColor = color;\n            return output;\n        } \n    ",s="\n        @fragment\n        fn main(@location(0) vColor: vec4<f32>)-> @location(0) vec4<f32> {\n            return vColor;\n        }\n    ",l=o.createRenderPipeline({layout:"auto",vertex:{module:o.createShaderModule({code:c}),entryPoint:"main",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,format:"float32x2",offset:0}]},{arrayStride:12,attributes:[{shaderLocation:1,format:"float32x3",offset:0}]}]},fragment:{module:o.createShaderModule({code:s}),entryPoint:"main",targets:[{format:n.format}]},primitive:{topology:"triangle-list"}}),f=o.createCommandEncoder(),p=n.context.getCurrentTexture().createView(),d=f.beginRenderPass({colorAttachments:[{view:p,clearValue:{r:.5,g:.5,b:.8,a:1},loadOp:"clear",storeOp:"store"}]});d.setVertexBuffer(0,i),d.setVertexBuffer(1,u),d.setPipeline(l),d.draw(6),d.end(),o.queue.submit([f.finish()])},new((n=void 0)||(n=Promise))((function(e,t){function r(e){try{i(o.next(e))}catch(e){t(e)}}function a(e){try{i(o.throw(e))}catch(e){t(e)}}function i(t){var o;t.done?e(t.value):(o=t.value,o instanceof n?o:new n((function(e){e(o)}))).then(r,a)}i((o=o.apply(void 0,[])).next())}))})();
//# sourceMappingURL=main.bundle.js.map