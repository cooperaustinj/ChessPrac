import { useState, useEffect, useRef } from 'react'
import {
    Button,
    Stack,
    Text,
    Group,
    Code,
    Box,
    Grid,
    Center,
    rem,
    Title,
    RangeSlider,
    ActionIcon,
    Modal,
    TextInput,
    Tooltip,
} from '@mantine/core'
import { DoubleStrikeChessGenerator, Position, SimplePiece, pieceToSimplePiece } from './double-strike'
import { Piece, PromotionPieceOption, Square } from 'react-chessboard/dist/chessboard/types'
import { IconShare, IconSwords, IconInfoCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useNavigate, useLocation } from 'react-router-dom'
import { MyChessboard } from '../components/my-chessboard'
import { useDocumentTitle } from '@mantine/hooks'

// Add type for piece with unique ID
type TrackedPiece = {
    id: string
    type: SimplePiece
}

// Update GameState type
type GameState = {
    board: (TrackedPiece | null)[][]
    moveCount: Map<string, number> // Track by piece ID
}

function algebraicToPosition(square: string): Position {
    const file = square.charCodeAt(0) - 97
    const rank = 8 - parseInt(square[1])
    return { x: file, y: rank }
}

function positionToFen(board: (TrackedPiece | null)[][], moveCount: Map<string, number>): string {
    return board
        .map(row =>
            row
                .map(cell => {
                    if (!cell) return '1'
                    return cell.type
                })
                .join('')
                .replace(/1+/g, match => match.length.toString()),
        )
        .join('/')
}

const MIN_PIECE_COUNT = 3
const MAX_PIECE_COUNT = 27
const STORAGE_KEY = 'doubleStrikeChessPieceCount'
const RULES_READ_KEY = 'doubleStrikeChessRulesRead'

// Add this validation function
function isValidFen(fen: string): boolean {
    // Check if FEN has all 6 required parts
    const parts = fen.split(' ')
    if (parts.length !== 6) return false

    // Extract piece placement part
    const piecePlacement = parts[0]
    const rows = piecePlacement.split('/')
    if (rows.length !== 8) return false

    // Validate each row
    const validPiecePlacement = rows.every(row => {
        let count = 0
        for (const char of row) {
            if (isNaN(parseInt(char))) {
                count++
            } else {
                count += parseInt(char)
            }
        }
        return count === 8
    })

    // Basic validation of other FEN components
    const [, turn, castling, enPassant, halfmove, fullmove] = parts

    if (!validPiecePlacement) return false
    if (turn !== 'w' && turn !== 'b') return false
    if (!/^(-|[KQkqAHa-h]+)$/.test(castling)) return false
    if (!/^(-|[a-h][36])$/.test(enPassant)) return false
    if (!/^\d+$/.test(halfmove)) return false
    if (!/^\d+$/.test(fullmove)) return false

    return true
}

export function DoubleStrikeChess() {
    useDocumentTitle('Double Strike | ChessPrac')
    const navigate = useNavigate()
    const location = useLocation()
    const [gameState, setGameState] = useState<GameState>({
        board: Array(8)
            .fill(null)
            .map(() => Array(8).fill(null)),
        moveCount: new Map(),
    })
    const [solution, setSolution] = useState<string[]>([])
    const [showSolution, setShowSolution] = useState(false)
    const remainingPieces = gameState.board.flat().filter(piece => piece !== null).length
    const [originalFen, setOriginalFen] = useState('')
    const [elapsedTime, setElapsedTime] = useState(0)
    const [isGenerating, setIsGenerating] = useState(false)
    const [rulesOpen, setRulesOpen] = useState(false)
    const captureSound = new Audio('/capture.mp3')
    const winSound = new Audio('/win.wav')
    const [isActive, setIsActive] = useState(false)
    const [hasReadRules, setHasReadRules] = useState(() => {
        return localStorage.getItem(RULES_READ_KEY) === 'true'
    })
    const lastNotifiedFen = useRef<string>('')

    const positionFen = positionToFen(
        gameState.board.map(row =>
            row.map(cell => {
                if (!cell) return null
                // If it has moved twice, make it black
                if ((gameState.moveCount.get(cell.id) || 0) >= 2) {
                    return {
                        ...cell,
                        type: cell.type.toLowerCase() as SimplePiece,
                    }
                }
                return cell
            }),
        ),
        gameState.moveCount,
    )

    // Load initial piece count from localStorage or use defaults
    const initialPieceCount = (() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                if (
                    Array.isArray(parsed) &&
                    parsed.length === 2 &&
                    typeof parsed[0] === 'number' &&
                    typeof parsed[1] === 'number' &&
                    parsed[0] >= MIN_PIECE_COUNT &&
                    parsed[1] <= MAX_PIECE_COUNT
                ) {
                    return [parsed[0], parsed[1]] as [number, number]
                }
            } catch (e) {
                console.error('Failed to parse stored piece count')
            }
        }
        return [5, 10] as [number, number]
    })()

    const [pieceCountRange, setPieceCount] = useState<[number, number]>(initialPieceCount)

    // Save to localStorage whenever piece count changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pieceCountRange))
    }, [pieceCountRange])

    // Update timer effect
    useEffect(() => {
        // Start timer when puzzle begins (more than 1 piece and not completed)
        if (remainingPieces > 1 && !isActive) {
            setIsActive(true)
        } else if (remainingPieces === 1 && isActive) {
            setIsActive(false)
            // Play win sound when puzzle is completed
            winSound.play().catch(err => console.error('Error playing sound:', err))
        }
    }, [remainingPieces, isActive])

    // Separate effect for the timer itself
    useEffect(() => {
        let startTime = Date.now() - elapsedTime * 1000
        let intervalId: number | undefined

        if (isActive) {
            intervalId = window.setInterval(() => {
                const currentTime = Date.now()
                const newElapsed = Math.floor((currentTime - startTime) / 1000)
                setElapsedTime(newElapsed)
            }, 100)
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId)
            }
        }
    }, [isActive]) // Only depend on isActive state

    const generateNewPuzzle = async (isInitial: boolean = false) => {
        setIsGenerating(true)
        setIsActive(false) // Reset active state
        setElapsedTime(0)
        try {
            const gen = new DoubleStrikeChessGenerator()
            const randomPieceCount =
                Math.floor(Math.random() * (pieceCountRange[1] - pieceCountRange[0] + 1)) + pieceCountRange[0]
            try {
                await gen.generate(randomPieceCount)
            } catch (err) {
                notifications.show({
                    message: 'Puzzle generation failed. Please try again or choose fewer pieces.',
                    color: 'red',
                })
                setIsGenerating(false)
                return
            }

            const newFen = gen.getFEN() + ' w - - 0 1'
            const newSolution = gen.getSolution()

            // Push new state to history
            const searchParams = new URLSearchParams()
            searchParams.set('fen', newFen)
            searchParams.set('sol', btoa(JSON.stringify(newSolution)))
            navigate(`/double-strike?${searchParams.toString()}`, { replace: isInitial })

            setElapsedTime(0)
            setOriginalFen(newFen)
            setSolution(newSolution)
            setShowSolution(false)

            setGameState({
                board: fenToBoard(newFen),
                moveCount: new Map(),
            })
        } finally {
            setIsGenerating(false)
        }
    }

    // Add helper function to convert FEN to board
    const fenToBoard = (fen: string) => {
        const rows = fen.split(' ')[0].split('/')
        let pieceCounter = 0
        return rows.map(row => {
            const cells: (TrackedPiece | null)[] = []
            for (const char of row) {
                if (isNaN(parseInt(char))) {
                    cells.push({
                        id: `piece_${pieceCounter++}`,
                        type: char as SimplePiece,
                    })
                } else {
                    cells.push(...Array(parseInt(char)).fill(null))
                }
            }
            return cells
        })
    }

    // Update effect to handle history navigation
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const fenParam = params.get('fen')
        const solParam = params.get('sol')

        if (fenParam) {
            if (!isValidFen(fenParam)) {
                // Clear the invalid state but keep the invalid FEN displayed
                setGameState({
                    board: Array(8)
                        .fill(null)
                        .map(() => Array(8).fill(null)),
                    moveCount: new Map(),
                })
                setElapsedTime(0)
                setIsActive(false)
                setOriginalFen(fenParam) // Keep the invalid FEN in the text box

                // Show notification only if we haven't already notified for this FEN
                if (lastNotifiedFen.current !== fenParam) {
                    lastNotifiedFen.current = fenParam
                    notifications.show({
                        message: 'Invalid FEN in URL. Please start a new puzzle.',
                        color: 'red',
                    })
                }
                return
            }

            setOriginalFen(fenParam)
            setGameState({
                board: fenToBoard(fenParam),
                moveCount: new Map(),
            })
            setElapsedTime(0)
            setShowSolution(false)

            if (solParam) {
                try {
                    const decodedSolution = JSON.parse(atob(solParam))
                    setSolution(decodedSolution)
                } catch (e) {
                    console.error('Failed to decode solution')
                }
            }
        } else if (location.pathname === '/double-strike' && !location.search) {
            // Only generate new puzzle on initial load
            generateNewPuzzle(true)
        }
    }, [location]) // Remove originalFen from dependencies since we're using a ref

    function hasLineOfSight(from: Position, to: Position, board: (TrackedPiece | null)[][]): boolean {
        const dx = to.x - from.x
        const dy = to.y - from.y

        // Determine step direction
        const stepX = dx === 0 ? 0 : dx / Math.abs(dx)
        const stepY = dy === 0 ? 0 : dy / Math.abs(dy)

        // Check each square between from and to (exclusive)
        let x = from.x + stepX
        let y = from.y + stepY

        while (x !== to.x || y !== to.y) {
            if (board[y][x] !== null) {
                return false // Path is blocked
            }
            x += stepX
            y += stepY
        }

        return true
    }

    function isValidMove(from: Position, to: Position, piece: SimplePiece, board: (TrackedPiece | null)[][]): boolean {
        const dx = Math.abs(from.x - to.x)
        const dy = Math.abs(from.y - to.y)

        // Check if target is a king
        const targetPiece = board[to.y][to.x]
        if (targetPiece?.type === 'K') {
            return false // Cannot capture kings
        }

        switch (piece) {
            case 'P':
                return dx === 1 && to.y - from.y === -1
            case 'N':
                return (dx === 2 && dy === 1) || (dx === 1 && dy === 2)
            case 'B':
                return dx === dy && hasLineOfSight(from, to, board)
            case 'R':
                return (dx === 0 || dy === 0) && hasLineOfSight(from, to, board)
            case 'Q':
                return (dx === dy || dx === 0 || dy === 0) && hasLineOfSight(from, to, board)
            case 'K':
                return dx <= 1 && dy <= 1
            default:
                return false
        }
    }

    function onPieceDrop(sourceSquare: Square, targetSquare: Square, piece: Piece): boolean {
        const fromPos = algebraicToPosition(sourceSquare)
        const toPos = algebraicToPosition(targetSquare)

        const sourcePiece = gameState.board[fromPos.y][fromPos.x]
        const targetPiece = gameState.board[toPos.y][toPos.x]

        // Validation checks
        if (!targetPiece || !sourcePiece) return false
        const currentMoves = gameState.moveCount.get(sourcePiece.id) || 0
        if (currentMoves >= 2) return false
        if (!isValidMove(fromPos, toPos, sourcePiece.type, gameState.board)) return false

        const newPiece: TrackedPiece = {
            id: sourcePiece.id,
            type: pieceToSimplePiece(piece),
        }

        const newBoard = gameState.board.map(row => [...row])
        newBoard[toPos.y][toPos.x] = newPiece
        newBoard[fromPos.y][fromPos.x] = null

        const newMoveCount = new Map(gameState.moveCount)
        newMoveCount.set(sourcePiece.id, currentMoves + 1)

        setGameState({
            board: newBoard,
            moveCount: newMoveCount,
        })

        captureSound.play().catch(err => console.error('Error playing sound:', err))
        return true
    }

    function onPromotionPieceSelect(
        piece?: PromotionPieceOption,
        sourceSquare?: Square,
        targetSquare?: Square,
    ): boolean {
        if (!piece || !sourceSquare || !targetSquare) return false

        const fromPos = algebraicToPosition(sourceSquare)
        const toPos = algebraicToPosition(targetSquare)

        const sourcePiece = gameState.board[fromPos.y][fromPos.x]
        if (!sourcePiece) return false

        const promotedPiece: TrackedPiece = {
            id: sourcePiece.id,
            type: pieceToSimplePiece(piece),
        }

        const newBoard = gameState.board.map(row => [...row])
        newBoard[toPos.y][toPos.x] = promotedPiece
        newBoard[fromPos.y][fromPos.x] = null

        const newMoveCount = new Map(gameState.moveCount)
        const currentMoves = gameState.moveCount.get(sourcePiece.id) || 0
        newMoveCount.set(sourcePiece.id, currentMoves + 1)

        setGameState({
            board: newBoard,
            moveCount: newMoveCount,
        })

        captureSound.play().catch(err => console.error('Error playing sound:', err))
        return true
    }

    function onPromotionCheck(sourceSquare: Square, targetSquare: Square, piece: Piece): boolean {
        if (!sourceSquare || !targetSquare || !piece) return false

        const fromPos = algebraicToPosition(sourceSquare)
        const toPos = algebraicToPosition(targetSquare)

        // Check if there's a piece to capture
        const targetPiece = gameState.board[toPos.y][toPos.x]
        if (!targetPiece) return false

        // Get the source piece to check its move count
        const sourcePiece = gameState.board[fromPos.y][fromPos.x]
        if (!sourcePiece) return false

        // Check move count limit using the piece's ID
        const currentMoves = gameState.moveCount.get(sourcePiece.id) || 0
        if (currentMoves >= 2) return false

        // Check if it's a valid pawn capture move
        const dx = Math.abs(fromPos.x - toPos.x)
        if (dx !== 1) return false // Must be a diagonal capture

        // For white pawns moving up (negative dy)
        if (piece === 'wP' && sourceSquare[1] === '7' && targetSquare[1] === '8') {
            return true
        }

        return false
    }

    function isDraggablePiece({ sourceSquare }: { piece: Piece; sourceSquare: Square }): boolean {
        if (remainingPieces === 1) return false
        const pos = algebraicToPosition(sourceSquare)
        const sourcePiece = gameState.board[pos.y][pos.x]
        if (!sourcePiece) return false
        const moves = gameState.moveCount.get(sourcePiece.id) || 0
        return moves < 2
    }

    const shareCurrentPosition = () => {
        navigator.clipboard.writeText(window.location.href)
        notifications.show({
            message: 'Link copied to clipboard',
            color: 'blue',
        })
    }

    // Format time as MM:SS
    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    const retryPuzzle = () => {
        setGameState({
            board: fenToBoard(originalFen),
            moveCount: new Map(),
        })
    }

    // Update rules modal close handler
    const handleRulesClose = () => {
        setRulesOpen(false)
    }

    const handleFenChange = (newFen: string) => {
        // If FEN only has piece placement, add standard suffix
        const parts = newFen.split(' ')
        if (parts.length === 1) {
            newFen = `${newFen} w - - 0 1`
        }

        if (!isValidFen(newFen)) {
            notifications.show({
                message: 'Invalid FEN format',
                color: 'red',
            })
            return
        }

        // Update URL and game state
        const searchParams = new URLSearchParams()
        searchParams.set('fen', newFen)
        navigate(`/double-strike?${searchParams.toString()}`, { replace: true })

        setOriginalFen(newFen)
        setGameState({
            board: fenToBoard(newFen),
            moveCount: new Map(),
        })
        setElapsedTime(0)
        setIsActive(false) // Stop the timer
        setShowSolution(false)
        setSolution([])
    }

    return (
        <Center
            w="100vw"
            h="auto"
            mt={{
                base: 'xs',
                md: rem(40),
            }}
        >
            <Stack w={{ base: '92%', md: '84%' }}>
                <Modal opened={rulesOpen} onClose={handleRulesClose} title="Double Strike Chess Rules" size="md">
                    <Text size="sm">Capture pieces until only one piece is left on the board.</Text>
                    <ol>
                        <Text size="sm" component="li">
                            Every move must capture a piece.
                        </Text>
                        <Text size="sm" component="li">
                            Pieces may move two times.
                        </Text>
                        <Text size="sm" component="li">
                            The King cannot be captured.
                        </Text>
                    </ol>
                </Modal>
                <Grid justify="center">
                    <Grid.Col span={{ base: 12, md: 5 }}>
                        <Group justify="space-between" align="center" gap={4} h={36}>
                            <Group gap="xs">
                                <IconSwords size={32} />
                                <Title order={2}>Double Strike</Title>
                            </Group>
                            <Tooltip
                                label="Read the rules"
                                position="left"
                                offset={12}
                                opened={!hasReadRules}
                                withArrow
                                arrowSize={6}
                                transitionProps={{ transition: 'fade', duration: 200 }}
                            >
                                <ActionIcon
                                    variant="subtle"
                                    size="xl"
                                    onClick={() => {
                                        setRulesOpen(true)
                                        if (!hasReadRules) {
                                            localStorage.setItem(RULES_READ_KEY, 'true')
                                            setHasReadRules(true)
                                        }
                                    }}
                                    title="Show rules"
                                    className={`rules-icon-wrapper ${!hasReadRules ? 'animate' : ''}`}
                                >
                                    <IconInfoCircle size={32} />
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    </Grid.Col>
                    <Grid.Col span={4} display={{ base: 'none', md: 'block' }}></Grid.Col>
                </Grid>
                <Grid justify="center">
                    <Grid.Col span={{ base: 12, md: 5 }}>
                        <Box>
                            <MyChessboard
                                position={positionFen}
                                onPieceDrop={onPieceDrop}
                                onPromotionPieceSelect={onPromotionPieceSelect}
                                onPromotionCheck={onPromotionCheck}
                                promotionDialogVariant="vertical"
                                boardOrientation="white"
                                animationDuration={0}
                                isDraggablePiece={isDraggablePiece}
                            />
                        </Box>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Stack h="100%" justify="space-between">
                            <Stack gap="md" flex={0}>
                                <Group justify="space-between">
                                    <Group>
                                        {remainingPieces === 1 && (
                                            <Box>
                                                <Button
                                                    variant="primary"
                                                    size="md"
                                                    onClick={() => generateNewPuzzle(false)}
                                                    loading={isGenerating}
                                                >
                                                    New Puzzle
                                                </Button>
                                            </Box>
                                        )}
                                        <Box>
                                            <Button
                                                variant="outline"
                                                size="md"
                                                onClick={retryPuzzle}
                                                className="plausible-event-name=double-strike:reset"
                                            >
                                                Reset Puzzle
                                            </Button>
                                        </Box>
                                    </Group>
                                    {remainingPieces > 1 && (
                                        <Text display={{ base: 'block', md: 'none' }}>
                                            {remainingPieces - 1} pieces left
                                        </Text>
                                    )}
                                </Group>
                                <Text
                                    size={rem(60)}
                                    fw={700}
                                    style={{ fontFamily: 'monospace' }}
                                    c={remainingPieces === 1 ? 'green' : undefined}
                                >
                                    {formatTime(elapsedTime)}
                                </Text>
                                {remainingPieces > 1 && (
                                    <Text display={{ base: 'none', md: 'block' }}>
                                        {remainingPieces - 1} pieces left
                                    </Text>
                                )}
                                {remainingPieces === 1 && (
                                    <Text size="xl" fw={700} c="green">
                                        Puzzle complete! 🎉
                                    </Text>
                                )}
                            </Stack>
                            <Stack gap="md">
                                {showSolution && (
                                    <Box>
                                        <Text>Solution</Text>
                                        <Code
                                            lh={1.8}
                                            fz="md"
                                            block
                                            style={{
                                                maxHeight: '300px',
                                                overflowY: 'auto',
                                            }}
                                        >
                                            {solution.reduce((acc, move, index) => {
                                                const moveText = `${(index + 1)
                                                    .toString()
                                                    .padStart(2, ' ')}..${move.padEnd(7)}`
                                                if ((index + 1) % 3 === 0) {
                                                    return acc + moveText + '\n'
                                                }
                                                return acc + moveText + '   '
                                            }, '')}
                                        </Code>
                                    </Box>
                                )}
                                <Box mb="lg">
                                    <Text size={rem(18)}>Piece Count</Text>
                                    <Text size={rem(12)} mb={8}>
                                        More pieces take longer to generate and may fail.
                                    </Text>
                                    <RangeSlider
                                        min={MIN_PIECE_COUNT}
                                        max={MAX_PIECE_COUNT}
                                        value={pieceCountRange}
                                        onChange={setPieceCount}
                                        minRange={1}
                                        marks={[
                                            ...[...Array((MAX_PIECE_COUNT - MIN_PIECE_COUNT) / 2 + 1)].map((_, i) => ({
                                                value: MIN_PIECE_COUNT + i * 2,
                                                label: (MIN_PIECE_COUNT + i * 2).toString(),
                                            })),
                                        ]}
                                    />
                                </Box>
                                <Group>
                                    <Button
                                        variant="outline"
                                        size="md"
                                        onClick={() => generateNewPuzzle(false)}
                                        loading={isGenerating}
                                    >
                                        New Puzzle
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="md"
                                        onClick={() => setShowSolution(!showSolution)}
                                        disabled={!solution.length}
                                    >
                                        {showSolution ? 'Hide Solution' : 'Solution'}
                                    </Button>
                                </Group>
                            </Stack>
                        </Stack>
                    </Grid.Col>
                </Grid>
                <Grid justify="center">
                    <Grid.Col span={{ base: 12, md: 5 }}>
                        <Box>
                            <Group gap="xs">
                                <ActionIcon
                                    variant="subtle"
                                    size="xl"
                                    onClick={shareCurrentPosition}
                                    title="Copy share link"
                                >
                                    <IconShare />
                                </ActionIcon>
                                <TextInput
                                    value={originalFen}
                                    onChange={e => handleFenChange(e.target.value)}
                                    onClick={e => e.currentTarget.select()}
                                    style={{ flex: 1 }}
                                    error={originalFen ? !isValidFen(originalFen) : false}
                                    readOnly
                                    onPaste={e => {
                                        e.preventDefault()
                                        const pastedText = e.clipboardData.getData('text')
                                        handleFenChange(pastedText)
                                    }}
                                />
                            </Group>
                        </Box>
                    </Grid.Col>
                    <Grid.Col span={4} display={{ base: 'none', md: 'block' }}></Grid.Col>
                </Grid>
            </Stack>
        </Center>
    )
}
