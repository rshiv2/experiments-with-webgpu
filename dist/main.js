/*
Coordinate system (reference):
    - Origin of coordinate system is the upper left corner
    - Each cell has a horizontal (u) and vertical (v) velocity 
        - u is located at the midpoint of the cell's left edge
        - v is located at the midpoint of the cell's bottom edge
        - The positive u direction points to the right
        - The positive v direction points downwards

*/

// ----------------- Classes / Constants -----------------------
const SOLID = 0;
const FLUID = 1;
const AIR = 2;

class Cell {
    constructor(cellDescriptor = null) {
        let cellDescriptorHas = (key) => { return cellDescriptor !== null && key in cellDescriptor};

        if (!cellDescriptorHas("x") || !cellDescriptorHas("y")) {
            throw new Error("Cell Descriptor requires an (x,y) position");
        }

        this.x = cellDescriptor["x"];                                               // x position
        this.y = cellDescriptor["y"];                                               // y position
        this.z = cellDescriptorHas("z") ? cellDescriptor["z"] : 0;                  // z position (not strictly required for 2D)
        this.u = cellDescriptorHas("u") ? cellDescriptor["u"] : 0;                  // horizontal velocity at left edge of cell (cells / second)  
        this.v = cellDescriptorHas("v") ? cellDescriptor["v"] : 0;                  // vertical velocity at bottom edge of cell (cells / second)
        this.type = cellDescriptorHas("type") ? cellDescriptor["type"] : SOLID;     // occupancy (0 = solid, 1 = fluid, 2 = air)
        this.d = cellDescriptorHas("d") ? cellDescriptor["d"] : 0;                  // density
        this.div = cellDescriptorHas("div") ? cellDescriptor["div"] : 0;            // divergence

        this.uTemp = 0;     // temporary storage for new horizontal velocities
        this.vTemp = 0;     // temporary storage for new vertical velocities
        this.dTemp = 0;     // temporary storage for new densities

    }

    get = (member) => {
        switch (member) {
            case "x": return this.x;
            case "y": return this.y;
            case "z": return this.z;
            case "u": return this.u;
            case "v": return this.v;
            case "d": return this.d;
            case "div": return this.div;
            case "type": return this.type;
            default: throw new Error("Class 'Grid' does not have member variable '" + member + "'");
        }
    }

    set = (member, value) => {
        switch (member) {
            case "x":
            case "y":
            case "z": throw new Error("Cannot modify position of cell");
            case "u": this.u = value; break;
            case "v": this.v = value; break;
            case "d": this.d = value; break;
            case "div": this.div = value; break;
            case "type": this.type = value; break;
            default: throw new Error("Class 'Grid' does not have member variable '" + member + "'");
        }
    }
}

class Obstacle {
    constructor(x, y, r) {
        this.x = x;
        this.y = y;
        this.r = r;
    }

    contains(x, y) {
        return (x - this.x)**2 + (y - this.y)**2 <= this.r**2;
    }
}

class Grid {
    constructor(resX, resY, dt) {
        let canvas = document.getElementById('canvas-webgpu');
        this.pixelsPerCell = canvas.width / resX,
        this.cellsPerPixel = 1.0 / this.pixelsPerCell,            
        this.dt = dt;

        // Environment bounds
        this.minX = 0;
        this.maxX = resX;
        this.minY = 0;
        this.maxY = resY;
    
        this.obstacle = new Obstacle(0.3*this.maxX, 0.5*this.maxY, 0.04*this.maxX);
        this.cells = new Map();
    
        this.init();
    }

    init = () => {

        // Initialize cells to default values
        const maxSpeed = 100;
        let r = this.maxY;
        let c = this.maxX;
        let pipeWidth = r / 10;

        // Upper + lower boundary
        for (var x = 0; x < c; x++) {
            let cellDescriptor = {
                x: x,
                y: 0,
                type: SOLID
            }
            this.addCell(new Cell(cellDescriptor));

            cellDescriptor["y"] = this.maxY - 1;
            this.addCell(new Cell(cellDescriptor));

        }

        // Left + right boundary
        for (var y = 0; y < r; y++) {
            let cellDescriptor = {
                x: 0,
                y: y,
                d: (y > 0.5*(r - pipeWidth) && y < 0.5*(r + pipeWidth)),
                type: SOLID
            }
            this.addCell(new Cell(cellDescriptor));

            cellDescriptor["d"] = 0;
            cellDescriptor["x"] = this.maxX-1;
            this.addCell(new Cell(cellDescriptor));
        }

        // Middle of grid (set all to fluid for now)
        // TODO: In later versions, only set to fluid if the cell contains a marker particle
        for (var y = 1; y < r-1; y++) {
            for (var x = 1; x < c-1; x++) {

                let cellDescriptor = {
                    x: x,
                    y: y,
                    u: (x == 1) * maxSpeed,
                    v: 0,
                    type: FLUID,
                    d: 0
                }
                
                this.addCell(new Cell(cellDescriptor));
            }
        }
    
        this.setObstacle(this.obstacle.x, this.obstacle.y, this.obstacle.r);
    }

    hashFunc = (x, y, z) => {
        return 541*x + 79*y + 31*z;
    }
    addCell = (cellDescriptor) => {
        // add cell with upper left corner (2D case) at (x, y, z)
        let key = this.hashFunc(cellDescriptor["x"], cellDescriptor["y"], 0);
        this.cells.set(key, new Cell(cellDescriptor));
    }

    deleteCell = (x, y, z = 0) => {
        let key = this.hashFunc(x,y,z);
        return this.cells.delete(key);
    }

    getCellAt = (x, y, z = 0) => {
        let key = this.hashFunc(x,y,z);
        return this.cells.get(key);
    }

    hasCellAt = (x, y, z = 0) => {
        let key = this.hashFunc(x,y,z);
        return this.cells.has(key);
    }
    
    clearObstacle = () => {
        let x = this.obstacle.x;
        let y = this.obstacle.y;
        let r = this.obstacle.r;

        for (var i = y - r; i < y + r; i++) {
            for (var j = x - r; j < x + r; j++) {
                let inBounds = i > 0 && j > 0 && i < this.maxY-1 && j < this.maxX-1;
                if (inBounds && ((i-y)**2 + (j-x)**2 < r**2)) {

                    // TODO: grid is currently either fluid or solid
                    //          in later version, just delete the cell, don't create
                    //          a new fluid cell in its place
                    this.getCellAt(j, i).type = FLUID;
                }
            }
        }
    }

    setObstacle = (x, y, r) => {
        x = Math.floor(x);
        y = Math.floor(y);
        r = Math.ceil(r);

        let vx = (x - this.obstacle.x) / this.dt;   // horizontal velocity of obstacle 
        let vy = (y - this.obstacle.y) / this.dt;   // vertical velocity of obstacle    

        // mark new obstacle cells as occupied
        this.obstacle.x = x;
        this.obstacle.y = y;
        this.obstacle.r = r;
        for (var i = y - r; i < y + r; i++) {
            for (var j = x - r; j < x + r; j++) {
                let inBounds = i > 0 && j > 0 && i < this.maxY-1 && j < this.maxX-1;
                if (inBounds && ((i-y)**2 + (j-x)**2 < r**2)) {
                    let cellDescriptor = {
                        x: j,
                        y: i,
                        type: SOLID,
                        u: vx,
                        v: vy,
                        d: 0
                    }

                    this.addCell(cellDescriptor);
                }
            }
        }
    }
}

// ----------------- Rendering to screen ---------------------

function clearGrid(grid) {
    const canvas = document.getElementById("canvas-webgpu");
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawGrid(grid) {
    const canvas = document.getElementById("canvas-webgpu");
    const context = canvas.getContext("2d");
    context.beginPath();

    let drawVelocityChecked = document.getElementById("velocity").checked;
    let drawOccupancyChecked = document.getElementById("occupancy").checked;
    let drawDensityChecked = document.getElementById("density").checked;

    let drawVector = (context, color, fromx, fromy, tox, toy) => {

        var prevStrokeStyle = context.strokeStyle;
        context.strokeStyle = color;
        var headlen = 10; // length of head in pixels
        var dx = tox - fromx;
        var dy = toy - fromy;
        var angle = Math.atan2(dy, dx);
        context.moveTo(fromx, fromy);
        context.lineTo(tox, toy);
        context.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
        context.moveTo(tox, toy);
        context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
        context.stroke();
        context.strokeStyle = prevStrokeStyle;

    }

    let h = grid.pixelsPerCell;
    for (var i = 0; i < grid.maxY; i++) {
        for (var j = 0; j < grid.maxX; j++) {

            // skip cell if its corners go off the canvas
            if ((i+1)*h > canvas.height || (j+1)*h > canvas.width)
                continue;

            // draw cell
            let fillColor;
            if (!grid.hasCellAt(j, i)) {
                fillColor = 'rgb(255,255,255)';     // air
            } 

            let cell = grid.getCellAt(j, i);
            if (drawOccupancyChecked && cell.type == SOLID) {
                fillColor = 'rgb(0,0,0)';       // solid
            } else if (drawDensityChecked && cell.type == FLUID) {
                let c = (1 - cell.d) * 255;
                fillColor = 'rgb(' + c + ',' + c + ',' + c + ')';
            } 

            context.fillStyle = fillColor
            context.fillRect(j*h, i*h, h, h);

            // draw velocity vectors
            if (drawVelocityChecked && cell.type == FLUID) {

                let u = cell.u;
                let v = cell.v;

                let scaleFactor = 5;                            // scale vector for easier visualization   
                u *= scaleFactor;
                v *= scaleFactor;
                
                // horizontal velocity
                drawVector(context, color = "blue", fromx = j*h, fromy = i*h + h*0.5, tox = j*h + u, toy = i*h + h*0.5);
                
                // vertical velocity
                drawVector(context, color = "blue", fromx = j*h + 0.5*h, fromy = (i+1)*h, tox = j*h + 0.5*h, toy = (i+1)*h + v);
            
            }

        }
    }
    
}

// -------------- Fluid simulation ----------------

function step(grid, dt = 0.1) {
    
    let applyExternalForces = (dt) => {
        let c = grid.maxX;
        let r = grid.maxY;
        let gravity = 9.8;

        for (const cell of grid.cells.values()) {
            if (cell.type == SOLID || cell.type == AIR) {
                continue;
            }   // skip solid and empty cells

            let x = cell.x;
            let y = cell.y;


            let cellBelow = grid.getCellAt(x, y+1);   // positive y direction points downward
            if (cellBelow?.type != SOLID) {
                cell.v += gravity * dt;
            }

        }
    }

    let solveGrid = (iters = 50) => {
        let c = grid.maxX;
        let r = grid.maxY;

        let eps = 1e-7;
        let totalDiv;
        let retrievalTime = 0; 
        for (var it = 0; it < iters; it++) {
            totalDiv = 0;
            for (const cell of grid.cells.values()) {
                if (cell.type != FLUID) {
                    continue;
                }
                let x = cell.x;
                let y = cell.y;
                
                let cellRight = grid.getCellAt(x+1, y);
                let cellLeft = grid.getCellAt(x-1, y);
                let cellAbove = grid.getCellAt(x, y-1);
                let cellBelow = grid.getCellAt(x, y+1);

                let divergence = cellRight.u - cell.u + cell.v - cellAbove.v;
                cell.div = divergence;
                totalDiv += divergence;

                let s = Boolean(cellBelow.type) + Boolean(cellAbove.type)
                        + Boolean(cellLeft.type) + Boolean(cellRight.type);
                
                if (s == 0)
                    continue;

                cell.u += divergence * Boolean(cellLeft.type) / s;
                cell.v -= divergence * Boolean(cellBelow.type) / s;
                cellRight.u -= divergence * Boolean(cellRight.type) / s;
                cellAbove.v += divergence * Boolean(cellAbove.type) / s;
            }

            if (Math.abs(totalDiv) < eps) {
                break;
            }   // break if total divergence is sufficiently small
        }
        console.log("solver retrieval time: " + retrievalTime);
    }

    function extrapolateBoundary(grid, property) {

        let r = grid.maxY;
        let c = grid.maxX;

        // set corner values equal to value of closest cell
        grid.getCellAt(0,0).set(property, grid.getCellAt(1,1).get(property));
        grid.getCellAt(0,r-1).set(property, grid.getCellAt(1,r-2).get(property));
        grid.getCellAt(c-1,0).set(property, grid.getCellAt(c-2,1).get(property));
        grid.getCellAt(c-1,r-1).set(property, grid.getCellAt(c-2,r-2).get(property));

        // set remaining boundary values equal to value of closest cell
        for (var j = 1; j < grid.maxX - 1; j++) {
            grid.getCellAt(j,0).set(property, grid.getCellAt(j,1).get(property));
            grid.getCellAt(j,r-1).set(property, grid.getCellAt(j,r-2).get(property));
        }

        for (var i = 1; i < grid.maxY - 1; i++) {
            grid.getCellAt(0,i).set(property, grid.getCellAt(1,i).get(property));
            grid.getCellAt(c-1,i).set(property, grid.getCellAt(c-2,i).get(property));
        }
    }

    function bilerp(x, y, grid, property) {

        // Bilinear interpolation of grid property at (x,y)
        x = Math.max(Math.min(x, grid.maxX-1.5), 0.5);
        y = Math.max(Math.min(y, grid.maxY-1.5), 0.5);

        let x0, y0;
        switch (property) {
            case "u":                   // horizontal velocity
                x0 = Math.floor(x);
                y0 = Math.round(y) - 0.5;
                break;
            case "v":                  // vertical velocity
                x0 = Math.round(x) - 0.5;
                y0 = Math.floor(y);
                break;
            case "d":                   // density
                x0 = Math.round(x) - 0.5;
                y0 = Math.round(y) - 0.5;
                break;
            default:
                throw new Error("Unable to interpolate grid property '" + property + "'. Invalid property.");
        }

        let x1 = x0 + 1;
        let y1 = y0 + 1;

        let tx = (x - x0) / (x1 - x0);
        let ty = (y - y0) / (y1 - y0);
        
        let i = property == "v" ? Math.floor(y0) - 1 : Math.floor(y0);
        let j = Math.floor(x0);

        let ret;
        ret = (1 - ty) * ((1 - tx) * grid.getCellAt(j, i).get(property) + tx * grid.getCellAt(j+1,i).get(property))
                    + ty * ((1-tx) * grid.getCellAt(j,i+1).get(property) + tx * grid.getCellAt(j+1,i+1).get(property));
        return ret;
    }

    function advectVelocity(dt) {

        let r = grid.maxY;
        let c = grid.maxX;

        for (const cell of grid.cells.values()) {
            if (cell.type != FLUID) {
                continue;
            }   // skip solid and air cells
            let position = [cell.x, cell.y];
            let cellBelow = grid.getCellAt(position[0], position[1]+1);
            let cellAbove = grid.getCellAt(position[0], position[1]-1);
            let cellLeft = grid.getCellAt(position[0]-1, position[1]);
            let cellRight = grid.getCellAt(position[0]+1, position[1]);
            let cellUpperLeft = grid.getCellAt(position[0]-1,position[1]-1);
            let cellLowerRight = grid.getCellAt(position[0]+1, position[1]+1);

            // get new horizontal velocity for cell
            {
                // get position of velocity vector
                let x = position[0];  
                let y = position[1] + 0.5; // horizontal velocity defined at left edge of cell

                // compute horizontal and vertical velocity at position
                let s = Boolean(cellLeft.type) + Boolean(cellUpperLeft.type) + Boolean(cellAbove.type) + Boolean(cell.type);
                let u = cell.u;
                let v = (cellLeft.v * Boolean(cellLeft.type)
                        + cellUpperLeft.v * Boolean(cellUpperLeft.type)
                        + cellAbove.v * Boolean(cellAbove.type)
                        + cell.v * Boolean(cell.type)) / s;
                
                // compute position one timestep back
                x -= u * dt;
                y -= v * dt;

                cell.uTemp = bilerp(x, y, grid, "u");
            }

            // get new vertical velocity for cell
            {
                // get position of velocity vector
                let x = position[0] + 0.5;
                let y = position[1] + 1;  // vertical velocity defined at bottom edge of cell 

                // compute horizontal and vertical velocity at position
                let s = Boolean(cell.type) + Boolean(cellBelow.type) + Boolean(cellRight.type) + Boolean(cellLowerRight.type);
                let u = (cell.u * Boolean(cell.type)
                        + cellRight.u * Boolean(cellRight.type)
                        + cellBelow.u * Boolean(cellBelow.type)
                        + cellLowerRight.u * Boolean(cellLowerRight.type)) / s;
                let v = cell.v;

                // compute position one timestep back
                x -= dt * u;
                y -= dt * v;
                cell.vTemp = bilerp(x, y, grid, "v");
            }
        }
  
        for (const cell of grid.cells.values()) {
            if (cell.type == FLUID) {
                cell.u = cell.uTemp;
                cell.v = cell.vTemp;
            }
        }  
    }

    function advectDensity(dt) {

        for (const cell of grid.cells.values()) {

            if (cell.type != FLUID) {
                continue;
            }

            let cellRight = grid.getCellAt(cell.x+1, cell.y);
            let cellAbove = grid.getCellAt(cell.x, cell.y-1);

            let x = cell.x + 0.5;  // density defined at center of cell
            let y = cell.y + 0.5;  // density defined at center of cell

            // compute velocity at center of cell
            let u = (cell.u + cellRight.u) * 0.5;
            let v = (cellAbove.v + cell.v) * 0.5;

            // compute position one timestep back
            x -= u * dt;
            y -= v * dt;

            // compute density at previous position
            cell.dTemp = bilerp(x, y, grid, "d");
        }

        for (const cell of grid.cells.values()) {
            if (cell.type == FLUID) {
                cell.d = cell.dTemp;
            }
        }
    }
    
    applyExternalForces(dt);
    // grid.setObstacle(grid.obstacle.x, grid.obstacle.y, grid.obstacle.r);
    solveGrid(iters=30);
    extrapolateBoundary(grid, "u");   // extrapolate horizontal velocity to boundary cells
    advectVelocity(dt);
    advectDensity(dt);
}

let grid = new Grid(160, 160, dt = 1.0 / 30);
drawGrid(grid);

// ----------- HTML / Interactivity ----------------------
let stepButton = document.getElementById("step"); 
stepButton.addEventListener("click", () => { 
    step(grid, dt=grid.dt);
    cnt++;
    console.log(cnt);
    clearGrid(grid); 
    drawGrid(grid); 
});

// Show grid propertys (ie. velocity vectors, density, etc)
const gridProperties = document.getElementsByClassName("grid-property");
for (var i = 0; i < gridProperties.length; i++) {
    gridProperties[i].onclick = () => { 
        clearGrid(grid);
        drawGrid(grid); 
};
}

// Reset button
document.getElementById("reset").onclick = () => {
    let numX = grid.maxX;
    let numY = grid.maxY;
    grid = new Grid(numX, numY, dt = 1.0 / 30);
    clearGrid(grid);
    drawGrid(grid);
}

// Play / pause
let play = false;
let playButton = document.getElementById("play")
playButton.addEventListener("click", () => {
    playButton.innerHTML = play ? "Play" : "Pause";
    play = !play;
    stepButton.disabled = play;
});

// ------------ Mouse Events --------------------
let obstacleClicked = false;
let canvas = document.getElementById("canvas-webgpu");
let rect = canvas.getBoundingClientRect();

canvas.addEventListener('mousedown', (event) => {
    let x = (event.x - rect.left) * grid.cellsPerPixel;
    let y = (event.y - rect.top) * grid.cellsPerPixel;
    obstacleClicked = grid.obstacle.contains(x,y);
    console.log(x, y);
});

canvas.addEventListener('mousemove', (event) => {
    let x = (event.x - rect.left) * grid.cellsPerPixel;
    let y = (event.y - rect.top) * grid.cellsPerPixel;
    if (obstacleClicked) {  
        grid.clearObstacle();
        grid.setObstacle(x, y, r = grid.obstacle.r);
    }
});

canvas.addEventListener('mouseup', () => {
    obstacleClicked = false;
});

// --------------------------------------------

// Animation loop
let cnt = 0;
function animate() {
    if (play) {
        cnt++;
        clearGrid(grid);
        step(grid, dt=grid.dt);
        drawGrid(grid);
        console.log(cnt);
    }
    window.requestAnimationFrame(animate);
}
window.requestAnimationFrame(animate);

// Log frame rate to console
// window.setInterval(() => { console.log(cnt); /*cnt = 0;*/ }, 1000);
