import "./style.css" assert { type: "css" };

const INITIAL_GRID_SIZE = 8;
const MAX_GRID_SIZE = 16;

let gridSize = INITIAL_GRID_SIZE;
let cellStates = new Map(); // Store cell states as "row,col" -> text or '.'
let sequencerLoop = null;
let currentStep = 0;
let blocksToggleSwitch;
let synths = initializeSynths('sine')
let drums = {}
let drumMode = 'default'
let allDrums = {} // Store all drum modes for instant switching
let acrossWords = [];
let timeOffset = 0;
let alreadyPlaying = {};
const playModes = Object.freeze({
    grid: 'grid',
    word: 'word'
})
let playMode = playModes.grid;

const notes = [
    "C6",
    "A5",
    "G5",
    "E5",
    "D5",
    "C5",
    "B4",
    "A4",
    "G4",
    "E4",
    "D4",
    "C4",
    "A3",
    "G3",
    "E3",
    "D3",
    "C3",
];

const synthModes = [
    "sine",
    "square",
    "triangle",
    "sawtooth",
    "fatsine",
    "fatsquare",
    "fattriangle",
    "fatsawtooth",
]

const drumModes = {
    'default':
    {
        kick: "bassdrumBD0075.WAV",
        snare: "snareSD7550.WAV",
        hat: "openhatOH10.WAV"
    },
    'sp202':
    {
        kick: "k1 [lofi1].wav",
        snare: "sn1 [lofi1].wav",
        hat: "hh5 [lofi1].wav"
    },
    'cr1000':
    {
        kick: "Bassdrum.wav",
        snare: "Snaredrum.wav",
        hat: "Hat Closed.wav"
    },
    'rx21':
    {
        kick: "RX21Kick.wav",
        snare: "RX21Clap.wav",
        hat: "RX21Hat_C.wav"
    },
    'tr808':
    {
        kick: "TR808 Kick 2.wav",
        snare: "TR808 SD 5.wav",
        hat: "TR808 OHH 1.wav"
    }
}

function initializeSynths(mode) {
    let newSynths = [];

    for (let i = 0; i < MAX_GRID_SIZE; i++) {
        newSynths.push(
            new Tone.Synth({
                oscillator: { type: mode },
                envelope: {
                    attack: 0.001,
                    decay: 0.1,
                    sustain: 0.1,
                    release: 0.5,
                },
            }).toDestination()
        );
    }

    return newSynths;
}

function initializeDrums() {
    const newDrums = {};

    for (const mode in drumModes) {
        newDrums[mode] = new Tone.Players({
            "kick": drumModes[mode]['kick'],
            "snare": drumModes[mode]['snare'],
            "hat": drumModes[mode]['hat']
        }
        ).toDestination()
    }

    return newDrums;
}

function getAcrossWords() {
    const cells = document.querySelectorAll(".cell");
    acrossWords = [];
    let currentWord = [];

    cells.forEach((cell) => {
        let coords = [parseInt(cell.dataset.col), parseInt(cell.dataset.row)];
        if (cell.classList.contains("block")) {
            return;
        } else if (
            coords[0] === 0 ||
            document
                .querySelector(
                    `[data-row="${coords[1]}"][data-col="${coords[0] - 1}"]`
                )
                .classList.contains("block")
        ) {
            if (currentWord.length > 0) {
                acrossWords.push(currentWord);
            }
            currentWord = [coords];
        } else {
            currentWord.push(coords);
        }
    });

    acrossWords.push(currentWord);
}

function updateGrid() {
    const grid = document.querySelector(".grid");
    let number = 1;

    getAcrossWords();

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

    cells.forEach((cell) => {
        cell.classList.remove("last-in-row");
        cell.classList.remove("last-in-column");
        if (parseInt(cell.dataset.col) === gridSize - 1) {
            cell.classList.add("last-in-row");
        }
        if (parseInt(cell.dataset.row) === gridSize - 1) {
            cell.classList.add("last-in-column");
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
                    if (cellStates.get(stateKey) === ".") {
                        cell.classList.add("block");
                    } else {
                        cell.dataset.text = cellStates.get(stateKey);
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
                    cellStates.set(
                        stateKey,
                        cell.classList.contains("block")
                            ? "."
                            : cell.dataset.text
                    );
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
}

function toggleCell(event) {
    const cell = event.currentTarget;

    // If in text mode, just focus the input
    if (blocksToggleSwitch && !blocksToggleSwitch.checked) {
        const input = cell.querySelector("input.cell-input");
        if (input) {
            input.focus();
            input.select();
        }
        return;
    }

    // Blocks mode: toggle blocks normally
    const i = parseInt(cell.dataset.row);
    const j = parseInt(cell.dataset.col);
    const symmetricCell = document.querySelector(
        `[data-row="${gridSize - i - 1}"][data-col="${gridSize - j - 1}"]`
    );

    if (event.shiftKey) {
        // Shift + click: toggle only the clicked cell (no symmetry)
        cell.classList.toggle("block");
        if (cell.classList.contains("block")) {
            cell.dataset.text = "";
        }
    } else {
        // Normal click: toggle both cells in the same state
        cell.classList.toggle("block");
        symmetricCell.classList.toggle(
            "block",
            cell.classList.contains("block")
        );
        if (cell.classList.contains("block")) {
            cell.dataset.text = "";
            if (symmetricCell) {
                symmetricCell.dataset.text = "";
            }
        }
    }

    updateGrid();
}

function clearBlocks() {
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell) => {
        cell.classList.remove("block");
    });
    // Clear saved states as well
    for (const [cell, state] of cellStates) {
        if (state === ".") {
            cellStates.set(cell, "");
        }
    }
    updateGrid();
}

function clearText() {
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell) => {
        cell.dataset.text = "";
    });
    // Clear saved states as well
    for (const [cell, state] of cellStates) {
        if (/^[A-Z]$/.test(state)) {
            cellStates.set(cell, "");
        }
    }
    updateGrid();
}

function getNextEmptyCell(i, j) {
    let total = gridSize * gridSize;
    let startIndex = i * gridSize + j;
    for (let offset = 1; offset < total; offset++) {
        let idx = (startIndex + offset) % total;
        let row = Math.floor(idx / gridSize);
        let col = idx % gridSize;
        const cell = document.querySelector(
            `[data-row='${row}'][data-col='${col}']`
        );
        if (cell && !cell.classList.contains("block")) {
            return cell;
        }
    }
    // If all are blocks, return the original cell
    return document.querySelector(`[data-row='${i}'][data-col='${j}']`);
}

function getPrevEmptyCell(i, j) {
    let total = gridSize * gridSize;
    let startIndex = i * gridSize + j;
    for (let offset = 1; offset < total; offset++) {
        let idx = (startIndex - offset + total) % total; // Go backwards
        let row = Math.floor(idx / gridSize);
        let col = idx % gridSize;
        const cell = document.querySelector(
            `[data-row='${row}'][data-col='${col}']`
        );
        if (cell && !cell.classList.contains("block")) {
            return cell;
        }
    }
    // If all are blocks, return the original cell
    return document.querySelector(`[data-row='${i}'][data-col='${j}']`);
}

function createCell(i, j) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    cell.dataset.row = i;
    cell.dataset.col = j;
    cell.dataset.number = "";
    cell.dataset.text = ""; // Store text value here
    cell.tabIndex = 0;
    cell.addEventListener("click", toggleCell);

    // Add a hidden text input for capturing keyboard input
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 1;
    input.classList.add("cell-input");
    input.style.position = "absolute";
    input.style.top = "0";
    input.style.left = "0";
    input.style.right = "0";
    input.style.bottom = "0";
    input.style.color = "transparent";
    input.style.background = "transparent";
    input.style.border = "none";
    input.style.outline = "none";
    input.style.caretColor = "transparent";
    input.style.zIndex = "1";
    input.autocomplete = "off";

    // Move to next cell on input
    input.addEventListener("input", (e) => {
        if (input.value.length > 1) {
            input.value = input.value[0];
        }

        // If typing on a block, remove the block first
        if (cell.classList.contains("block")) {
            const i = parseInt(cell.dataset.row);
            const j = parseInt(cell.dataset.col);
            const symmetricCell = document.querySelector(
                `[data-row="${gridSize - i - 1}"][data-col="${gridSize - j - 1
                }"]`
            );

            cell.classList.remove("block");
            if (symmetricCell) {
                symmetricCell.classList.remove("block");
            }

            updateGrid();
        }

        // Always store/display as uppercase
        const val = input.value.toUpperCase();
        cell.dataset.text = val;
        input.value = ""; // Clear input after storing
        // Move to next cell in the row
        const nextCell = getNextEmptyCell(i, j);
        const nextCellInput = nextCell.querySelector("input.cell-input");

        if (val && nextCellInput) {
            nextCellInput.focus();
            nextCellInput.select();
        }
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace") {
            e.preventDefault();
            cell.dataset.text = "";
            const prevCell = getPrevEmptyCell(i, j);
            const prevCellInput = prevCell.querySelector("input.cell-input");
            if (prevCellInput) {
                e.preventDefault();
                prevCellInput.focus();
                prevCellInput.select();
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const targetRow = (i - 1 + gridSize) % gridSize;
            const targetCell = document.querySelector(
                `[data-row='${targetRow}'][data-col='${j}'] input.cell-input`
            );
            if (targetCell) {
                targetCell.focus();
                targetCell.select();
            }
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            const targetRow = (i + 1) % gridSize;
            const targetCell = document.querySelector(
                `[data-row='${targetRow}'][data-col='${j}'] input.cell-input`
            );
            if (targetCell) {
                targetCell.focus();
                targetCell.select();
            }
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            const targetCol = (j - 1 + gridSize) % gridSize;
            const targetCell = document.querySelector(
                `[data-row='${i}'][data-col='${targetCol}'] input.cell-input`
            );
            if (targetCell) {
                targetCell.focus();
                targetCell.select();
            }
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            const targetCol = (j + 1) % gridSize;
            const targetCell = document.querySelector(
                `[data-row='${i}'][data-col='${targetCol}'] input.cell-input`
            );
            if (targetCell) {
                targetCell.focus();
                targetCell.select();
            }
        } else if (e.key === ".") {
            e.preventDefault();
            // Toggle block directly
            const i = parseInt(cell.dataset.row);
            const j = parseInt(cell.dataset.col);
            const symmetricCell = document.querySelector(
                `[data-row="${gridSize - i - 1}"][data-col="${gridSize - j - 1
                }"]`
            );

            cell.classList.toggle("block");
            symmetricCell.classList.toggle(
                "block",
                cell.classList.contains("block")
            );

            if (cell.classList.contains("block")) {
                cell.dataset.text = "";
                if (symmetricCell) {
                    symmetricCell.dataset.text = "";
                }
            }

            updateGrid();
        } else if (e.key === ">") {
            e.preventDefault();
            // Toggle block directly
            const i = parseInt(cell.dataset.row);
            const j = parseInt(cell.dataset.col);

            cell.classList.toggle("block");

            if (cell.classList.contains("block")) {
                cell.dataset.text = "";
            }
            updateGrid();
        }
    });

    // Add focus/blur handlers for visual indication
    input.addEventListener("focus", () => {
        cell.classList.add("focused");
    });

    input.addEventListener("blur", () => {
        cell.classList.remove("focused");
    });

    cell.appendChild(input);

    // Set initial focusability (default to blocks mode when toggle not yet created)
    if (blocksToggleSwitch) {
        updateInputFocusability();
    } else {
        // Default to blocks mode (inputs disabled)
        input.style.pointerEvents = "none";
        input.tabIndex = -1;
    }

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
    // Build query string parameters
    let params = new URLSearchParams();

    // Encode grid state as a simple string
    let gridString = "";
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const cell = document.querySelector(
                `[data-row="${i}"][data-col="${j}"]`
            );
            if (cell.classList.contains("block")) {
                gridString += "_";
            } else if (cell.dataset.text) {
                gridString += cell.dataset.text;
            } else {
                gridString += "-";
            }
        }
    }

    params.set("grid", gridString);
    params.set("size", gridSize.toString());

    const bpmField = document.querySelector(".bpm-input input");
    const bpm = bpmField ? parseInt(bpmField.value) || 120 : 120;
    params.set("bpm", bpm.toString());

    // Add entry mode (blocks/text)
    const entryMode =
        blocksToggleSwitch && !blocksToggleSwitch.checked ? "text" : "blocks";
    params.set("entry", entryMode);

    const synthModeMenu = document.querySelector(".synth-mode-menu")

    const synthMode = synthModeMenu.value;
    params.set("synth", synthMode)

    const drumModeMenu = document.querySelector(".drum-mode-menu")
    const drumMode = drumModeMenu.value;
    params.set("drums", drumMode)

    // Add playback mode (grid/word)
    params.set("play", playMode);

    return params.toString();
}

function decodeGridState(searchString) {
    try {
        const params = new URLSearchParams(searchString);
        return {
            grid: params.get("grid"),
            size: parseInt(params.get("size")) || INITIAL_GRID_SIZE,
            bpm: parseInt(params.get("bpm")) || 120,
            entry: params.get("entry") || "blocks",
            synth: params.get("synth") || "sine",
            drums: params.get("drums") || "default",
            play: params.get("play") || "blocks",
        };
    } catch (e) {
        console.warn("Invalid query string format:", e);
        return null;
    }
}

function loadStateFromQueries() {
    const searchString = window.location.search.slice(1); // Remove the ? symbol
    if (!searchString) return;

    const state = decodeGridState(searchString);
    if (!state || !state.grid) return;

    console.log(state)

    const gridString = state.grid;
    const gridSizeFromState = state.size;

    // Set grid size
    if (
        gridSizeFromState >= INITIAL_GRID_SIZE &&
        gridSizeFromState <= MAX_GRID_SIZE
    ) {
        changeGridSize(gridSizeFromState);
        const sizeSlider = document.getElementById("size-slider");
        if (sizeSlider) {
            sizeSlider.value = gridSizeFromState;
        }
    }

    // Set BPM
    if (state.bpm) {
        const bpmField = document.querySelector(".bpm-input input");
        if (bpmField) {
            bpmField.value = state.bpm;
        }
    }

    // Set entry mode (blocks/text)
    if (state.entry && blocksToggleSwitch) {
        const shouldBeTextMode = state.entry === "text";
        if (blocksToggleSwitch.checked === shouldBeTextMode) {
            blocksToggleSwitch.checked = !shouldBeTextMode;
            // Trigger the change event to update UI
            blocksToggleSwitch.dispatchEvent(new Event("change"));
        }
    }

    // Set synth mode
    const synthModeMenu = document.querySelector(".synth-mode-menu")

    if (state.synth && synthModeMenu) {
        synthModeMenu.value = state.synth;
        synthModeMenu.dispatchEvent(new Event("change"));
    }

    // Set drum mode
    const drumModeMenu = document.querySelector(".drum-mode-menu")

    if (state.drums && drumModeMenu) {
        drumModeMenu.value = state.drums;
        drumMode = state.drums;
        drums = allDrums[drumMode];
    }

    // Set playback mode (grid/word)
    if (state.play) {
        const playModeToggle = document.querySelector(
            '.play-mode-container input[type="checkbox"]'
        );
        if (playModeToggle) {
            const shouldBeWordMode = state.play === playModes.word;
            if (playModeToggle.checked === shouldBeWordMode) {
                playModeToggle.checked = !shouldBeWordMode;
                // Trigger the change event to update UI
                playModeToggle.dispatchEvent(new Event("change"));
            }
        }
    }

    // Clear all blocks and text
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell) => {
        cell.classList.remove("block");
        cell.dataset.text = "";
    });

    // Apply state from grid string
    const charsPerRow = gridSize;
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < charsPerRow; j++) {
            const charIndex = i * charsPerRow + j;
            if (charIndex >= gridString.length) break;

            const ch = gridString[charIndex];
            const cell = document.querySelector(
                `[data-row="${i}"][data-col="${j}"]`
            );
            if (!cell) continue;

            if (ch === "." || ch === "_") {
                cell.classList.add("block");
            } else if (ch === "-" || ch === "~") {
                continue;
            } else {
                cell.dataset.text = ch;
            }
        }
    }

    // Clear the query strings from the URL after loading
    window.history.replaceState({}, "", window.location.pathname);
}

function main() {
    const app = document.getElementById("app");

    const header = document.createElement("h1");
    header.textContent = "fill harmonics: construct a beat";
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
    clearButton.addEventListener("click", clearBlocks);

    controlPanel.appendChild(clearButton);

    const playModeContainer = document.createElement("div");
    playModeContainer.classList.add("play-mode-container");
    controlPanel.appendChild(playModeContainer);

    const playModeLabel = document.createElement("label");
    playModeLabel.textContent = "grid play mode";
    playModeContainer.appendChild(playModeLabel);

    const playModeToggle = document.createElement("input");
    playModeToggle.type = "checkbox";
    playModeToggle.checked = true;
    playModeToggle.classList.add("toggle-switch");

    playModeToggle.addEventListener("change", () => {
        if (playModeToggle.checked) {
            playModeLabel.textContent = "grid play mode";
            playMode = playModes.grid;
            currentStep = currentStep % gridSize;
        } else {
            playModeLabel.textContent = "word play mode";
            playMode = playModes.word;
            currentStep = currentStep % acrossWords.length;
        }
    });

    playModeContainer.appendChild(playModeToggle);

    const synthModeContainer = document.createElement("div");
    synthModeContainer.classList.add("synth-mode-container");
    controlPanel.appendChild(synthModeContainer)

    const synthModeMenu = document.createElement("select")
    synthModeMenu.name = "synth-mode-menu"
    synthModeMenu.classList.add("synth-mode-menu")
    for (let i = 0; i < synthModes.length; i++) {
        let optionValue = synthModes[i];
        let optionElement = document.createElement("option")
        optionElement.textContent = optionValue;
        optionElement.value = optionValue;
        synthModeMenu.appendChild(optionElement);
    }

    synthModeMenu.addEventListener("change", () => {
        synths = initializeSynths(synthModeMenu.value)
    })

    synthModeContainer.appendChild(synthModeMenu);

    const drumModeContainer = document.createElement("div");
    drumModeContainer.classList.add("drum-mode-container");
    controlPanel.appendChild(drumModeContainer)

    const drumModeMenu = document.createElement("select")
    drumModeMenu.name = "drum-mode-menu"
    drumModeMenu.classList.add("drum-mode-menu")
    for (const mode in drumModes) {
        let optionValue = mode;
        let optionElement = document.createElement("option")
        optionElement.textContent = optionValue;
        optionElement.value = optionValue;
        drumModeMenu.appendChild(optionElement);
    }

    drumModeContainer.appendChild(drumModeMenu);

    drumModeMenu.addEventListener("change", () => {
        drumMode = drumModeMenu.value;
        drums = allDrums[drumMode];
    })

    // Preload all drum modes and set default
    allDrums = initializeDrums();
    drums = allDrums[drumMode];

    // Toggle switch for blocks/text
    const toggleContainer = document.createElement("div");
    toggleContainer.classList.add("toggle-container");

    const toggleLabel = document.createElement("label");
    toggleLabel.classList.add("toggle-label");
    toggleLabel.textContent = "block entry";

    const toggleSwitch = document.createElement("input");
    toggleSwitch.type = "checkbox";
    toggleSwitch.checked = true;
    toggleSwitch.classList.add("toggle-switch");

    toggleSwitch.addEventListener("change", () => {
        toggleLabel.textContent = toggleSwitch.checked
            ? "block entry"
            : "text entry";
        if (toggleSwitch.checked) {
            clearButton.textContent = "clear blocks";
            clearButton.removeEventListener("click", clearText);
            clearButton.addEventListener("click", clearBlocks);
        } else {
            clearButton.textContent = "clear text";
            clearButton.removeEventListener("click", clearBlocks);
            clearButton.addEventListener("click", clearText);
        }
        updateInputFocusability();
    });

    toggleContainer.appendChild(toggleLabel);
    toggleContainer.appendChild(toggleSwitch);
    controlPanel.appendChild(toggleContainer);

    const bpmInput = document.createElement("div");
    bpmInput.classList.add("bpm-input");

    const bpmLabel = document.createElement("label");
    bpmLabel.textContent = "bpm";

    const bpmField = document.createElement("input");
    bpmField.type = "number";
    bpmField.min = "60";
    bpmField.max = "200";
    bpmField.value = "120";

    bpmInput.appendChild(bpmLabel);
    bpmInput.appendChild(bpmField);
    controlPanel.appendChild(bpmInput);

    const playButton = document.createElement("button");
    playButton.textContent = "play";
    playButton.classList.add("play-button");
    playButton.addEventListener("click", () => {
        if (Tone.Transport.state === "started") {
            stopSequencer();
            playButton.textContent = "play";
        } else {
            startSequencer();
            playButton.textContent = "pause";
        }
    });
    controlPanel.appendChild(playButton);

    const shareButton = document.createElement("button");
    shareButton.textContent = "share this grid";
    shareButton.classList.add("share-button");
    shareButton.addEventListener("click", async () => {
        // Generate the URL with current state
        const queryString = encodeGridState();
        const shareUrl =
            window.location.origin +
            window.location.pathname +
            "?" +
            queryString;

        // Copy the URL to clipboard
        try {
            await navigator.clipboard.writeText(shareUrl);
            // Show success message
            const originalText = shareButton.textContent;
            shareButton.textContent = "link copied!";
            setTimeout(() => {
                shareButton.textContent = originalText;
            }, 1000);
        } catch (err) {
            // Fallback for older browsers or if clipboard API fails
            console.warn("Could not copy to clipboard:", err);
            // Still show the URL was updated
            const originalText = shareButton.textContent;
            shareButton.textContent = "URL updated";
            setTimeout(() => {
                shareButton.textContent = originalText;
            }, 1000);
        }
    });
    controlPanel.appendChild(shareButton);

    const grid = createGrid();
    const gridContainer = document.createElement("div");
    gridContainer.classList.add("grid-container");
    gridContainer.appendChild(grid);
    machineContainer.appendChild(gridContainer);

    // Load state from URL hash if present
    loadStateFromQueries();

    updateGrid();

    blocksToggleSwitch = toggleSwitch;
}

function playStep(time) {
    const cells = document.querySelectorAll(".cell");

    // Remove previous highlight
    cells.forEach((cell) => {
        cell.classList.remove("playing");
        cell.classList.remove("active");
    });
    // Highlight current step column and schedule notes

    timeOffset = 0;
    alreadyPlaying = {
        kick: false,
        snare: false,
        hat: false
    }

    if (playMode === playModes.grid) {
        if (currentStep >= gridSize) {
            currentStep = 0;
        }
        for (let i = 0; i < gridSize; i++) {
            const cell = document.querySelector(
                `[data-row="${i}"][data-col="${currentStep % gridSize}"]`
            );
            handleCell(cell, time);
        }
    } else if (playMode === playModes.word) {
        acrossWords.forEach((word) => {
            const cellCoords = word[currentStep % word.length];
            const cell = document.querySelector(
                `[data-col="${cellCoords[0]}"][data-row="${cellCoords[1]}"]`
            );

            handleCell(cell, time)
        });
    }

    const bpm = document.querySelector(".bpm-input input").value;
    Tone.Transport.bpm.value = bpm;

    // Move to next step
    currentStep = currentStep + 1;
}

function handleCell(cell, time) {
    cell.classList.add("active");

    const triggerTime = time + timeOffset;

    if (playMode === playModes.grid && cell.classList.contains("block")) {
        cell.classList.add("playing");
        playNote(cell, triggerTime);
        timeOffset += 0.0001
    } else if (cell.dataset.text === 'K') {
        cell.classList.add("playing");
        if (!alreadyPlaying.kick) {
            drums.player('kick').start(triggerTime);
            timeOffset += 0.0001
            alreadyPlaying.kick = true
        }
    } else if (cell.dataset.text === 'S') {
        cell.classList.add("playing");
        if (!alreadyPlaying.snare) {
            drums.player('snare').start(triggerTime);
            timeOffset += 0.0001
            alreadyPlaying.snare = true
        }
    } else if (cell.dataset.text === 'H') {
        cell.classList.add("playing");
        if (!alreadyPlaying.snare) {
            drums.player('hat').start(triggerTime);
            timeOffset += 0.0001
            alreadyPlaying.hat = true
        }
    } else if (playMode === playModes.word && cell.dataset.text) {
        cell.classList.add("playing")
        playNote(cell, triggerTime)
        timeOffset += 0.0001
    }
}

function playNote(cell, time) {
    if (!synths[cell.dataset.row]) return;

    const note = notes[cell.dataset.row] || "A3";

    // Schedule the note at the precise time
    synths[cell.dataset.row].triggerAttackRelease(note, "16n", time);
}

function startSequencer() {
    if (Tone.Transport.state === "started") return;

    // this allows audio to play in iOS even then the hardware mute switch is on
    if (navigator.audioSession) {
        navigator.audioSession.type = "playback";
    }

    // Initialize sequencer loop if not already created
    if (!sequencerLoop) {
        sequencerLoop = new Tone.Loop((time) => {
            playStep(time);
        }, "8n");
    }

    // Start Tone.js audio context
    Tone.start();

    // Start the sequencer loop if not already running
    if (!sequencerLoop.started) {
        sequencerLoop.start(0);
    }

    // Start the transport
    Tone.Transport.start();
}

function stopSequencer() {
    if (Tone.Transport.state === "stopped" || Tone.Transport.state === "paused")
        return;

    // Stop the sequencer loop
    if (sequencerLoop && sequencerLoop.started) {
        sequencerLoop.stop();
    }

    // Pause the transport (preserves position)
    Tone.Transport.pause();

    // Remove all playing highlights
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell) => {
        cell.classList.remove("playing");
        cell.classList.remove("active");
    });
}

function updateInputFocusability() {
    const isTextMode = blocksToggleSwitch && !blocksToggleSwitch.checked;
    document.querySelectorAll(".cell-input").forEach((input) => {
        if (isTextMode) {
            input.style.pointerEvents = "auto";
            input.tabIndex = 0;
        } else {
            input.style.pointerEvents = "none";
            input.tabIndex = -1;
        }
    });
}

main();
