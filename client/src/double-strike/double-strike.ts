import { Piece } from 'react-chessboard/dist/chessboard/types'

/*
    The game is won by capturing until there is only one piece left on the board.
    1. Every move must capture a piece
    2. Pieces may only move twice
    3. If the king is on the board, it must be the last remaining piece (cannot be captured)
*/

export type SimplePiece = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'
export type Position = { x: number; y: number }
export type Move = {
    from: Position
    to: Position
    captured: SimplePiece
    piece: SimplePiece
    pieceId: string
    wasPromotion?: boolean
}

export function pieceToSimplePiece(piece: Piece) {
    return piece.split('')[1].toUpperCase() as SimplePiece
}

// Add type for piece weights
type PieceWeights = {
    readonly [K in SimplePiece]: number
}

const PIECE_WEIGHTS: PieceWeights = {
    K: 100, // King (only used when not excluding king)
    P: 3, // Pawn
    N: 4, // Knight
    B: 4, // Bishop
    R: 2, // Rook
    Q: 1, // Queen
}

export class DoubleStrikeChessGenerator {
    private board: (SimplePiece | null)[][] = Array(8)
        .fill(null)
        .map(() => Array(8).fill(null))
    private solution: Move[] = []
    private pieceCount = 0
    private moveCounts: Map<string, number> = new Map()
    private nextPieceId = 1
    private pieceLocations: Map<string, Position> = new Map()
    private readonly finalPiece: SimplePiece
    private lastUsedPiece: SimplePiece | null = null

    constructor(finalPiece?: SimplePiece) {
        if (finalPiece) {
            this.finalPiece = finalPiece
        } else {
            // Randomly select any piece type (including King)
            this.finalPiece = this.getRandomPiece(false)
        }
    }

    private generatePieceId(): string {
        return (this.nextPieceId++).toString()
    }

    private getRandomQuadrant(): Position {
        // Divide board into 4 quadrants and return random position within one
        const quadrant = Math.floor(Math.random() * 4)
        const x = Math.floor(Math.random() * 4) + (quadrant % 2) * 4
        const y = Math.floor(Math.random() * 4) + Math.floor(quadrant / 2) * 4
        return { x, y }
    }

    private randomPosition(): Position {
        // 30% chance to use quadrant-based positioning
        if (Math.random() < 0.3) {
            return this.getRandomQuadrant()
        }
        return {
            x: Math.floor(Math.random() * 8),
            y: Math.floor(Math.random() * 8),
        }
    }

    private isValidMove(
        from: Position,
        to: Position,
        piece: SimplePiece,
        isBackwardGeneration: boolean = false,
    ): boolean {
        const dx = Math.abs(from.x - to.x)
        const dy = to.y - from.y // Positive means moving down the board

        switch (piece) {
            case 'P':
                if (isBackwardGeneration) {
                    return dx === 1 && dy === 1
                } else {
                    return dx === 1 && dy === -1
                }
            case 'N':
                return (dx === 2 && Math.abs(dy) === 1) || (dx === 1 && Math.abs(dy) === 2)
            case 'B':
                return dx === Math.abs(dy) && this.hasLineOfSight(from, to)
            case 'R':
                return (dx === 0 || Math.abs(dy) === 0) && this.hasLineOfSight(from, to)
            case 'Q':
                return (dx === Math.abs(dy) || dx === 0 || Math.abs(dy) === 0) && this.hasLineOfSight(from, to)
            case 'K':
                return dx <= 1 && Math.abs(dy) <= 1
            default:
                return false
        }
    }

    private isSquareEmpty(pos: Position): boolean {
        return this.board[pos.y][pos.x] === null
    }

    private positionToAlgebraic(pos: Position): string {
        const file = String.fromCharCode(97 + pos.x)
        const rank = (8 - pos.y).toString()
        return `${file}${rank}`
    }

    private placePiece(piece: SimplePiece, position: Position): string {
        // Prevent pawns from being placed on first or last ranks
        if (piece === 'P' && position.y === 0) {
            throw new Error('Invalid pawn placement')
        }

        const pieceId = this.generatePieceId()
        this.board[position.y][position.x] = piece
        this.pieceCount++
        this.moveCounts.set(pieceId, 0)
        return pieceId
    }

    private removePiece(position: Position): void {
        this.board[position.y][position.x] = null
        this.pieceCount--
    }

    private findValidCapturePosition(
        from: Position,
        piece: SimplePiece,
    ): { position: Position; promotedPiece?: SimplePiece } | null {
        const candidates: Position[] = []
        const promotionCandidates: Position[] = []

        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const to = { x, y }
                // Skip if trying to capture a king
                if (this.board[y][x] === 'K') continue
                
                if (this.isSquareEmpty(to) && this.isValidMove(from, to, piece, true)) {
                    if (piece === 'P' && y === 0) {
                        promotionCandidates.push(to)
                    } else {
                        candidates.push(to)
                    }
                }
            }
        }

        // Prefer promotion moves if available
        if (piece === 'P' && promotionCandidates.length > 0) {
            const position = promotionCandidates[Math.floor(Math.random() * promotionCandidates.length)]
            const promotionPieces: SimplePiece[] = ['Q', 'R', 'B', 'N']
            const promotedPiece = promotionPieces[Math.floor(Math.random() * promotionPieces.length)]
            return { position, promotedPiece }
        }

        // Fall back to regular moves if no promotion or not selected
        if (candidates.length === 0 && promotionCandidates.length === 0) return null

        // Combine both arrays, with promotion moves still possible
        const allMoves = [...candidates, ...promotionCandidates]
        const position = allMoves[Math.floor(Math.random() * allMoves.length)]

        // Handle pawn promotion if we randomly selected a promotion move
        if (piece === 'P' && position.y === 0) {
            const promotionPieces: SimplePiece[] = ['Q', 'R', 'B', 'N']
            const promotedPiece = promotionPieces[Math.floor(Math.random() * promotionPieces.length)]
            return { position, promotedPiece }
        }

        return { position }
    }

    private hasExceededMoveLimit(pieceId: string): boolean {
        const moveCount = this.moveCounts.get(pieceId) || 0
        return moveCount >= 2
    }

    private incrementMoveCount(pieceId: string): void {
        const moveCount = this.moveCounts.get(pieceId) || 0
        this.moveCounts.set(pieceId, moveCount + 1)
    }

    private validateSolution(): boolean {
        const boardCopy = this.board.map(row => [...row])
        const moveCounts: Map<string, number> = new Map()

        for (const move of this.solution) {
            const fromPiece = boardCopy[move.from.y][move.from.x]
            const toPiece = boardCopy[move.to.y][move.to.x]

            // Ensure the piece exists at the source and matches
            if (!fromPiece || fromPiece !== move.piece || !toPiece || toPiece !== move.captured) {
                return false
            }

            // Ensure the move is valid
            if (!this.isValidMove(move.from, move.to, move.piece, false)) {
                return false
            }

            // Ensure the piece hasn't moved more than twice
            const moveCount = moveCounts.get(move.pieceId) || 0
            if (moveCount >= 2) {
                return false
            }
            moveCounts.set(move.pieceId, moveCount + 1)

            // Execute the move
            boardCopy[move.to.y][move.to.x] = move.piece
            boardCopy[move.from.y][move.from.x] = null
        }

        // Check final position
        const remainingPieces = boardCopy.flat().filter(cell => cell !== null)
        if (remainingPieces.length !== 1) return false

        // If there was a king in the starting position, it must be the final piece
        const hasKing = this.board.flat().some(cell => cell === 'K')
        if (hasKing && remainingPieces[0] !== 'K') return false

        return true
    }

    private getRandomPiece(excludeKing: boolean = true): SimplePiece {
        // Filter pieces based on whether we want to exclude the king
        const weights = Object.entries(PIECE_WEIGHTS)
            .filter(([piece]) => !excludeKing || piece !== 'K')
            .reduce<Partial<PieceWeights>>(
                (acc, [piece, weight]) => ({
                    ...acc,
                    [piece]: piece === this.lastUsedPiece ? weight * 0.1 : weight,
                }),
                {},
            )

        // Calculate total weight
        const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0)

        // Generate random number between 0 and total weight
        let random = Math.random() * totalWeight

        // Find the piece that corresponds to the random value
        for (const [piece, weight] of Object.entries(weights)) {
            random -= weight
            if (random <= 0) {
                this.lastUsedPiece = piece as SimplePiece
                return piece as SimplePiece
            }
        }

        // Fallback (should never reach here)
        return 'P'
    }

    private hasLineOfSight(from: Position, to: Position): boolean {
        const dx = to.x - from.x
        const dy = to.y - from.y

        // Determine step direction
        const stepX = dx === 0 ? 0 : dx / Math.abs(dx)
        const stepY = dy === 0 ? 0 : dy / Math.abs(dy)

        // Check each square between from and to (exclusive)
        let x = from.x + stepX
        let y = from.y + stepY

        while (x !== to.x || y !== to.y) {
            if (this.board[y][x] !== null) {
                return false // Path is blocked
            }
            x += stepX
            y += stepY
        }

        return true
    }

    public async generate(numPieces: number): Promise<void> {
        let globalAttempts = 0
        const maxGlobalAttempts = 10000 // Number of times to restart from scratch
        const maxLocalAttempts = 100 // Number of attempts per generation try

        while (globalAttempts < maxGlobalAttempts) {
            globalAttempts++
            let localAttempts = 0

            // Reset everything for a fresh attempt
            this.board = Array(8)
                .fill(null)
                .map(() => Array(8).fill(null))
            this.solution = []
            this.pieceCount = 0
            this.moveCounts.clear()
            this.nextPieceId = 1
            this.lastUsedPiece = null

            try {
                // Place final piece
                const finalPosition = this.randomPosition()
                if (this.finalPiece === 'P' && (finalPosition.y === 0 || finalPosition.y === 7)) {
                    throw new Error('Invalid final piece placement')
                }
                const finalPieceId = this.placePiece(this.finalPiece, finalPosition)
                this.pieceLocations.set(finalPieceId, finalPosition)

                while (this.pieceCount < numPieces && localAttempts < maxLocalAttempts) {
                    localAttempts++

                    // Find a piece that can still move
                    const movablePieces = Array.from(this.pieceLocations.entries())
                        .filter(([pieceId]) => !this.hasExceededMoveLimit(pieceId))

                    if (movablePieces.length === 0) {
                        // Try to place a new piece
                        let placementAttempts = 0
                        while (placementAttempts < 20) {
                            const newPos = this.randomPosition()
                            if (this.isSquareEmpty(newPos)) {
                                const newPiece = this.getRandomPiece(true)
                                const newPieceId = this.placePiece(newPiece, newPos)
                                this.pieceLocations.set(newPieceId, newPos)
                                break
                            }
                            placementAttempts++
                        }
                        continue
                    }

                    // Randomly select a piece that can still move
                    const [selectedPieceId, currentPos] = movablePieces[
                        Math.floor(Math.random() * movablePieces.length)
                    ]
                    
                    const currentPiece = this.board[currentPos.y][currentPos.x]!
                    const captureResult = this.findValidCapturePosition(currentPos, currentPiece)

                    if (!captureResult) continue

                    // Update piece tracking
                    this.removePiece(currentPos)
                    const movingPiece = captureResult.promotedPiece || currentPiece
                    this.placePiece(movingPiece, captureResult.position)
                    this.pieceLocations.set(selectedPieceId, captureResult.position)
                    this.incrementMoveCount(selectedPieceId)

                    const newPiece = this.getRandomPiece()
                    const newPieceId = this.placePiece(newPiece, currentPos)
                    this.pieceLocations.set(newPieceId, currentPos)

                    this.solution.push({
                        from: captureResult.position,
                        to: currentPos,
                        captured: newPiece,
                        piece: movingPiece,
                        pieceId: selectedPieceId,
                        wasPromotion: !!captureResult.promotedPiece,
                    })
                }

                // Check if we've succeeded
                if (this.pieceCount === numPieces) {
                    this.solution.reverse()
                    if (this.validateSolution()) {
                        return // Success!
                    }
                }

                // If we get here, this attempt failed
                throw new Error('Generation attempt failed')
            } catch (e) {
                // Failed attempt, continue to next global attempt
                // await new Promise(resolve => setTimeout(resolve, 1))
                continue
            }
        }

        throw new Error('Could not generate a valid puzzle after maximum attempts')
    }

    public getFEN(): string {
        return this.board
            .map(row =>
                row
                    .map(cell => (cell ? cell : '1'))
                    .join('')
                    .replace(/1+/g, match => match.length.toString()),
            )
            .join('/')
    }

    public getSolution(): string[] {
        return this.solution.map(move => {
            const from = this.positionToAlgebraic(move.from);
            const to = this.positionToAlgebraic(move.to);
            if (move.piece === 'P') {
                let notation = `${from[0]}x${to}`;
                if (move.wasPromotion) {
                    notation += `=${move.piece}`;
                }
                return notation;
            } else {
                return `${move.piece}${from}x${to}`;
            }
        });
    }
}
