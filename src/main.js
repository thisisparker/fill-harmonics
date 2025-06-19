import "./style.css" assert { type: "css" };

const INITIAL_GRID_SIZE = 8;
const MAX_GRID_SIZE = 16;

let gridSize = INITIAL_GRID_SIZE;
let cellStates = new Map(); // Store cell states as "row,col" -> boolean
let isPlaying = false;
let audioContext = null;
let currentStep = 0;
let sequencerTimeout = null;
let stepDuration = 500; // Default 120 BPM

function updateGrid() {
    const grid = document.querySelector(".grid");
    let number = 1;

    const cells = grid.querySelectorAll(".cell");
    cells.forEach((cell) => {
        cell.dataset.number = "";

        if (cell.classList.contains("block")) {
            return;
        }

        const cellCoords = [
            parseInt(cell.dataset.row),
            parseInt(cell.dataset.col),
        ];
        const adjacentCoords = [
            [cellCoords[0] - 1, cellCoords[1]],
            [cellCoords[0], cellCoords[1] - 1],
        ];

        for (let coord of adjacentCoords) {
            if (
                coord[0] < 0 ||
                coord[1] < 0 ||
                document
                    .querySelector(
                        `[data-row="${coord[0]}"][data-col="${coord[1]}"]`
                    )
                    .classList.contains("block")
            ) {
                cell.dataset.number = number;
                number++;
                break;
            }
        }
    });
}

function changeGridSize(newGridSize) {
    const grid = document.querySelector(".grid");

    if (newGridSize > gridSize) {
        // Add new cells to existing rows
        for (let i = 0; i < gridSize; i++) {
            for (let j = gridSize; j < newGridSize; j++) {
                const cell = createCell(i, j);
                // Restore state if it exists
                const stateKey = `${i},${j}`;
                if (cellStates.has(stateKey)) {
                    if (cellStates.get(stateKey)) {
                        cell.classList.add("block");
                    }
                }
                // Find the correct insertion point: after the last cell in this row
                const cellsInRow = Array.from(
                    grid.querySelectorAll(`[data-row="${i}"]`)
                );
                const lastCellInRow = cellsInRow[cellsInRow.length - 1];
                lastCellInRow.after(cell);
            }
        }
        // Add new rows
        for (let i = gridSize; i < newGridSize; i++) {
            for (let j = 0; j < newGridSize; j++) {
                const cell = createCell(i, j);
                // Restore state if it exists
                const stateKey = `${i},${j}`;
                if (cellStates.has(stateKey)) {
                    if (cellStates.get(stateKey)) {
                        cell.classList.add("block");
                    }
                }
                grid.appendChild(cell);
            }
        }
    } else if (newGridSize < gridSize) {
        // Save states of cells that will be removed
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const cell = document.querySelector(
                    `[data-row="${i}"][data-col="${j}"]`
                );
                if (cell) {
                    const stateKey = `${i},${j}`;
                    cellStates.set(stateKey, cell.classList.contains("block"));
                }
            }
        }

        // Remove rightmost cells from each row
        for (let i = 0; i < newGridSize; i++) {
            for (let j = newGridSize; j < gridSize; j++) {
                const cellToRemove = document.querySelector(
                    `[data-row="${i}"][data-col="${j}"]`
                );
                if (cellToRemove) {
                    cellToRemove.remove();
                }
            }
        }
        // Remove bottom rows
        for (let i = newGridSize; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const cellToRemove = document.querySelector(
                    `[data-row="${i}"][data-col="${j}"]`
                );
                if (cellToRemove) {
                    cellToRemove.remove();
                }
            }
        }
    }

    gridSize = newGridSize;
    document.documentElement.style.setProperty("--grid-size", gridSize);
    updateGrid();
    updateURLHash();
}

function toggleCell(event) {
    const tappedCell = event.target;
    const i = parseInt(tappedCell.dataset.row);
    const j = parseInt(tappedCell.dataset.col);
    const symmetricCell = document.querySelector(
        `[data-row="${gridSize - i - 1}"][data-col="${gridSize - j - 1}"]`
    );

    // Check for key combinations
    if (event.shiftKey) {
        // Shift + click: toggle only the clicked cell (no symmetry)
        tappedCell.classList.toggle("block");
    } else {
        // Normal click: toggle both cells in the same state
        tappedCell.classList.toggle("block");
        symmetricCell.classList.toggle(
            "block",
            tappedCell.classList.contains("block")
        );
    }

    updateGrid();
    updateURLHash();
}

function createCell(i, j) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    cell.dataset.row = i;
    cell.dataset.col = j;
    cell.dataset.number = "";
    cell.addEventListener("click", toggleCell);
    return cell;
}

function createGrid() {
    const grid = document.createElement("div");
    grid.classList.add("grid");

    for (let i = 0; i < INITIAL_GRID_SIZE; i++) {
        for (let j = 0; j < INITIAL_GRID_SIZE; j++) {
            const cell = createCell(i, j);
            grid.appendChild(cell);
        }
    }

    return grid;
}

function createSliderComponents() {
    const sizeSliderContainer = document.createElement("div");
    sizeSliderContainer.classList.add("size-slider-container");

    const sizeSlider = document.createElement("input");
    sizeSlider.id = "size-slider";
    sizeSlider.type = "range";
    sizeSlider.min = INITIAL_GRID_SIZE.toString();
    sizeSlider.max = MAX_GRID_SIZE.toString();
    sizeSlider.value = INITIAL_GRID_SIZE;
    sizeSlider.setAttribute("list", "size-list");
    sizeSlider.addEventListener("input", (event) => {
        if (parseInt(event.target.value) !== gridSize) {
            changeGridSize(parseInt(event.target.value));
        }
    });

    const sizeList = document.createElement("datalist");
    sizeList.id = "size-list";
    for (let i = INITIAL_GRID_SIZE; i <= MAX_GRID_SIZE; i++) {
        const option = document.createElement("option");
        option.value = i.toString();
        sizeList.appendChild(option);
    }

    const sizeSliderLabel = document.createElement("label");
    sizeSliderLabel.htmlFor = "size-slider";
    sizeSliderLabel.textContent = "grid size";

    sizeSliderContainer.appendChild(sizeSlider);
    sizeSliderContainer.appendChild(sizeList);
    sizeSliderContainer.appendChild(sizeSliderLabel);
    return sizeSliderContainer;
}

function encodeGridState() {
    const state = {
        size: gridSize,
        cells: [],
    };

    // Collect all blocked cells
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell) => {
        if (cell.classList.contains("block")) {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            state.cells.push([row, col]);
        }
    });

    // Get BPM
    const bpmField = document.querySelector(".bpm-input input");
    if (bpmField) {
        state.bpm = parseInt(bpmField.value) || 150;
    }

    return btoa(JSON.stringify(state));
}

function decodeGridState(hash) {
    try {
        const decoded = JSON.parse(atob(hash));
        return decoded;
    } catch (e) {
        console.warn("Invalid hash format:", e);
        return null;
    }
}

function loadStateFromHash() {
    const hash = window.location.hash.slice(1); // Remove the # symbol
    if (!hash) return;

    const state = decodeGridState(hash);
    if (!state) return;

    // Set grid size
    if (
        state.size &&
        state.size >= INITIAL_GRID_SIZE &&
        state.size <= MAX_GRID_SIZE
    ) {
        changeGridSize(state.size);
        const sizeSlider = document.getElementById("size-slider");
        if (sizeSlider) {
            sizeSlider.value = state.size;
        }
    }

    // Set BPM
    if (state.bpm) {
        const bpmField = document.querySelector(".bpm-input input");
        if (bpmField) {
            bpmField.value = state.bpm;
            changeTempo(state.bpm);
        }
    }

    // Clear existing blocks
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell) => {
        cell.classList.remove("block");
    });

    // Apply saved cell states
    if (state.cells && Array.isArray(state.cells)) {
        state.cells.forEach(([row, col]) => {
            const cell = document.querySelector(
                `[data-row="${row}"][data-col="${col}"]`
            );
            if (cell) {
                cell.classList.add("block");
            }
        });
    }

    updateGrid();
}

function updateURLHash() {
    const encodedState = encodeGridState();
    window.location.hash = encodedState;
}

function main() {
    const app = document.getElementById("app");

    const header = document.createElement("h1");
    header.textContent = "drum fill: construct a beat";
    app.appendChild(header);

    const machineContainer = document.createElement("div");
    machineContainer.classList.add("machine-container");
    app.appendChild(machineContainer);

    const controlPanel = document.createElement("div");
    controlPanel.classList.add("control-panel");
    machineContainer.appendChild(controlPanel);

    const sizeSliderContainer = createSliderComponents();

    controlPanel.appendChild(sizeSliderContainer);

    const clearButton = document.createElement("button");
    clearButton.textContent = "clear blocks";
    clearButton.classList.add("clear-button");
    clearButton.addEventListener("click", () => {
        const cells = document.querySelectorAll(".cell");
        cells.forEach((cell) => {
            cell.classList.remove("block");
        });
        // Clear saved states as well
        cellStates.clear();
        updateGrid();
        updateURLHash();
    });

    controlPanel.appendChild(clearButton);

    const bpmInput = document.createElement("div");
    bpmInput.classList.add("bpm-input");

    const bpmLabel = document.createElement("label");
    bpmLabel.textContent = "bpm";

    const bpmField = document.createElement("input");
    bpmField.type = "number";
    bpmField.min = "60";
    bpmField.max = "200";
    bpmField.value = "150";
    bpmField.addEventListener("input", (event) => {
        const newBpm = parseInt(event.target.value) || 150;
        changeTempo(newBpm);
        updateURLHash();
    });

    bpmInput.appendChild(bpmLabel);
    bpmInput.appendChild(bpmField);
    controlPanel.appendChild(bpmInput);

    const playButton = document.createElement("button");
    playButton.textContent = "play";
    playButton.classList.add("play-button");
    playButton.addEventListener("click", () => {
        if (isPlaying) {
            stopSequencer();
            playButton.textContent = "play";
        } else {
            startSequencer();
            playButton.textContent = "pause";
        }
    });
    controlPanel.appendChild(playButton);

    const grid = createGrid();
    machineContainer.appendChild(grid);
    updateGrid();

    // Load state from URL hash if present
    loadStateFromHash();
}

function playStep() {
    const cells = document.querySelectorAll(".cell");

    // Remove previous highlight
    cells.forEach((cell) => cell.classList.remove("playing"));

    // Highlight current step column
    for (let i = 0; i < gridSize; i++) {
        const cell = document.querySelector(
            `[data-row="${i}"][data-col="${currentStep}"]`
        );
        if (cell) {
            cell.classList.add("playing");

            // Play sound if cell is blocked
            if (cell.classList.contains("block")) {
                playNote(i);
            }
        }
    }

    // Move to next step
    currentStep = (currentStep + 1) % gridSize;

    // Schedule next step if still playing
    if (isPlaying) {
        sequencerTimeout = setTimeout(playStep, stepDuration);
    }
}

function playNote(row) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // 16 different frequencies for different rows (C3 to C5) - REVERSED ORDER
    const frequencies = [
        587.33, // D5
        523.25, // C5
        493.88, // B4
        440.0, // A4
        392.0, // G4
        349.23, // F4
        329.63, // E4
        293.66, // D4
        261.63, // C4
        246.94, // B3
        220.0, // A3
        196.0, // G3
        174.61, // F3
        164.81, // E3
        146.83, // D3
        130.81, // C3
    ];
    const frequency = frequencies[row] || 220;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.1
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

function startSequencer() {
    if (isPlaying) return;

    // Initialize audio context if needed
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    isPlaying = true;

    // Get BPM from input field
    const bpmField = document.querySelector(".bpm-input input");
    const bpm = parseInt(bpmField.value) || 120;
    stepDuration = (60 / bpm) * 1000; // Convert BPM to milliseconds per step

    // Start the sequencer loop
    sequencerTimeout = setTimeout(playStep, stepDuration);
}

function stopSequencer() {
    if (!isPlaying) return;

    isPlaying = false;

    if (sequencerTimeout) {
        clearTimeout(sequencerTimeout);
        sequencerTimeout = null;
    }

    // Remove all playing highlights
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell) => cell.classList.remove("playing"));
}

function changeTempo(newBpm) {
    stepDuration = (60 / newBpm) * 1000;
    // The next step will use the new tempo automatically
}

main();
