import "./style.css" assert { type: "css" };

const INITIAL_GRID_SIZE = 8;
const MAX_GRID_SIZE = 16;

let gridSize = INITIAL_GRID_SIZE;
let cellStates = new Map(); // Store cell states as "row,col" -> boolean

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
        const cells = Array.from(grid.querySelectorAll(".cell"));
        const cellsByRow = [];
        for (let i = 0; i < gridSize; i++) {
            const rowCells = cells.filter(
                (cell) => parseInt(cell.dataset.row) === i
            );
            cellsByRow.push(rowCells);
        }
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
                // Insert after the last cell in this row
                const lastCellInRow = cellsByRow[i][cellsByRow[i].length - 1];
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
    });

    controlPanel.appendChild(clearButton);

    const grid = createGrid();
    machineContainer.appendChild(grid);
    updateGrid();
}

main();
