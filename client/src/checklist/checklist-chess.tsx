import { useState, useEffect } from 'react'
import { Chess } from 'chess.js'
import {
    Button,
    Stack,
    Text,
    Group,
    Box,
    Grid,
    Center,
    rem,
    Title,
    Badge,
    ActionIcon,
    Modal,
    Tooltip,
    useMantineTheme,
} from '@mantine/core'
import { IconListDetails, IconCheck, IconInfoCircle, IconLink } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { MyChessboard } from '../components/my-chessboard'
import { Square, Piece } from 'react-chessboard/dist/chessboard/types'
import { useNavigate, useLocation } from 'react-router-dom'
import { WhiteKing } from '../components/WhiteKing'
import { BlackKing } from '../components/BlackKing'
import { useMediaQuery, useDocumentTitle } from '@mantine/hooks'
import classes from './checklist-chess.module.css'
import { plausibleEvent } from '../plausible'

type Phase = 'checks' | 'captures'
type Move = { from: Square; to: Square }
type GameState = {
    fen: string
    phase: Phase
    remainingChecks: Move[]
    remainingCaptures: Move[]
    foundMoves: Move[]
    playerColor: 'w' | 'b'
    puzzleId?: string
    rating?: number
    isLoaded: boolean
}

type CustomSquareStyles = {
    [square: string]: {
        backgroundColor?: string
        animation?: string
        className?: string
        boxShadow?: string
    }
}

const moveSound = new Audio('/move.mp3')
const captureSound = new Audio('/capture.mp3')
const successSound = new Audio('/success.mp3')
const failSound = new Audio('/fail.wav')
const winSound = new Audio('/win.wav')

const DIFFICULTIES = ['easier', 'normal', 'harder', 'hardest'] as const
type Difficulty = (typeof DIFFICULTIES)[number]

const getRandomDifficulty = (): Difficulty => {
    const randomIndex = Math.floor(Math.random() * DIFFICULTIES.length)
    return DIFFICULTIES[randomIndex]
}

const loadPuzzleById = async (puzzleId: string) => {
    const response = await fetch(`https://lichess.org/api/puzzle/${puzzleId}`)
    if (!response.ok) {
        plausibleEvent('checklist:puzzle-load-failed')
        throw new Error('Failed to load puzzle')
    }
    const data = await response.json()
    return data
}

export function ChecklistChess() {
    useDocumentTitle('Checklist | ChessPrac')
    const navigate = useNavigate()
    const location = useLocation()
    const [gameState, setGameState] = useState<GameState>({
        fen: '',
        phase: 'checks',
        remainingChecks: [],
        remainingCaptures: [],
        foundMoves: [],
        playerColor: 'w',
        isLoaded: false,
    })
    const [isLoading, setIsLoading] = useState(false)
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
    const [squareStyles, setSquareStyles] = useState<CustomSquareStyles>({})
    const [elapsedTime, setElapsedTime] = useState(0)
    const [isActive, setIsActive] = useState(false)
    const [invalidSquare, setInvalidSquare] = useState<Square | null>(null)
    const [correctSquare, setCorrectSquare] = useState<Square | null>(null)
    const [showRemainingCount, setShowRemainingCount] = useState(false)
    const [isComplete, setIsComplete] = useState(false)
    const [rulesOpen, setRulesOpen] = useState(false)
    const [hasReadRules, setHasReadRules] = useState(() => {
        return localStorage.getItem('checklistChessRulesRead') === 'true'
    })
    const isMobile = useMediaQuery('(max-width: 64em)')
    const [showSolution, setShowSolution] = useState(false)

    // Add timer effect
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
    }, [isActive])

    // Format time as MM:SS
    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    // Generate new puzzle
    const generateNewPuzzle = async (isInitial: boolean = false) => {
        setIsLoading(true)
        try {
            const difficulty = getRandomDifficulty()
            const response = await fetch(`https://lichess.org/api/puzzle/next?difficulty=${difficulty}`)
            const data = await response.json()

            const chess = new Chess()
            const moves = data.game.pgn.split(' ')
            moves.forEach((move: string) => {
                if (move.match(/^\d+\./) || move === '') return
                try {
                    chess.move(move)
                } catch (e) {
                    console.error('Invalid move:', move)
                }
            })

            const fen = chess.fen()
            const playerColor = chess.turn()
            const { checks, captures } = calculateMoves(fen)

            // Push new state to history only if not initial load or no puzzle ID
            if (!isInitial || !location.search) {
                const searchParams = new URLSearchParams()
                searchParams.set('puzzle', data.puzzle.id)
                navigate(`?${searchParams.toString()}`, { replace: isInitial })
            }

            setElapsedTime(0)
            setIsActive(false)

            setGameState({
                fen,
                phase: 'checks',
                remainingChecks: checks,
                remainingCaptures: captures,
                foundMoves: [],
                playerColor,
                puzzleId: data.puzzle.id,
                rating: data.puzzle.rating,
                isLoaded: true,
            })

            if (!isInitial) {
                plausibleEvent('checklist:new-puzzle')
            }
        } catch (error) {
            notifications.show({
                message: 'Failed to load puzzle. Please try again.',
                color: 'red',
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Handle URL changes
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const puzzleId = params.get('puzzle')

        const loadPuzzle = async (id: string) => {
            setIsLoading(true)
            try {
                // Reset game state before loading new puzzle
                setIsComplete(false)
                setShowRemainingCount(false)
                setElapsedTime(0)
                setIsActive(false)
                setSelectedSquare(null)
                setSquareStyles({})

                const data = await loadPuzzleById(id)
                const chess = new Chess()
                const moves = data.game.pgn.split(' ')
                moves.forEach((move: string) => {
                    if (move.match(/^\d+\./) || move === '') return
                    try {
                        chess.move(move)
                    } catch (e) {
                        console.error('Invalid move:', move)
                    }
                })

                const fen = chess.fen()
                const playerColor = chess.turn()
                const { checks, captures } = calculateMoves(fen)

                setGameState({
                    fen,
                    phase: 'checks',
                    remainingChecks: checks,
                    remainingCaptures: captures,
                    foundMoves: [],
                    playerColor,
                    puzzleId: data.puzzle.id,
                    rating: data.puzzle.rating,
                    isLoaded: true,
                })
                // Start timer after puzzle is loaded
                setIsActive(true)
            } catch (error) {
                notifications.show({
                    message: 'Failed to load puzzle. Please try again.',
                    color: 'red',
                })
                // Clear the invalid puzzle ID from URL
                navigate('/', { replace: true })
            } finally {
                setIsLoading(false)
            }
        }

        if (!puzzleId) {
            generateNewPuzzle(true).then(() => {
                setIsActive(true)
            })
        } else if (puzzleId !== gameState.puzzleId) {
            // Load the specific puzzle
            loadPuzzle(puzzleId)
        }
    }, [location.search])

    // Check if a piece can be moved (must be player's color)
    const isDraggablePiece = ({ piece }: { piece: Piece }) => {
        if (isComplete) return false // Prevent dragging when puzzle is complete
        return piece.charAt(0) === gameState.playerColor
    }

    // Calculate all possible checks and captures for a position
    const calculateMoves = (fen: string) => {
        const chess = new Chess(fen)
        const checks: Move[] = []
        const captures: Move[] = []

        // Get all possible moves
        const moves = chess.moves({ verbose: true })

        // Categorize moves
        moves.forEach(move => {
            const testChess = new Chess(fen)
            testChess.move({ from: move.from, to: move.to })

            if (testChess.inCheck()) {
                checks.push({ from: move.from as Square, to: move.to as Square })
            }
            if (move.captured) {
                captures.push({ from: move.from as Square, to: move.to as Square })
            }
        })

        return { checks, captures }
    }

    // Handle piece movement (both click and drag)
    const handleMove = (from: Square, to: Square) => {
        // Prevent moves if puzzle is complete
        if (isComplete) return

        // First check if this is a legal move for the piece
        if (!isLegalMove(from, to)) {
            return // Silently ignore illegal moves
        }

        const move = { from, to }
        const currentPhase = gameState.phase
        const remainingMoves = currentPhase === 'checks' ? gameState.remainingChecks : gameState.remainingCaptures

        const isMoveValid = remainingMoves.some(m => m.from === move.from && m.to === move.to)

        if (isMoveValid && !gameState.foundMoves.some(m => m.from === from && m.to === to)) {
            // Determine if the move is a capture
            const chess = new Chess(gameState.fen)
            const verboseMove = chess.moves({ verbose: true }).find(m => m.from === from && m.to === to)
            const isCapture = verboseMove?.captured

            // Play different sounds based on the phase and if it's a capture
            if (gameState.phase === 'checks' && isCapture) {
                captureSound.play()
            } else if (gameState.phase === 'checks') {
                moveSound.play()
            } else {
                captureSound.play()
            }

            setCorrectSquare(to)
            setTimeout(() => {
                setCorrectSquare(null)
            }, 1000)

            const newFoundMoves = [...gameState.foundMoves, move]
            setGameState(prev => ({
                ...prev,
                foundMoves: newFoundMoves,
            }))
        } else if (isLegalMove(from, to)) {
            // Only show invalid feedback for legal moves that aren't valid for the current phase
            setInvalidSquare(to)
            setTimeout(() => {
                setInvalidSquare(null)
            }, 1000)
        }
    }

    // Handle piece drop (drag and drop)
    const onPieceDrop = (sourceSquare: Square, targetSquare: Square) => {
        handleMove(sourceSquare, targetSquare)
        // Clear any existing highlights
        setSquareStyles({})
        return false // Always return false to prevent actual piece movement
    }

    // Add this helper function to check if a move is possible for a piece
    const isLegalMove = (from: Square, to: Square): boolean => {
        const chess = new Chess(gameState.fen)
        const moves = chess.moves({ square: from, verbose: true })
        return moves.some(move => move.to === to)
    }

    // Handle square click (click to move)
    const onSquareClick = (square: Square) => {
        if (isComplete) return

        const chess = new Chess(gameState.fen)
        const piece = chess.get(square)

        if (selectedSquare === null) {
            // First click - check if square has a piece of player's color
            if (piece && piece.color === gameState.playerColor) {
                setSelectedSquare(square)
                setSquareStyles({
                    [square]: {
                        backgroundColor: 'rgba(255, 255, 0, 0.4)',
                    },
                })
            }
        } else {
            // Second click
            if (square === selectedSquare) {
                // Clicking the same square - deselect
                setSelectedSquare(null)
                setSquareStyles({})
            } else if (piece && piece.color === gameState.playerColor) {
                // Clicking another piece of the same color - select the new piece
                setSelectedSquare(square)
                setSquareStyles({
                    [square]: {
                        backgroundColor: 'rgba(255, 255, 0, 0.4)',
                    },
                })
            } else {
                // Only attempt the move if it's a legal destination
                if (isLegalMove(selectedSquare, square)) {
                    handleMove(selectedSquare, square)
                }
                // Clear selection
                setSelectedSquare(null)
                setSquareStyles({})
            }
        }
    }

    // Calculate remaining moves for current phase
    const getRemainingMoves = () => {
        const currentMoves = gameState.phase === 'checks' ? gameState.remainingChecks : gameState.remainingCaptures
        return (
            currentMoves.length -
            gameState.foundMoves.filter(m => currentMoves.some(cm => cm.from === m.from && cm.to === m.to)).length
        )
    }

    // Handle new puzzle button click
    const handleNewPuzzleClick = () => {
        // Clear UI state immediately
        setSelectedSquare(null)
        setSquareStyles({})
        setShowRemainingCount(false)
        setShowSolution(false)
        setIsComplete(false)
        setGameState(prev => ({
            ...prev,
            foundMoves: [],
        }))

        // Then generate new puzzle
        generateNewPuzzle(false).then(() => {
            setIsActive(true)
        })
    }

    // Update the square styles to include invalid move highlighting
    const getSquareStyles = () => {
        const styles: CustomSquareStyles = { ...squareStyles }

        // Add styles for found moves
        // gameState.foundMoves.forEach(move => {
        //     styles[move.to] = {
        //         backgroundColor: 'transparent',
        //         boxShadow: 'var(--found-move-outline)',
        //     }
        // })

        // Add animation for invalid move while preserving outline if it's a found move
        if (invalidSquare) {
            const isFoundMove = gameState.foundMoves.some(move => move.to === invalidSquare)
            styles[invalidSquare] = {
                backgroundColor: 'transparent',
                animation: `${classes.blinkRed} 0.3s ease-in-out 2`,
            }
        }

        // Add animation for correct move while preserving the outline
        if (correctSquare) {
            styles[correctSquare] = {
                backgroundColor: 'transparent',
                animation: `${classes.blinkGreen} 0.3s ease-in-out 2`,
            }
        }

        return styles
    }

    // Add helper to convert to standard notation
    const toStandardNotation = (move: Move): string => {
        const chess = new Chess(gameState.fen)
        const verboseMove = chess
            .moves({
                verbose: true,
                square: move.from,
            })
            .find(m => m.to === move.to)

        if (!verboseMove) return ''
        return verboseMove.san
    }

    const handleRulesClose = () => {
        setRulesOpen(false)
        plausibleEvent('checklist:rules-read')
        if (!hasReadRules) {
            localStorage.setItem('checklistChessRulesRead', 'true')
            setHasReadRules(true)
        }
    }

    const handleVerify = () => {
        const remaining = getRemainingMoves()
        if (remaining === 0) {
            if (gameState.phase === 'captures') {
                winSound.play()
                setIsActive(false)
                setIsComplete(true)
                plausibleEvent('checklist:win')
            } else {
                successSound.play()
                setGameState(prev => ({
                    ...prev,
                    phase: 'captures',
                    foundMoves: [],
                }))
                setShowRemainingCount(false)
                plausibleEvent('checklist:phase-complete', {
                    props: {
                        'checklist:phase': 'checks',
                    },
                })
            }
        } else {
            failSound.play()
            notifications.show({
                message: `You have more moves to find!`,
                color: 'red',
            })
            plausibleEvent('checklist:verify-failed', {
                props: {
                    'checklist:phase': gameState.phase,
                },
            })
        }
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
                <Grid justify="center">
                    <Grid.Col span={{ base: 12, md: 5 }}>
                        <Group justify="space-between" align="center" gap={4} h={36}>
                            <Group gap="xs">
                                <IconListDetails size={32} />
                                <Title order={2}>Checklist</Title>
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
                                            localStorage.setItem('checklistChessRulesRead', 'true')
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
                    <Grid.Col span={4} display={{ base: 'none', md: 'block' }} />
                </Grid>

                <Grid justify="center">
                    <Grid.Col span={{ base: 12, md: 5 }}>
                        <Box pos="relative">
                            <Box>
                                <MyChessboard
                                    position={gameState.fen}
                                    onPieceDrop={onPieceDrop}
                                    onSquareClick={onSquareClick}
                                    boardOrientation="white"
                                    isDraggablePiece={isDraggablePiece}
                                    customSquareStyles={getSquareStyles()}
                                />
                            </Box>
                            {gameState.rating && (
                                <Box pos="absolute" bottom={-30} left={0} display={{ base: 'none', md: 'block' }}>
                                    <Text
                                        size="sm"
                                        c="dimmed"
                                        component="a"
                                        href={`https://lichess.org/training/${gameState.puzzleId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ textDecoration: 'none' }}
                                        onClick={() => plausibleEvent('checklist:lichess-link')}
                                    >
                                        <IconLink size={16} style={{ marginRight: 3, marginBottom: -2 }} stroke={1.5} />
                                        Lichess Rating: {gameState.rating}
                                    </Text>
                                </Box>
                            )}
                        </Box>
                        {gameState.rating && (
                            <Box display={{ base: 'block', md: 'none' }} mt="xs" mb={-6}>
                                <Text
                                    size="sm"
                                    c="dimmed"
                                    component="a"
                                    href={`https://lichess.org/training/${gameState.puzzleId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ textDecoration: 'none' }}
                                    onClick={() => plausibleEvent('checklist:lichess-link')}
                                >
                                    <IconLink size={16} style={{ marginRight: 3, marginBottom: -2 }} stroke={1.5} />
                                    Lichess Rating: {gameState.rating}
                                </Text>
                            </Box>
                        )}
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 4 }}>
                        {gameState.isLoaded && (
                            <Stack justify="space-between" h="100%">
                                <Stack gap="md">
                                    <Group
                                        // justify="space-between"
                                        align="flex-start"
                                        // wrap="nowrap"
                                        style={{
                                            flexDirection: isMobile ? 'row' : 'column',
                                        }}
                                    >
                                        {isMobile ? (
                                            <>
                                                <Stack gap="md" mr="lg">
                                                    <Button
                                                        variant="primary"
                                                        size="md"
                                                        onClick={handleVerify}
                                                        disabled={isComplete}
                                                    >
                                                        Verify
                                                    </Button>
                                                    <Box className={classes.phaseIndicator}>
                                                        <Group
                                                            gap="sm"
                                                            wrap="nowrap"
                                                            className={`${classes.phase} ${
                                                                gameState.phase === 'checks' || isComplete
                                                                    ? ''
                                                                    : classes.inactive
                                                            }`}
                                                        >
                                                            <Box
                                                                className={`${classes.checkmark} ${
                                                                    gameState.phase === 'captures' || isComplete
                                                                        ? classes.completed
                                                                        : ''
                                                                }`}
                                                            >
                                                                {(gameState.phase === 'captures' || isComplete) && (
                                                                    <IconCheck size={14} stroke={3} />
                                                                )}
                                                            </Box>
                                                            <Text size={isMobile ? 'md' : 'xl'}>Checks</Text>
                                                        </Group>
                                                        <Group
                                                            gap="sm"
                                                            wrap="nowrap"
                                                            className={`${classes.phase} ${
                                                                gameState.phase === 'captures' || isComplete
                                                                    ? ''
                                                                    : classes.inactive
                                                            }`}
                                                        >
                                                            <Box
                                                                className={`${classes.checkmark} ${
                                                                    isComplete ? classes.completed : ''
                                                                }`}
                                                            >
                                                                {isComplete && <IconCheck size={14} stroke={3} />}
                                                            </Box>
                                                            <Text size={isMobile ? 'md' : 'xl'}>Captures</Text>
                                                        </Group>
                                                    </Box>
                                                </Stack>
                                                <Stack align="center" gap="xs">
                                                    <Box className={classes.kingBackground}>
                                                        {gameState.playerColor === 'w' ? (
                                                            <WhiteKing size={rem(100)} />
                                                        ) : (
                                                            <BlackKing size={rem(100)} />
                                                        )}
                                                    </Box>
                                                    <Text
                                                        size={rem(60)}
                                                        fw={700}
                                                        style={{ fontFamily: 'monospace' }}
                                                        c={isComplete ? 'green' : undefined}
                                                    >
                                                        {formatTime(elapsedTime)}
                                                    </Text>
                                                </Stack>
                                            </>
                                        ) : (
                                            <>
                                                <Stack gap="xs" align="flex-start">
                                                    <Box className={classes.kingBackground}>
                                                        {gameState.playerColor === 'w' ? (
                                                            <WhiteKing size={rem(130)} />
                                                        ) : (
                                                            <BlackKing size={rem(130)} />
                                                        )}
                                                    </Box>
                                                    <Text
                                                        size={rem(60)}
                                                        fw={700}
                                                        style={{ fontFamily: 'monospace' }}
                                                        c={isComplete ? 'green' : undefined}
                                                    >
                                                        {formatTime(elapsedTime)}
                                                    </Text>
                                                </Stack>
                                                <Button
                                                    variant="primary"
                                                    size="md"
                                                    onClick={handleVerify}
                                                    disabled={isComplete}
                                                >
                                                    Verify
                                                </Button>
                                                <Stack gap="xs">
                                                    <Box
                                                        className={classes.phaseIndicator}
                                                        style={{ minWidth: 'fit-content' }}
                                                    >
                                                        <Group
                                                            gap="sm"
                                                            wrap="nowrap"
                                                            className={`${classes.phase} ${
                                                                gameState.phase === 'checks' || isComplete
                                                                    ? ''
                                                                    : classes.inactive
                                                            }`}
                                                        >
                                                            <Box
                                                                className={`${classes.checkmark} ${
                                                                    gameState.phase === 'captures' || isComplete
                                                                        ? classes.completed
                                                                        : ''
                                                                }`}
                                                            >
                                                                {(gameState.phase === 'captures' || isComplete) && (
                                                                    <IconCheck size={14} stroke={3} />
                                                                )}
                                                            </Box>
                                                            <Text size={isMobile ? 'md' : 'xl'}>Checks</Text>
                                                        </Group>
                                                        <Group
                                                            gap="sm"
                                                            wrap="nowrap"
                                                            className={`${classes.phase} ${
                                                                gameState.phase === 'captures' || isComplete
                                                                    ? ''
                                                                    : classes.inactive
                                                            }`}
                                                        >
                                                            <Box
                                                                className={`${classes.checkmark} ${
                                                                    isComplete ? classes.completed : ''
                                                                }`}
                                                            >
                                                                {isComplete && <IconCheck size={14} stroke={3} />}
                                                            </Box>
                                                            <Text size={isMobile ? 'md' : 'xl'}>Captures</Text>
                                                        </Group>
                                                    </Box>

                                                    {!showSolution &&
                                                        gameState.foundMoves.length > 0 &&
                                                        !isComplete && (
                                                            <Stack gap="xs">
                                                                <Group gap="xs" wrap="wrap">
                                                                    {gameState.foundMoves.map((move, index) => (
                                                                        <Badge
                                                                            key={`${move.from}${move.to}${index}`}
                                                                            variant="light"
                                                                            color="green"
                                                                            fz={rem(16)}
                                                                            size="lg"
                                                                            tt="none"
                                                                        >
                                                                            {toStandardNotation(move)}
                                                                        </Badge>
                                                                    ))}
                                                                </Group>
                                                            </Stack>
                                                        )}

                                                    {isComplete && (
                                                        <Text size="xl" fw={700} c="green">
                                                            Puzzle complete! 🎉
                                                        </Text>
                                                    )}
                                                </Stack>
                                            </>
                                        )}
                                    </Group>
                                </Stack>

                                <Stack>
                                    {showSolution && (
                                        <Stack gap="xs">
                                            <Stack gap={4}>
                                                <Text fw={500}>Checks:</Text>
                                                <Group gap="xs" wrap="wrap">
                                                    {gameState.remainingChecks.length > 0 ? (
                                                        gameState.remainingChecks.map((move, index) => (
                                                            <Badge
                                                                key={`check-${move.from}${move.to}${index}`}
                                                                variant="light"
                                                                color={
                                                                    gameState.phase === 'captures' ||
                                                                    gameState.foundMoves.some(
                                                                        m => m.from === move.from && m.to === move.to,
                                                                    )
                                                                        ? 'green'
                                                                        : 'gray'
                                                                }
                                                                fz={rem(16)}
                                                                size="lg"
                                                                tt="none"
                                                            >
                                                                {toStandardNotation(move)}
                                                            </Badge>
                                                        ))
                                                    ) : (
                                                        <Badge variant="transparent" color="gray" tt="none" size="lg">
                                                            None
                                                        </Badge>
                                                    )}
                                                </Group>
                                            </Stack>
                                            <Stack gap={4}>
                                                <Text fw={500}>Captures:</Text>
                                                <Group gap="xs" wrap="wrap">
                                                    {gameState.remainingCaptures.length > 0 ? (
                                                        gameState.remainingCaptures.map((move, index) => (
                                                            <Badge
                                                                key={`capture-${move.from}${move.to}${index}`}
                                                                variant="light"
                                                                color={
                                                                    gameState.phase === 'captures' &&
                                                                    gameState.foundMoves.some(
                                                                        m => m.from === move.from && m.to === move.to,
                                                                    )
                                                                        ? 'green'
                                                                        : 'gray'
                                                                }
                                                                fz={rem(16)}
                                                                size="lg"
                                                                tt="none"
                                                            >
                                                                {toStandardNotation(move)}
                                                            </Badge>
                                                        ))
                                                    ) : (
                                                        <Badge variant="transparent" color="gray" tt="none" size="lg">
                                                            None
                                                        </Badge>
                                                    )}
                                                </Group>
                                            </Stack>
                                        </Stack>
                                    )}

                                    {isMobile && isComplete ? (
                                        <Text size="xl" fw={700} c="green">
                                            Puzzle complete! 🎉
                                        </Text>
                                    ) : (
                                        isMobile &&
                                        !showSolution &&
                                        gameState.foundMoves.length > 0 && (
                                            <Stack gap="xs">
                                                <Group gap="xs" wrap="wrap">
                                                    {gameState.foundMoves.map((move, index) => (
                                                        <Badge
                                                            key={`${move.from}${move.to}${index}`}
                                                            variant="light"
                                                            color="green"
                                                            fz={rem(16)}
                                                            size="lg"
                                                            tt="none"
                                                        >
                                                            {toStandardNotation(move)}
                                                        </Badge>
                                                    ))}
                                                </Group>
                                            </Stack>
                                        )
                                    )}

                                    {showRemainingCount && !showSolution && (
                                        <Text size="lg">Remaining moves: {getRemainingMoves()}</Text>
                                    )}
                                    <Group>
                                        {!showRemainingCount && !showSolution ? (
                                            <Button
                                                variant="outline"
                                                size="md"
                                                onClick={() => {
                                                    setShowRemainingCount(true)
                                                    plausibleEvent('checklist:show-count')
                                                }}
                                                disabled={isComplete}
                                            >
                                                Show Count
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="md"
                                                onClick={() => {
                                                    setShowSolution(true)
                                                    plausibleEvent('checklist:show-solution')
                                                }}
                                                disabled={showSolution}
                                            >
                                                Solution
                                            </Button>
                                        )}
                                        <Button
                                            variant={isComplete ? 'primary' : 'outline'}
                                            size="md"
                                            onClick={handleNewPuzzleClick}
                                            loading={isLoading}
                                        >
                                            New Puzzle
                                        </Button>
                                    </Group>
                                </Stack>
                            </Stack>
                        )}
                    </Grid.Col>
                </Grid>
            </Stack>
            <Modal opened={rulesOpen} onClose={handleRulesClose} title="Checklist Chess Rules" size="md">
                <Text size="sm">Find all checks. Then, find all captures.</Text>
                <ol>
                    <Text size="sm" component="li">
                        In the first phase, find all moves that give a check.
                    </Text>
                    <Text size="sm" component="li">
                        In the second phase, find all moves that capture a piece.
                    </Text>
                    <Text size="sm" component="li">
                        Click "Verify" when you think you've found all moves in the current phase.
                    </Text>
                    <Text size="sm" component="li">
                        Complete both phases to solve the puzzle.
                    </Text>
                </ol>
            </Modal>
        </Center>
    )
}
