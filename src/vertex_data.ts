import { getRandomValues } from "crypto";


export const ReadOBJ = async (fname: string) => {

    const response = await fetch(fname);
    const obj = await response.text();
    const lines = obj.split("\n");

    let vertexData = [];
    let indexData = [];
    let normalData = [];
    let uvData = [];
    let indexMap = new Map();    // if array[i] = [j,k], then vertex i uses normals j,k 
   
    // collect vertex, normal, and index data from file
    for (const untrimmedLine of lines) {
        const line = untrimmedLine.trim().replace(/\s+/g, " "); // remove extra whitespace
        const [startingChar, ...data] = line.split(" ");
        
        if (startingChar === "v") {
            for (let i = 0; i < 3; i++) 
                vertexData.push(parseFloat(data[i]));
        } else if (startingChar === "vn") {
            for (let i = 0; i < 3; i++)
                normalData.push(parseFloat(data[i]));
        } else if (startingChar === "vt") {
            for (let i = 0; i < 3; i++) {
                uvData.push(parseFloat(data[i]));
            }
        } else if (startingChar === "f") {
            for (let i = 0; i < 3; i++) {

                // face element formated as vertIndex/uvIndex/normalIndex
                const indices = data[i].split("/"); 

                // extract vertIndex
                const vertIndex = parseInt(indices[0]);
                indexData.push(vertIndex);

                // add (vertIndex, normalIndex) as key-value pair to indexMap
                if (indices.length == 3) { 
                    const normalIndex = parseInt(indices[2]);
                    if (indexMap.has(vertIndex)) {
                        indexMap.get(vertIndex).push(normalIndex);
                    } else {
                        indexMap.set(vertIndex, [normalIndex]);
                    }
                }
            }
        }
    }

    let vertices = new Float32Array(vertexData);
    let normalDataF32 = new Float32Array(normalData);
    let indices = new Uint32Array(indexData);

    // index data must be 0-indexed
    for (let i = 0; i < indices.length; i++) {
        indices[i] -= 1;
    }

    // assign per-vertex normals
    let normals = new Float32Array(vertexData.length);
    for (let i = 0; i < normals.length; i++) {
        normals[i] = 0;
    }

    indexMap.forEach((normalIndices, vertIndex, map) => {
        vertIndex -= 1;     // OBJ indices are 1-indexed, javascript wants 0-indexed

        for (let i = 0; i < normalIndices.length; i++) {
            const normalIndex = normalIndices[i] - 1;

            normals[3*vertIndex]   += normalDataF32[3*normalIndex];
            normals[3*vertIndex+1] += normalDataF32[3*normalIndex+1];
            normals[3*vertIndex+2] += normalDataF32[3*normalIndex+2];
        }

        for (let i = 0; i < 3; i++)
            normals[3*vertIndex+i] /= normalIndices.length; // average
    });

    // assign constant color (green)
    const colors = new Float32Array(vertexData.length);
    for (let i = 0; i < colors.length; i+=3) {
        colors[i]   = 0;
        colors[i+1] = 0;
        colors[i+2] = 1;
    }

    return {
        vertices, 
        indices,
        colors,
        normals,
    }

}

export const FloorData = () => {

    const vertices = new Float32Array([
        -10, -1,  10,
         10, -1,  10,
         10, -1, -10,
        -10, -1, -10
    ]);

    let colors = new Float32Array([
        66, 245, 111,
        66, 245, 111,
        66, 245, 111,
        66, 245, 111,
    ]);

    const normals = new Float32Array([
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
    ]);

    const indices = new Uint32Array([
        0, 1, 2,
        2, 3, 0
    ])

    for (let i = 0; i < colors.length; i++) 
        colors[i] /= 255;

    return { vertices, indices, colors, normals };
}

export const CubeData = () =>{
    
    const vertices = new Float32Array([
        1, -1, -1,
        1, -1,  1,
       -1, -1,  1,
       -1, -1, -1,
        1,  1, -1,
        1,  1,  1,
       -1,  1,  1,
       -1,  1, -1
    ]);

    const indices = new Uint32Array([
        1, 2, 3,
        7, 6, 5,
        4, 5, 1,
        5, 6, 2,
        2, 6, 7,
        0, 3, 7,
        0, 3, 7,
        0, 1, 3,
        4, 7, 5,
        0, 4, 1,
        1, 5, 2,
        3, 2, 7,
        4, 0, 7
    ]);


    const normals = new Float32Array([
        1, -1, -1,
        1, -1,  1,
       -1, -1,  1,
       -1, -1, -1,
        1,  1, -1,
        1,  1,  1,
       -1,  1,  1,
       -1,  1, -1
    ]);

    const colors = new Float32Array([
        0, 0, 1,    // blue
        1, 0, 0,    // red
        1, 1, 0,    // yellow
        0, 1, 1,    // aqua 
        0, 1, 0,    // green
        1, 0, 1,    // fuchsia
        0, 0, 1,    // blue
        1, 0, 0,    // red
    ]);

    return {
        vertices,
        indices,
        colors,
        normals
    };
}