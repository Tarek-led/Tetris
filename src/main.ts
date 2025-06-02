/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 *
 *
 *
 */
// Importing styles and necessary libraries
import "./style.css";
import { fromEvent, interval, merge, BehaviorSubject } from "rxjs";
import { map, filter, scan, switchMap,throttleTime } from "rxjs/operators";


/** 
 * Constants related to the game viewport and grid.
 */
const Viewport = {
  // Width of the game canvas.
  CANVAS_WIDTH: 200,
  // Height of the game canvas.
  CANVAS_HEIGHT: 400,
  // Width of the block preview area.
  PREVIEW_WIDTH: 160,
  // Height of the block preview area.
  PREVIEW_HEIGHT: 80,
} as const;

/** 
 * Constants related to game mechanics.
 */
const Constants = {
  // The time interval in milliseconds for game ticks.
  TICK_RATE_MS: 150,
  // Width of the game grid. 
  GRID_WIDTH: 10,
  // Height of the game grid. 
  GRID_HEIGHT: 20,
} as const;

const Block = {
  /** Width of a game block. */
  WIDTH: Viewport.CANVAS_WIDTH / Constants.GRID_WIDTH,
  /** Height of a game block. */
  HEIGHT: Viewport.CANVAS_HEIGHT / Constants.GRID_HEIGHT,
};

/** User input */
type Key = "KeyS" | "KeyA" | "KeyD" | "KeyR" | "KeyH" | "Enter";

/** The following function is used to create a new block */
type Piece = {
  blocks: { x: number; y: number }[];
  center: { x: number; y: number };
};

/**  The following are the different types of blocks that can be created in the game */
const pieces: Piece[] = [
  // I Piece
  {
    blocks: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
    center: { x: 1.5, y: 0.5 },
  },
  // O Piece
  {
    blocks: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
    center: { x: 0.5, y: 0.5 },
  },
  // T Piece
  {
    blocks: [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    center: { x: 1, y: 1 },
  },
  //S Piece
  {
    blocks: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
    center: { x: 1, y: 1 },
  },
  // Z Piece
  {
    blocks: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    center: { x: 1, y: 1 },
  },
  // L Piece
  {
    blocks: [
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    center: { x: 1, y: 1 },
  },
    // J Piece
  {
    blocks: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    center: { x: 1, y: 1 },
  }

];

/**
 * Pseudo-random number generator (PRNG) with a seed.
 * @param {number} seed - The seed value.
 * @returns {function(): number} - A function that generates random numbers between 0 and 1.
 */
function seededRandom(seed: number) {
  let state = seed;

  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

// Create a seeded RNG function
const rng = seededRandom(4);

/**
 * Get a new random Tetris piece from the given set of Tetris pieces.
 * @param {Piece[]} pieces - An array of Tetris piece configurations.
 * @returns {Piece} - A randomly selected Tetris piece.
 */
const getNewPiece = (pieces: Piece[]) => {
  const randomIndex = Math.floor(rng() * pieces.length);
  return pieces[randomIndex];
};


/**
 * Represents the different types of actions in the game.
 */
type Action = "hold" | "rotate" | "restart" | moveBy | String;
/**
 * Represents the current score state in the Tetris game.
 */
type Score = Readonly<{
  // The current score achieved in the game. 
  score: number;
  // The highest score achieved in the game session. 
  highScore: number;
}>;

/**
 * Represents the state of the Tetrimino (Tetris piece) in the game.
 */
type Tetrinimo = Readonly<{
  // The position of the Tetrimino on the game grid.
  piecePositions: { x: number; y: number };
  // The current Tetris piece that is in play.
  currentPiece: Piece;
  // The next Tetris piece that will appear on the grid.
  nextPiece: Piece;
  // The Tetris piece that is held by the player, if any. Null if no piece is held.
  holdPiece: Piece | null;
  // Indicates whether the "hold" action has been used for the current piece.
  hasUsedHold: boolean;
}>;

/**
 * Represents the overall game state in Tetris.
 */
type State = Readonly<{
  // The tick rate determines the speed of the game.
  tickRate: number;
  // Indicates whether the tick rate has been increased due to player performance.
  isTickRateIncreased: boolean;
  // The total number of rows cleared in the game.
  rowsCleared: number;
  // Indicates whether the game has ended (e.g., due to reaching the top).
  gameEnd: boolean;
  // The state of the Tetrimino (Tetris piece) and game grid.
  tetrinimo: Tetrinimo;
  // Represents the game grid where Tetriminos are placed.
  grid: number[][];
  // The current score state. 
  score: Score;
}>;

/**
 * Represents the initial state of the Tetris game.
 */
const initialState: State = {
  rowsCleared: 0,
  tickRate: Constants.TICK_RATE_MS,
  isTickRateIncreased: false,
  gameEnd: false,
  tetrinimo: {
    piecePositions: { x: 5, y: 0 },
    currentPiece: getNewPiece(pieces),
    nextPiece: getNewPiece(pieces),
    holdPiece: null,
    hasUsedHold: false,
  },
  grid: Array.from({ length: Constants.GRID_HEIGHT }, 
    () => Array(Constants.GRID_WIDTH).fill(0)),
  score: {
    score: 0,
    highScore: 0,
  },
} as const;


/**
 * Rotates a Tetris piece clockwise around its center.
 * @param piece The Tetris piece to rotate
 * @returns The rotated Tetris piece
 */
const rotatePiece = (piece: Piece): Piece => {
  
  // Use the defined center of rotation for the piece
  const centerX = piece.center.x;
  const centerY = piece.center.y;
  
  // Rotate each block around the center of rotation
  const rotatedBlocks = piece.blocks.map(block => {
      const relX = block.x - centerX;
      const relY = block.y - centerY;
      // Calculate the new coordinates
      const newX = Math.round(centerX - relY);
      const newY = Math.round(centerY + relX);
      return { x: newX, y:newY };
  });
  
  // Create a new piece object with the rotated blocks
  return {...piece, blocks : rotatedBlocks};
  };

/**
 * Handles the "rotate" action in the game state.
 * @param s The current game state
 * @returns Updated game state after rotation or the same state if collision occurred
 */
const rotateAction = (s: State): State => {
  // Rotate the current piece
  const rotatedPiece = rotatePiece(s.tetrinimo.currentPiece);
  // Check for collisions with the rotated piece
  const collision = checkCollisionWithAnyBlock(s, { x: 0, y: 0 }, rotatedPiece);
  // If there is a collision, return the current state without making any changes
  return collision ? s : { ...s, tetrinimo: { ...s.tetrinimo, currentPiece: rotatedPiece } };
};

/**
 * Handles the "restart" action in the game state.
 * @param currentState The current game state
 * @returns The initial game state with preserved high score
 */
const restartAction = (currentState: State): State => {
  // Reset the game state to initial values, preserving the high score 
  return {
    ...initialState,
    score: {
      ...currentState.score,
    },
  };
};

/**
 * Checks for collisions with game boundaries or anchored blocks after a move.
 * @param s The current game state
 * @param move The movement action
 * @param newX The new x-coordinate after the move
 * @param newY The new y-coordinate after the move
 * @returns "boundary" if collision with boundaries, "collision" if collision with blocks, or "noCollision" if no collision
 */
const checkCollisionsWithBoundaries = (s: State, move: moveBy, newX: number, newY: number) => {
  const newBlockPositions = s.tetrinimo.currentPiece.blocks.map(block => ({
    x: newX + block.x,
    y: newY + block.y,
  }));

  // Check for collisions with the left and right boundaries
  const hitsLeftBoundary = newBlockPositions.some(block => block.x < 0);
  const hitsRightBoundary = newBlockPositions.some(block => block.x >= Constants.GRID_WIDTH);

  // Check for collisions with the bottom boundary
  if (hitsLeftBoundary || hitsRightBoundary) {
    return "boundary";
  }

  // Check for collisions with the ground or anchored blocks below
  if (checkCollisionWithAnyBlock(s, move)) {
    return "collision";
  }

  // Return noCollision if no collision occurred
  return "noCollision";
};

/**
 * Handles movement actions, checks for collisions, and updates the game state.
 * @param s The current game state
 * @param move The movement action
 * @param newX The new x-coordinate after the move
 * @param newY The new y-coordinate after the move
 * @returns Updated game state after movement or null if collision occurred
 */
const handleBoundaryCollision = (s: State) => (move: moveBy, newX: number, newY: number) => {
  // Check for collisions with the boundaries
  const collisionCheckResult = checkCollisionsWithBoundaries(s, move, newX, newY);
  // If there is a collision, return the current state without making any changes
  return collisionCheckResult === "boundary" ? s : null;
};

/**
 * Handles collisions with filled rows, clears them, and updates the game state.
 * @param s The current game state
 * @param newGrid The grid after the current piece has been added
 * @param newY The new y-coordinate after the move
 * @returns Updated game state after row clearing or game-over state if necessary
 */
const handleCollisionWithRows = (s: State) => (newGrid: number[][], newY:number) => {
  const { clearedRowsCount, newGrid: clearedGrid } = clearRows(newGrid);
  
  if (newY <= 1) {
    return handleGameOver(s);
  }

  const newScore = calculateUpdatedScore(clearedRowsCount, s.score.score);
  const isTickRateIncreased = newScore >= 2 && !s.isTickRateIncreased;
  const newTickRate = isTickRateIncreased ? Constants.TICK_RATE_MS / 2 : s.tickRate;

  return updateGameState(s, clearedGrid, newScore, isTickRateIncreased, newTickRate);
};

/**
 * Handles movement when there is no collision, updates the game state.
 * @param s The current game state
 * @param move The movement action
 * @param newX The new x-coordinate after the move
 * @param newY The new y-coordinate after the move
 * @returns Updated game state after movement
 */
const handleNoCollisionWithRows = (s: State) => (move: moveBy, newX: number, newY: number) => {
  // Return the updated state
  const newState = {
    ...s,
    tetrinimo: {
      ...s.tetrinimo,
      piecePositions: { x: newX, y: newY },
    },
  };
  return newState;
};

/**
 * Handles movement, detects collisions, and updates the game state.
 * 
 * The function checks for two types of collisions:
 * 1. Boundary collisions (with the walls or the ground of the game grid)
 * 2. Block collisions (with anchored tetrominos)
 * 
 * The function behaves differently based on the direction of the movement:
 * For sideways movements (left or right): If there's a block collision,
 * the function will block the move but will not anchor the tetromino. 
 * The tetromino can still move in other directions. If there's a boundary 
 * collision, it will block the move and return the current state.
 * For downward movements: If there's a block collision, the tetromino will be 
 * anchored, the grid will be updated, and the game will proceed to handle row clearings 
 * or any related tasks.
 * 
 * @param s The current game state
 * @param move The movement action, can indicate left, right, or downward movement
 * @param newX The new x-coordinate after the move
 * @param newY The new y-coordinate after the move
 * @returns Updated game state after handling collisions or the current game state if a collision occurs that prevents the move.
 */
const handleCollisionAndUpdateState = (s: State) => (move: moveBy) => (newX: number, newY: number) => {
  const boundaryCollisionResult = handleBoundaryCollision(s)(move, newX, newY);
  
  if (boundaryCollisionResult !== null) {
    return boundaryCollisionResult;
  }

  const collisionWithBlock = checkCollisionWithAnyBlock(s, move);
  
  if (collisionWithBlock) {
    // If moving sideways and there's a collision, block the move but don't anchor the piece.
    if (move.x !== 0) {
      return s;
    }

    // If moving downwards and there's a collision, then it's time to anchor the piece.
    if (move.y > 0) {
      const newGrid = updateGridWithPiece(s.grid, s.tetrinimo.currentPiece, s.tetrinimo.piecePositions);
      return handleCollisionWithRows(s)(newGrid, newY);
    }
  }
  
  return handleNoCollisionWithRows(s)(move, newX, newY);
};


/**
 * Moves the current piece by the given amount, handles collisions, and updates the state.
 * @param s Current state
 * @param move Amount to move in x and y directions
 * @returns Updated state after movement or null if collision occurred
 */
const moveAction = (s: State, move: moveBy, newX:number,newY:number): State | null => {
  
  // Clear any completed rows and obtain the updated grid
  const {newGrid} = clearRows(s.grid);

  // Handle collision detection and update the game state with the new grid
  const newState = handleCollisionAndUpdateState({
    ...s,
    grid: newGrid,
  })(move)(newX, newY);

  return newState;
};

/**
 * Handles movement actions and updates the game state accordingly.
 * @param s The current game state
 * @param move The movement action
 * @returns Updated game state after movement
 */
const handleMove = (s: State, move: moveBy): State => {
  // Calculate the new x and y coordinates after the move
  const newX = s.tetrinimo.piecePositions.x + move.x;
  const newY = s.tetrinimo.piecePositions.y + move.y;
  
  // Use the moveAction function to update the game state with the new coordinates
  const updatedStateAfterMoving = moveAction(s, move,newX,newY);

  // Check if a collision occurred during the movement
  if (updatedStateAfterMoving === null) {
    // If a collision occurred, return the current state without making any changes
    return s;
  } 
  // If no collision occurred, return the updated state
  return updatedStateAfterMoving;
};

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
  namespace: string | null,
  name: string,
  props: Record<string, string> = {}
) => {
  const elem = document.createElementNS(namespace, name) as SVGElement;
  Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
  return elem;
};

/**
 * Handle game-over state and reset the game.
 * @param s The current game state
 * @returns New game state after game over
 */
const handleGameOver = (s: State) => {
  const newHighScore = Math.max(s.score.highScore, s.score.score);
  return {
    ...initialState,
    gameEnd: true,
    isTickRateIncreased: false,
    score: {
      ...s.score,
      highScore: newHighScore,
      score: 0,
    },
  };
};

/**
 * Calculate the updated score based on the number of cleared rows and the current score.
 * @param clearedRowsCount The number of cleared rows
 * @param currentScore The current score
 * @returns The updated score
 */
const calculateUpdatedScore = (clearedRowsCount: number, currentScore:number) => {
  return currentScore + clearedRowsCount;
};

/**
 * Update the game state with new values.
 * @param s The current game state
 * @param clearedGrid The grid after clearing rows
 * @param newScore The updated score
 * @param isTickRateIncreased Whether the tick rate has increased
 * @param newTickRate The new tick rate
 * @returns The updated game state
 */
const updateGameState = (s: State, clearedGrid: number[][], newScore: number, isTickRateIncreased:boolean, newTickRate:number) => {
  return {
    ...s,
    tickRate: newTickRate,
    isTickRateIncreased,
    tetrinimo: {
      ...s.tetrinimo,
      piecePositions: { x: 5, y: 0 },
      currentPiece: s.tetrinimo.nextPiece,
      nextPiece: getNewPiece(pieces),
    },
    grid: clearedGrid,
    score: {
      ...s.score,
      score: newScore,
    },
  };
};

/**
 * Moves the current piece by the given amount.
 * @param x Amount to move in x direction
 * @param y Amount to move in y direction
 * @returns Action
 */
class moveBy {constructor(public readonly x: number, public readonly y:number) {}}

/**
 * Checks if a coordinate is within the bounds of the game grid.
 * @param x The x-coordinate
 * @param y The y-coordinate
 * @returns `true` if the coordinate is within bounds, otherwise `false`
 */
const isWithinBounds = (x: number, y: number): boolean =>
  x >= 0 && x < Constants.GRID_WIDTH && y < Constants.GRID_HEIGHT;


/**
 * Checks if the current piece collides with the boundaries or anchored blocks
 * after the given move.
 * @param s The current game state
 * @param move The movement action
 * @param piece The piece to check for collision (optional, defaults to current piece)
 * @returns `true` if collision occurs, otherwise `false`
 */
const checkCollisionWithAnyBlock = (s: State, move: moveBy, piece: Piece = s.tetrinimo.currentPiece) => {
  // Calculate the new x and y coordinates after the move
  const newBlockPositions = {
    x: s.tetrinimo.piecePositions.x + move.x,
    y: s.tetrinimo.piecePositions.y + move.y,
  };
  // Calculate the new coordinates of the piece blocks
  const newCubes = piece.blocks.map(block => ({
    x: newBlockPositions.x + block.x,
    y: newBlockPositions.y + block.y,
  }));

  // Check if the new coordinates are within bounds
  const isOccupiedAt = ({ x, y }: { x: number; y: number }) =>
    s.grid[y][x] !== 0;
  return newCubes.some(cube => !isWithinBounds(cube.x, cube.y) || isOccupiedAt(cube)) ;
};

/**
 * Updates the grid with the current piece.
 * @param grid Current grid
 * @param piece Current piece
 * @param pos Position of the current piece
 * @returns Updated grid
 */
const updateGridWithPiece = (grid: number[][], piece: Piece, pos: { x: number, y: number }) => {
  return grid.map((row, rowIndex) => {
    return row.map((cell, columnIndex) => {
      const block = piece.blocks.find(block => block.y + pos.y === rowIndex && block.x + pos.x === columnIndex);
      if (block) {
        return 1;
      }
      return cell;
    });
  });
};

/**
 * Clears full rows from the grid.
 * @param grid Current grid
 * @returns Updated grid and number of cleared rows
 */
const clearRows = (grid: number[][]) => {
  // Filter out rows that contain at least one empty cell (cell with a value of 0)
  const remainingRows = grid.filter(row => row.includes(0));

  // Calculate the number of cleared rows by subtracting the remaining rows from the total grid height
  const clearedRowsCount = Constants.GRID_HEIGHT - remainingRows.length;

  // Create empty rows to replace the cleared rows, based on the count of cleared rows and grid width
  const emptyRows = Array.from({ length: clearedRowsCount }, () => Array(Constants.GRID_WIDTH).fill(0));

  // Return the number of cleared rows and the updated grid with empty rows at the top and remaining rows below
  return {
    clearedRowsCount,
    newGrid: [...emptyRows, ...remainingRows],
  };
};

/**
 * Updates the tetrinimo object within the game state.
 * @param s The current game state
 * @param newCurrentPiece The new current piece for the tetrinimo
 * @param newHoldPiece The new hold piece for the tetrinimo
 * @param newNextPiece The new next piece for the tetrinimo
 * @returns Updated game state with the tetrinimo object modified
 */
const updateTetrinimo = (
  s: State,
  newCurrentPiece: Piece,
  newHoldPiece: Piece,
  newNextPiece: Piece
): State => {
  // Create an updated tetrinimo object with the provided pieces
  const updatedTetrinimo: Tetrinimo & { hasUsedHold: boolean } = {
    ...s.tetrinimo,
    currentPiece: newCurrentPiece,
    nextPiece: newNextPiece,
    holdPiece: newHoldPiece,
    hasUsedHold: true,
  };

  // Return the updated game state with the modified tetrinimo object
  return {
    ...s,
    tetrinimo: updatedTetrinimo,
  };
};

/**
 * Handles the "hold" action in the game state.
 * @param s The current game state
 * @returns Updated game state after holding or the same state if conditions are not met
 */
const holdAction = (s: State): State => {
  // Check if hold has not been used 
  if (!s.tetrinimo.hasUsedHold) {
    // Store the current piece in the hold and replace it with the next piece
    const newHoldPiece = s.tetrinimo.currentPiece;
    const newCurrentPiece = s.tetrinimo.nextPiece;
    const newNextPiece = getNewPiece(pieces);

    // Use the updateTetrinimo function to update the tetrinimo object
    return updateTetrinimo(s, newCurrentPiece, newHoldPiece, newNextPiece);
  } else if (s.tetrinimo.holdPiece) {
    // Swap the current piece with the held piece
    const newCurrentPiece = s.tetrinimo.holdPiece;
    const newHoldPiece = s.tetrinimo.currentPiece;

    // Use the updateTetrinimo function to update the tetrinimo object
    return updateTetrinimo(s, newCurrentPiece, newHoldPiece, s.tetrinimo.nextPiece);
  }

  // If hold has already been used and there is no held piece, return the current state without making any changes.
  return s;
};

/**
 * Updates the game state based on various actions and user input.
 * @param s The current game state
 * @param action The action to be performed
 * @returns Updated game state after the action
 */
const handlingAction = (s: State, action: Action):State => {
  // Checks if the action is hold and if hold is available, then calls the holdAction function
  if (action === "hold" && isHoldAvailable(s)) {
    return holdAction(s);
  }

  // Checks if the action is rotate, then calls the rotateAction function
  if (action === "rotate") {
    return rotateAction(s);
  }

  // Checks if the action is restart and the game has ended, then calls the restartAction function
  if (action === "restart" && s.gameEnd) {
    return restartAction(s);
  }

  // Checks if the action is move, then calls the handleMove function
  if (action instanceof moveBy) {
    return handleMove(s, action);
  }

  // If the action is not any of the above, return the current state without making any changes
  return s;
};

/**
 * Checks if the "hold" action is available.
 * This is a placeholder function that always returns true.
 * @param s The current game state
 * @returns Always true
 */
const isHoldAvailable = (s: State): boolean => {
  return true;
};

/**
 * The main function that runs the game.
 * @returns void
 */
export function main() {
  // Canvas elements
  const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
    HTMLElement;
  const preview = document.querySelector("#svgPreview") as SVGGraphicsElement &
    HTMLElement;

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);
  preview.setAttribute("height", `${Viewport.PREVIEW_HEIGHT}`);
  preview.setAttribute("width", `${Viewport.PREVIEW_WIDTH}`);

  // Text fields
  const scoreText = document.querySelector("#scoreText") as HTMLElement;
  const highScoreText = document.querySelector("#highScoreText") as HTMLElement;
  
  /**
   * Observable representing the tick rate for the game loop.
   * Emits the tick rate at regular intervals.
   */
  const tickRate$ = new BehaviorSubject<number>(initialState.tickRate);

  /**
   * Observable that emits a tick signal at the specified tick rate.
   * Each tick signifies a game loop iteration.
   */
  const tick$ = tickRate$.pipe(
    // Use switchMap to switch to a new interval observable when the tick rate changes
    switchMap(tickRate => interval(tickRate).pipe(map(() => new moveBy(0, 1))))
  );
  
  /** User input */

  /**
   * Observable that captures keyboard keypress events.
   */
  const key$ = fromEvent<KeyboardEvent>(document, "keypress");

  /**
   * Creates an observable for a specific key code.
   * @param keyCode The key code to filter for.
   * @returns An observable that emits key events matching the specified key code.
   */
  const fromKey = (keyCode: Key) =>
    key$.pipe(filter(({ code }) => code === keyCode));


  /**
   * Observables for various user input actions.
   * Uses merge to combine multiple observables into a single observable.
   */
  const move$ = merge(
    // Key A moves the piece left
    fromKey("KeyA").pipe(map(() => new moveBy(-1, 0))),
    // Key D moves the piece right
    fromKey("KeyD").pipe(map(() => new moveBy(1, 0))),
    // Key S moves the piece down
    fromKey("KeyS").pipe(map(() => new moveBy(0, 1)))
    // throttleTime prevents the user from moving the piece too quickly which enhances the smoothness of the game
  ).pipe(throttleTime(tickRate$.value));
  
  // Key R rotates the piece
  const rotate$ = fromKey("KeyR").pipe(map(() => "rotate"));
  // Key Enter restarts the game
  const restart$ = fromKey("Enter").pipe(map(() => "restart"));
  // Key H holds the piece
  const hold$ = fromKey("KeyH").pipe(map(() => "hold"));

  /**
   * Clears the canvas by removing its inner HTML content.
   */
  const clearCanvas = () => {
    svg.innerHTML = ''; // Clear the canvas
  };

  /**
   * Clears the preview canvas by removing its inner HTML content.
   */
  const clearPreview = () => {
    preview.innerHTML = ''; // Clear the preview canvas
  };

  /**
   * Updates the displayed game score.
   * @param score The new game score to display.
   */
  const updateScoreText = (score:number) => {
    scoreText.innerHTML = score.toString();
  };
  
  /**
   * Updates the displayed high score.
   * @param highScore The new high score to display.
   */
  const updateHighScoreText = (highScore: number) => {
    highScoreText.innerHTML = highScore.toString();
  };
  
  /**
   * Updates the hold status label based on whether the "hold" action is available.
   * @param isAvailable Indicates whether the "hold" action is available.
   */
  const updateHoldStatusLabel = (isAvailable: boolean) => {
    // Get the hold status label
    const holdStatusLabel = document.querySelector("#holdStatusLabel");
    // Update the hold status label based on whether the "hold" action is available
    if (holdStatusLabel) { 
      // If the "hold" action is available, remove the "Unavailable" class and set the text to "Hold: Available"
      if (isAvailable) {
        holdStatusLabel.classList.remove("Unavailable");
        holdStatusLabel.innerHTML = "Hold: Available";
        // If the "hold" action is not available, add the "Unavailable" class and set the text to "Hold: Unavailable"
      } else {
        holdStatusLabel.classList.add("Unavailable");
        holdStatusLabel.innerHTML = "Hold: Unavailable";
      }
    }
  };

  /**
   * Appends an SVG element to the canvas.
   * @param svg The SVG canvas
   * @param elem The SVG element to append
   */
  function appendChild(svg: SVGElement, elem: SVGElement) {
    svg.appendChild(elem);
  }

  /**
   * Renders the current game state on the SVG canvas.
   * @param s The current game state
   * @returns void
   */
  const render = (s: State) => {
    // Clear the canvas
    clearCanvas();
    // Clear the preview canvas
    clearPreview();

    // Render the grid in the canvas
    s.grid.forEach((row, y) => {
      // Render each row
      row.forEach((cell, x) => {
        // Render each cell
        if (cell === 1) {
          // Render a red cube if the cell is occupied
          const cube = createSvgElement(svg.namespaceURI, "rect", {
            // Set the height, width, x, y, and style attributes
            height: `${Block.HEIGHT}`,
            width: `${Block.WIDTH}`,
            x: `${Block.WIDTH * x}`,
            y: `${Block.HEIGHT * y}`,
            style: "fill: red",
          });
          // Append the cube to the canvas
          appendChild(svg, cube);
        }
      });
    });

    // Render the current piece in the canvas
    s.tetrinimo.currentPiece.blocks.forEach((block) => {
      // Render each block
      const cube = createSvgElement(svg.namespaceURI, "rect", {
        // Set the height, width, x, y, and style attributes
        height: `${Block.HEIGHT}`,
        width: `${Block.WIDTH}`,
        x: `${Block.WIDTH * (s.tetrinimo.piecePositions.x + block.x)}`,
        y: `${Block.HEIGHT * (s.tetrinimo.piecePositions.y + block.y)}`,
        style: `fill: green`,
      });
      // Append the cube to the canvas
      appendChild(svg, cube);
    });
  
    // Render the next piece in the preview canvas
    s.tetrinimo.nextPiece.blocks.forEach((block) => {
      // Render each block
      const cubePreview = createSvgElement(preview.namespaceURI, "rect", {
        height: `${Block.HEIGHT}`,
        width: `${Block.WIDTH}`,
        x: `${Block.WIDTH * (3 + block.x)}`,
        y: `${Block.HEIGHT * (1 + block.y)}`,
        style: `fill: green`,
      });
      // Append the cube to the preview canvas
      appendChild(preview, cubePreview);
    });
};

/**
 * Renders the game-over screen with the final score.
 * @param s The final game state
 * @returns void
 */
const renderGameOver = () => {
  clearCanvas();
  clearPreview();

  // Display the game over text
  const gameOverText = createSvgElement(svg.namespaceURI, "text", {
    x: `${Viewport.CANVAS_WIDTH / 2}`,
    y: `${Viewport.CANVAS_HEIGHT / 2-15}`,
    "text-anchor": "middle",
    "alignment-baseline": "middle",
    "font-size": "16", 
    "font-weight": "bold", 
    fill: "black",
  });
  gameOverText.textContent = "Game Over";
  appendChild(svg, gameOverText);

  // Display the restart instructions
  const restartText = createSvgElement(svg.namespaceURI, "text", {
    x: `${Viewport.CANVAS_WIDTH / 2}`,
    y: `${Viewport.CANVAS_HEIGHT / 2 + 15}`, 
    "text-anchor": "middle",
    "alignment-baseline": "middle",
    "font-size": "16", 
    "font-weight": "bold",
    fill: "black",
  });
  restartText.textContent = "Click on Enter to restart";
  appendChild(svg, restartText);
};

/**
 * The source observable that combines all user action observables.
 * This observable emits game state updates based on user actions.
 */
const source$ = merge(move$, rotate$, restart$, hold$,tick$).pipe(
  scan(handlingAction, initialState)
);
  // Subscribe to the source observable
  source$.subscribe((s: State) => {
    // Render the current game state
    render(s);
    // Determine whether the "hold" action is available and update the Hold label accordingly
    const isHoldAvailableNow = isHoldAvailable(s);
    updateHoldStatusLabel(isHoldAvailableNow);
    // Update the tick rate observable with the new tick rate from the game state
    tickRate$.next(s.tickRate);

    // Check if the game has ended
    if (s.gameEnd) {
      // Game has ended, render the game-over screen
      renderGameOver();
      updateHoldStatusLabel(false);
    }
    // Update the displayed game score with the current score value
    updateScoreText(s.score.score);
    // Update the displayed high score with the current high score value
    updateHighScoreText(s.score.highScore);

  });
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
