// Constants (matching your Python code where possible)
const WIDTH = 1000;
const HEIGHT = 700;
const CANVAS_WIDTH = 540;
const CANVAS_HEIGHT = 620;
const FPS = 60;
const R = 8.31446261815324; // J/(mol·K)

// Get HTML elements
const canvas = document.getElementById("gasCanvas");
const ctx = canvas.getContext("2d");

const temperatureSlider = document.getElementById("temperatureSlider");
const molesSlider = document.getElementById("molesSlider");
const volumeSlider = document.getElementById("volumeSlider");

const tempValueDisplay = document.getElementById("tempValue");
const molesValueDisplay = document.getElementById("molesValue");
const volumeValueDisplay = document.getElementById("volumeValue");

const displayT = document.getElementById("displayT");
const displayN = document.getElementById("displayN");
const displayV = document.getElementById("displayV");
const displayP = document.getElementById("displayP");
const resetButton = document.getElementById("resetButton");

// Theme toggle elements
const themeToggleButton = document.getElementById("themeToggleButton");
const body = document.body;

// Large pressure display
const largePressureValueDisplay = document.getElementById("largePressureValue");


// Helper function to get CSS variable value
function getCssVariable(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Particle class (JavaScript version)
class Particle {
    constructor(areaRect) {
        this.radius = 3;
        this.area = areaRect; // Current container rect
        this.reset(areaRect);
    }

    reset(areaRect) {
        this.area = areaRect;
        this.x = Math.random() * (this.area.width - 2 * this.radius) + this.area.left + this.radius;
        this.y = Math.random() * (this.area.height - 2 * this.radius) + this.area.top + this.radius;
        const angle = Math.random() * 2 * Math.PI;
        const speed = Math.random() * (120 - 30) + 30; // Random speed between 30 and 120
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }

    update(dt, areaRect, scaleSpeed = 1.0) {
        this.area = areaRect; // Update particle's knowledge of its container
        this.x += this.vx * dt * scaleSpeed;
        this.y += this.vy * dt * scaleSpeed;

        // Bounce logic
        if (this.x - this.radius < this.area.left) {
            this.x = this.area.left + this.radius;
            this.vx *= -1;
        } else if (this.x + this.radius > this.area.right) {
            this.x = this.area.right - this.radius;
            this.vx *= -1;
        }

        if (this.y - this.radius < this.area.top) {
            this.y = this.area.top + this.radius;
            this.vy *= -1;
        } else if (this.y + this.radius > this.area.bottom) {
            this.y = this.area.bottom - this.radius;
            this.vy *= -1;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = getCssVariable('--particle-color'); // Use helper
        ctx.fill();
    }
}

// Initial values for sliders
let T = parseFloat(temperatureSlider.value);
let n = parseFloat(molesSlider.value);
let V = parseFloat(volumeSlider.value);

let numParticlesBase = 40;
let particles = [];

// Function to format numbers for display (similar to format_si in Python)
function formatSi(value, unit) {
    if (value === 0) return `0 ${unit}`;
    const absVal = Math.abs(value);
    if (absVal >= 1) {
        return `${value.toPrecision(4)} ${unit}`;
    } else {
        const exp = Math.floor(Math.log10(absVal));
        const mant = value / Math.pow(10, exp);
        return `${mant.toPrecision(3)}e${exp} ${unit}`;
    }
}

function updateSimulation() {
    T = parseFloat(temperatureSlider.value);
    n = parseFloat(molesSlider.value);
    V = parseFloat(volumeSlider.value);

    // Update slider value displays
    tempValueDisplay.textContent = T.toFixed(1);
    molesValueDisplay.textContent = n.toFixed(3);
    volumeValueDisplay.textContent = V.toFixed(4);

    // Update computed values display
    displayT.textContent = `${T.toFixed(1)} K`;
    displayN.textContent = `${n.toFixed(4)} mol`;
    displayV.textContent = `${V.toFixed(5)} m³`;

    // Calculate Pressure P = nRT / V
    const currentT = Math.max(0.1, T);
    const currentN = Math.max(1e-6, n);
    const currentV = Math.max(1e-8, V);
    const P = (currentN * R * currentT) / currentV; // in Pascals
    displayP.textContent = formatSi(P, "Pa");

    // Update large pressure display
    largePressureValueDisplay.innerHTML = `Pression : <span style="color: ${getCssVariable('--accent-color')};">${formatSi(P, "Pa")}</span>`;

    // --- Container for particles (mimicking Pygame's area_rect and container) ---
    const areaRectPadding = 20; // Padding inside the right panel for the container area
    const containerMaxW = CANVAS_WIDTH - 2 * areaRectPadding;
    const containerMaxH = CANVAS_HEIGHT - 2 * areaRectPadding - 100; // room for gauge + labels

    const Vmin = parseFloat(volumeSlider.min);
    const Vmax = parseFloat(volumeSlider.max);
    let frac = (V - Vmin) / (Vmax - Vmin);
    frac = Math.max(0.02, Math.min(0.95, frac));

    const containerW = Math.floor(containerMaxW * (0.45 + 0.45 * frac));
    const containerH = Math.floor(containerMaxH * (0.25 + 0.65 * frac));

    // Centered container within the visualization area
    const containerLeft = areaRectPadding + (containerMaxW - containerW) / 2;
    const containerTop = areaRectPadding + (containerMaxH - containerH) / 2;
    const containerRect = {
        left: containerLeft,
        top: containerTop,
        right: containerLeft + containerW,
        bottom: containerTop + containerH,
        width: containerW,
        height: containerH
    };

    // Update particle count
    const targetParticles = Math.floor(numParticlesBase * (0.2 + 4.8 * (n - parseFloat(molesSlider.min)) / (parseFloat(molesSlider.max) - parseFloat(molesSlider.min))));
    const actualTargetParticles = Math.max(5, Math.min(250, targetParticles));

    while (particles.length < actualTargetParticles) {
        particles.push(new Particle(containerRect));
    }
    while (particles.length > actualTargetParticles) {
        particles.pop();
    }

    // Adjust particle positions if container changes significantly
    particles.forEach(p => {
        if (p.x < containerRect.left || p.x > containerRect.right || p.y < containerRect.top || p.y > containerRect.bottom) {
            p.reset(containerRect); // Reset if outside new bounds
        }
    });
}

// Event Listeners for sliders and reset button
temperatureSlider.addEventListener("input", updateSimulation);
molesSlider.addEventListener("input", updateSimulation);
volumeSlider.addEventListener("input", updateSimulation);

resetButton.addEventListener("click", () => {
    temperatureSlider.value = 300;
    molesSlider.value = 1.0;
    volumeSlider.value = 0.1;
    updateSimulation(); // Update all displays and particles after reset
});

// Theme toggle logic
themeToggleButton.addEventListener("click", () => {
    // Toggle dark-theme class
    body.classList.toggle("dark-theme");

    // Ensure the button text reflects the current state
    if (body.classList.contains("dark-theme")) {
        themeToggleButton.textContent = "Mode Clair";
    } else {
        themeToggleButton.textContent = "Mode Sombre";
    }
    // No need to call updateSimulation here, as it's not changing simulation parameters.
    // The animate loop will pick up the new CSS variables in the next frame.
});


// Initial setup for particles
updateSimulation(); // Initialize values and particle count

// Game loop (animation)
let lastTime = 0;
function animate(currentTime) {
    const dt = (currentTime - lastTime) / 1000; // delta time in seconds
    lastTime = currentTime;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Get CSS variables for drawing - USE HELPER FUNCTION
    const canvasBgColor = getCssVariable('--canvas-bg-color');
    const containerBgColor = getCssVariable('--container-bg-color');
    const borderColor = getCssVariable('--border-color');
    const accentColor = getCssVariable('--accent-color');


    // Re-draw container (mimicking your Pygame draw_panel for visualization)
    const areaRectPadding = 20;
    const containerMaxW = CANVAS_WIDTH - 2 * areaRectPadding;
    const containerMaxH = CANVAS_HEIGHT - 2 * areaRectPadding - 100;

    const Vmin = parseFloat(volumeSlider.min);
    const Vmax = parseFloat(volumeSlider.max);
    let frac = (V - Vmin) / (Vmax - Vmin);
    frac = Math.max(0.02, Math.min(0.95, frac));

    const containerW = Math.floor(containerMaxW * (0.45 + 0.45 * frac));
    const containerH = Math.floor(containerMaxH * (0.25 + 0.65 * frac));

    const containerLeft = areaRectPadding + (containerMaxW - containerW) / 2;
    const containerTop = areaRectPadding + (containerMaxH - containerH) / 2;
    const containerRect = {
        left: containerLeft,
        top: containerTop,
        right: containerLeft + containerW,
        bottom: containerTop + containerH,
        width: containerW,
        height: containerH
    };

    // Draw background for visualization area
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw the gas container
    ctx.fillStyle = containerBgColor;
    ctx.fillRect(containerRect.left, containerRect.top, containerRect.width, containerRect.height);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(containerRect.left, containerRect.top, containerRect.width, containerRect.height);

    // Speed scale based on temperature
    const Tmin = parseFloat(temperatureSlider.min);
    const Tmax = parseFloat(temperatureSlider.max);
    const speedScale = 0.4 + 1.6 * ((T - Tmin) / (Tmax - Tmin));

    // Update and draw particles
    particles.forEach(p => {
        p.update(dt, containerRect, speedScale);
        p.draw(ctx);
    });

    // Pressure gauge (vertical) - simplified
    const gaugeW = 24;
    const gaugeH = containerMaxH;
    const gaugeX = CANVAS_WIDTH - gaugeW - 10;
    const gaugeY = areaRectPadding;
    ctx.fillStyle = containerBgColor;
    ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);
    ctx.strokeStyle = borderColor;
    ctx.strokeRect(gaugeX, gaugeY, gaugeW, gaugeH);

    const Pmin_display = 1e2;
    const Pmax_display = 1e7;
    const currentP = (Math.max(1e-6, n) * R * Math.max(0.1, T)) / Math.max(1e-8, V);
    const Pf = Math.log10(Math.max(Pmin_display, Math.min(Pmax_display, currentP)));
    const Pf_norm = (Pf - Math.log10(Pmin_display)) / (Math.log10(Pmax_display) - Math.log10(Pmin_display));
    const fillH = Math.floor(gaugeH * Math.max(0.0, Math.min(1.0, Pf_norm)));

    ctx.fillStyle = accentColor;
    ctx.fillRect(gaugeX, gaugeY + gaugeH - fillH, gaugeW, fillH);

    // Request next frame
    requestAnimationFrame(animate);
}

// Start the animation loop
requestAnimationFrame(animate);
