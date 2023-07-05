/*
Coordinate system (reference):
    - Grid is stored in row-major order
    - Origin of coordinate system and of grid arrays is the upper left corner
    - Each cell has a horizontal (u) and vertical (v) velocity 
        - u is located at the midpoint of the cell's left edge
        - v is located at the midpoint of the cell's bottom edge
        - The positive u direction points to the right
        - The positive v direction points downwards

*/

// ----------------- Classes -----------------------
class Grid  {
    constructor(numX, numY, h, dt) {
        let canvas = document.getElementById('canvas-webgpu');
        this.numX = numX,                                         // number of cells in x direction
        this.numY = numY,                                         // number of cells in y direction
        this.pixelsPerCell = canvas.width / this.numX,
        this.cellsPerPixel = 1.0 / this.pixelsPerCell,            
        this.h = h,                                               // physical length of cell
        this.dt = dt;

        this.u = new Float32Array(this.numX * this.numY),         // horizontal velocity  
        this.v = new Float32Array(this.numX * this.numY),         // vertical velocity
        this.s = new Float32Array(this.numX * this.numY),         // occupancy (0 = filled, 1 = empty)
        this.d = new Float32Array(this.numX * this.numY),         // density
        this.uTemp = new Float32Array(this.numX * this.numY),
        this.vTemp = new Float32Array(this.numX * this.numY),
        this.dTemp = new Float32Array(this.numX * this.numY),
        this.div = new Float32Array(this.numX * this.numY)        // divergence
    
        this.obstacle = new Obstacle(0.3*this.numX, 0.5*this.numY, 0.04*this.numX);
    
        // Initialize cells to default values
        const maxSpeed = 50;
        let r = this.numY;
        let c = this.numX;
        let pipeWidth = r / 10;
        for (var i = 0; i < r; i++) {
            for (var j = 0; j < c; j++) {
    
                this.u[i*c + j] = (j == 1) * maxSpeed;
                this.v[i*c + j] = 0;        
                this.s[i*c + j] = i == 0 || i == r-1 || j == 0 || j == c-1 ? 0 : 1;
                this.d[i*c + j] = (i > 0.5*(r - pipeWidth) && i < 0.5*(r + pipeWidth)) && (j == 0);
    
            }
        }
    
        this.setObstacle(this.obstacle.x, this.obstacle.y, this.obstacle.r);
    }
    
    clearObstacle = () => {
        let x = this.obstacle.x;
        let y = this.obstacle.y;
        let r = this.obstacle.r;

        for (var i = y - r; i < y + r; i++) {
            for (var j = x - r; j < x + r; j++) {
                let inBounds = i > 0 && j > 0 && i < this.numY-1 && j < this.numX-1;
                if (inBounds && ((i-y)**2 + (j-x)**2 < r**2)) {
                    this.s[i*this.numX+j] = 1;
                }
            }
        }
    }

    setObstacle = (x, y, r) => {
        x = Math.floor(x);
        y = Math.floor(y);
        r = Math.ceil(r);

        let vx = (x - this.obstacle.x) * h / this.dt;
        let vy = (y - this.obstacle.y) * h/ this.dt;
        console.log(vx, vy);

        // mark obstacle cells as occupied
        this.obstacle.x = x;
        this.obstacle.y = y;
        this.obstacle.r = r;
        for (var i = y - r; i < y + r; i++) {
            for (var j = x - r; j < x + r; j++) {
                let inBounds = i > 0 && j > 0 && i < this.numY-1 && j < this.numX-1;
                if (inBounds && ((i-y)**2 + (j-x)**2 < r**2)) {
                    this.s[i*this.numX+j] = 0;
                    this.u[i*this.numX+j] = vx;
                    this.v[i*this.numX+j] = vy;
                    this.d[i*this.numX+j] = 0;
                }
            }
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

// ----------------- Fluid simulation ---------------------

function clearGrid(grid) {
    const canvas = document.getElementById("canvas-webgpu");
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawGrid(grid) {
    const canvas = document.getElementById("canvas-webgpu");
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
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
    for (var i = 0; i < grid.numY; i++) {
        for (var j = 0; j < grid.numX; j++) {
            // skip cell if its corners go off the canvas
            if ((i+1)*h > canvas.height || (j+1)*h > canvas.width)
                continue;

            // draw cell
            let fillColor = 'rgb(255,255,255)';

            if (drawOccupancyChecked && grid.s[i*grid.numX + j] == 0) {
                fillColor = 'rgb(255,0,0)';
            } else if (drawDensityChecked) {
                let c = (1 - grid.d[i*grid.numX+j]) * 255;
                fillColor = 'rgb(' + c + ',' + c + ',' + c + ')';
            }

            context.fillStyle = fillColor
            context.fillRect(j*h, i*h, h, h);

            // draw velocity vectors
            if (drawVelocityChecked && grid.s[i*grid.numX + j] == 1) {

                let u = grid.u[i*grid.numX + j];
                let v = grid.v[i*grid.numX + j];

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

function step(grid, dt = 0.1) {
    
    let updateVelocity = (dt) => {
        let c = grid.numX;
        let r = grid.numY;
        let gravity = 9.8;
        for (var i = 1; i < r-1; i++) {
            for (var j = 1; j < c-1; j++) {
                if (grid.s[i*c+j] == 0) {
                    continue;
                }   // skip solid cells

                if (grid.s[i*c+(j-1)] == 1) {   
                    grid.u[i*c+j] += 0;
                }   // ensure left neighbor is unoccupied

                if (grid.s[(i+1)*c+j] == 1) {
                    grid.v[i*c+j] += gravity * dt; 
                }   // ensure neighbor below is unoccupied
            }
        }
    }

    let solveGrid = (iters = 50) => {
        let c = grid.numX;
        let r = grid.numY;

        let eps = 1e-7;
        let totalDiv;

        for (var it = 0; it < iters; it++) {
            totalDiv = 0;
            for (var i = 1; i < r-1; i++) {
                for (var j = 1; j < c-1; j++) {
                    if (grid.s[i*c+j] == 0) {
                        continue;
                    }   // skip solid cells

                    let div = grid.u[i*c+(j+1)] - grid.u[i*c+j] 
                            + grid.v[i*c+j] - grid.v[(i-1)*c+j];       // divergence
                    totalDiv += div;
                    grid.div[i*c+j] = div;

                    let s = grid.s[(i+1)*c+j] + grid.s[(i-1)*c+j] 
                            + grid.s[i*c+(j+1)] + grid.s[i*c+(j-1)];   // number of empty neighbors

                    if (s == 0)
                        continue;
                    
                    grid.u[i*c+j]    += div * grid.s[i*c+(j-1)] / s;
                    grid.v[i*c+j]    -= div * grid.s[(i+1)*c+j] / s;
                    grid.u[i*c+(j+1)]  -= div * grid.s[i*c+(j+1)] / s;
                    grid.v[(i-1)*c+j]  += div * grid.s[(i-1)*c+j] / s;

                }
            }
            if (Math.abs(totalDiv) < eps) {
                break;
            }   // break if total divergence is sufficiently small
        }
    }

    function extrapolateBoundary(grid, feature) {

        let f;
        switch(feature) {
            case "horizontal":
                f = grid.u;
                break;
            case "vertical":
                f = grid.v;
                break;
            case "density":
                f = grid.d;
                break;
            default:
                throw new Error("Grid feature " + feature + " does not exist.");
        }

        let r = grid.numY;
        let c = grid.numX;

        // set corner values equal to value of closest cell
        f[0] = f[c + 1];                  
        f[(r-1)*c] = f[(r-2)*c + 1];      
        f[c-1] = f[c + (c-2)];
        f[(r-1)*c + (c-1)] = f[(r-2)*c + (c-2)];

        // set remaining boundary values equal to value of closest cell
        for (var j = 1; j < grid.numX - 1; j++) {
            f[j] = f[c + j];
            f[(r-1)*c + j] = f[(r-2)*c + j];
        }

        for (var i = 1; i < grid.numY - 1; i++) {
            f[i*c] = f[i*c + 1];
            f[i*c + c-1] = f[i*c + c-2];
        }
    }
    function bilerp(x, y, grid, feature) {
        x = Math.max(Math.min(x, grid.numX*grid.h-1), 0.5*grid.h);
        y = Math.max(Math.min(y, grid.numY*grid.h-1), 0.5*grid.h);

        // TODO: shorten this function
        if (feature == "horizontal") {
            let x0 = Math.floor(x / grid.h) * grid.h;
            let x1 = x0 + grid.h;
            let y0 = Math.round(y / grid.h) * grid.h - 0.5 * grid.h;
            let y1 = y0 + grid.h;

            let tx = (x - x0) / (x1 - x0);
            let ty = (y - y0) / (y1 - y0);

            let c = grid.numX;
            let i = Math.floor(y0 / grid.h);
            let j = Math.floor(x0 / grid.h);

            let ret = (1 - ty) * ((1 - tx) * grid.u[i*c+j] + tx * grid.u[i*c+(j+1)])
                        + ty * ((1-tx) * grid.u[(i+1)*c+j] + tx * grid.u[(i+1)*c+(j+1)]);
            return ret;
        } else if (feature == "vertical") {
            let x0 = Math.round(x / grid.h) * grid.h - 0.5 * grid.h;
            let x1 = x0 + grid.h;
            let y0 = Math.floor(y / grid.h) * grid.h;
            let y1 = y0 + grid.h;

            let tx = (x - x0) / (x1 - x0);
            let ty = (y - y0) / (y1 - y0);

            let c = grid.numX;
            let i = Math.floor(y0 / grid.h) - 1;
            let j = Math.floor(x0 / grid.h);

            let ret = (1 - ty) * ((1 - tx) * grid.v[i*c+j] + tx * grid.v[i*c+(j+1)])
                        + ty * ((1-tx) * grid.v[(i+1)*c+j] + tx * grid.v[(i+1)*c+(j+1)]);
            return ret;
        } else if (feature == "density") {
            let x0 = Math.round(x / grid.h) * grid.h - 0.5 * grid.h;
            let x1 = x0 + grid.h;
            let y0 = Math.round(y / grid.h) * grid.h - 0.5 * grid.h;
            let y1 = y0 + grid.h;

            let tx = (x - x0) / (x1 - x0);
            let ty = (y - y0) / (y1 - y0);

            let c = grid.numX;
            let i = Math.floor(y0 / grid.h);
            let j = Math.floor(x0 / grid.h);
            
            let ret = (1 - ty) * ((1 - tx) * grid.d[i*c+j] + tx * grid.d[i*c+(j+1)])
                        + ty * ((1-tx) * grid.d[(i+1)*c+j] + tx * grid.d[(i+1)*c+(j+1)]);
            return ret;
        } else {
            throw new Error("Unable to interpolate grid feature '" + feature + "'. Invalid feature.");
        }
    }

    function advectVelocity(dt) {

        let r = grid.numY;
        let c = grid.numX;
        grid.uTemp = grid.u.slice(0);
        grid.vTemp = grid.v.slice(0);
        for (var i = 1; i < r-1; i++) {
            for (var j = 1; j < c-1; j++) {
                if (grid.s[i*c+j] == 0) {
                    continue;
                } // skip solid cells

                // compute new horizontal velocity
                {
                    // get current position
                    let x = j * grid.h;
                    let y = i * grid.h + grid.h * 0.5;

                    // get velocity at current position
                    let s = grid.s[i*c+(j-1)] + grid.s[(i-1)*c+(j-1)] + grid.s[(i-1)*c+j] + grid.s[i*c+j];
                    let u = grid.u[i*c+j];
                    let v = (grid.v[i*c+(j-1)]*grid.s[i*c+(j-1)]
                            + grid.v[(i-1)*c+(j-1)]*grid.s[(i-1)*c+(j-1)] 
                            + grid.v[(i-1)*c+j]*grid.s[(i-1)*c+j] 
                            + grid.v[i*c+j]*grid.s[i*c+j]) / s;         // interpolated vertical velocity

                    // get previous position
                    x -= dt * u;
                    y -= dt * v;
                    
                    grid.uTemp[i*c+j] = bilerp(x, y, grid, "horizontal");
                }
                
                // compute new vertical velocity
                {
                    // get current position
                    let x = j * grid.h + grid.h * 0.5;
                    let y = (i+1) * grid.h;

                    // get velocity at current position
                    let s = grid.s[i*c+j] + grid.s[(i+1)*c+j] + grid.s[i*c+(j+1)] + grid.s[(i+1)*c+(j+1)];
                    let u = (grid.u[i*c+j]*grid.s[i*c+j] 
                            + grid.u[(i+1)*c+j]*grid.s[(i+1)*c+j] 
                            + grid.u[i*c+(j+1)]*grid.s[i*c+(j+1)]
                            + grid.u[(i+1)*c+(j+1)]*grid.s[(i+1)*c+(j+1)]) / s; // interpolated horizontal velocity
                    let v = grid.v[i*c+j];

                    // previous position
                    x -= dt * u;
                    y -= dt * v;

                    grid.vTemp[i*c+j] = bilerp(x, y, grid, "vertical");
                } 

            }
        }
        grid.u = grid.uTemp.slice(0);
        grid.v = grid.vTemp.slice(0);
    }

    function advectDensity(dt) {
        let c = grid.numX;
        let r = grid.numY;
        grid.dTemp = grid.d.slice(0);

        for (var i = 1; i < r-1; i++) {
            for (var j = 1; j < c-1; j++) {
                
                // skip solid cells
                if (grid.s[i*c+j] == 0) {
                    continue;
                }

                // get position at center of cell
                let x = j * grid.h + grid.h * 0.5;
                let y = i * grid.h + grid.h * 0.5;

                // compute velocity at center of cell
                let u = (grid.u[i*c+j] + grid.u[i*c+(j+1)]) * 0.5;
                let v = (grid.v[i*c+j] + grid.v[(i-1)*c+j]) * 0.5;
                
                // compute position one timestep back
                x -= u * dt;
                y -= v * dt;
                
                // compute density at previous position
                grid.dTemp[i*c+j] = bilerp(x, y, grid, "density");
            }
        }
        grid.d = grid.dTemp.slice(0);
    }
    
    updateVelocity(dt);
    grid.setObstacle(grid.obstacle.x, grid.obstacle.y, grid.obstacle.r);
    solveGrid(iters=30);
    extrapolateBoundary(grid, feature = "horizontal");
    advectVelocity(dt);
    advectDensity(dt);
}

let grid = new Grid(160, 160, h = 0.4, dt = 1.0 / 30);
drawGrid(grid);

// ----------- HTML / Interactivity ----------------------
let stepButton = document.getElementById("step");
let stepCount = 0;
stepButton.addEventListener("click", () => { 
    step(grid, dt=grid.dt);
    stepCount++;
    clearGrid(grid); 
    drawGrid(grid); 
});

// Show grid features (ie. velocity vectors, density, etc)
const gridFeatures = document.getElementsByClassName("grid-feature");
for (var i = 0; i < gridFeatures.length; i++) {
    gridFeatures[i].onclick = () => { 
        clearGrid(grid);
        drawGrid(grid); 
};
}

// Reset button
document.getElementById("reset").onclick = () => {
    let numX = grid.numX;
    let numY = grid.numY;
    grid = new Grid(numX, numY, h = 0.4, dt = 1.0 / 30);
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
    console.log(x,y);
    obstacleClicked = grid.obstacle.contains(x,y);
    console.log(obstacleClicked);
});

canvas.addEventListener('mousemove', (event) => {
    let x = (event.x - rect.left) * grid.cellsPerPixel;
    let y = (event.y - rect.top) * grid.cellsPerPixel;
    console.log(x, y);
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
    }
    window.requestAnimationFrame(animate);
}
window.requestAnimationFrame(animate);



// Log frame rate to console
// window.setInterval(() => { console.log(cnt); cnt = 0; }, 1000);
