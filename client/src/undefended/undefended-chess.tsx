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
} from '@mantine/core'
import { IconShieldOff, IconCheck, IconInfoCircle, IconLink } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { MyChessboard } from '../components/my-chessboard'
import { Square } from 'react-chessboard/dist/chessboard/types'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMediaQuery, useDocumentTitle } from '@mantine/hooks'
import classes from './undefended-chess.module.css'
import { plausibleEvent } from '../plausible'

type GameState = {
    fen: string
    undefendedSquares: Square[]
    foundSquares: Square[]
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
        plausibleEvent('undefended:puzzle-load-failed')
        throw new Error('Failed to load puzzle')
    }
    const data = await response.json()
    return data
}

// Helper function to determine if a square is defended
const isSquareDefended = (chess: Chess, square: Square, color: 'w' | 'b'): boolean => {
    const tempChess = new Chess(chess.fen())
    const piece = tempChess.get(square)
    if (!piece) return false

    // Remove the original piece
    tempChess.remove(square)

    // If we're checking a white piece, place a black piece and look for white attackers
    // If we're checking a black piece, place a white piece and look for black attackers
    const oppositeColor = color === 'w' ? 'b' : 'w'
    tempChess.put({ type: piece.type, color: oppositeColor }, square)

    // Critical fix: Set the turn to the color we're checking for defenders
    const newFen = tempChess.fen().replace(/ [wb] /, ` ${color} `)
    tempChess.load(newFen)

    // Look for pieces of the original color that can capture it
    const moves = tempChess.moves({ verbose: true })
    return moves.some(
        move => move.to === square && move.flags.includes('c') && tempChess.get(move.from)?.color === color,
    )
}

// Find all undefended pieces of both colors
const findUndefendedSquares = (fen: string): Square[] => {
    const chess = new Chess(fen)
    const undefended: Square[] = []

    chess.board().forEach((row, i) => {
        row.forEach((piece, j) => {
            if (piece) {
                // Skip kings and pawns, only include major and minor pieces
                if (piece.type === 'k' || piece.type === 'p') return

                const square = `${String.fromCharCode(97 + j)}${8 - i}` as Square
                if (!isSquareDefended(chess, square, piece.color)) {
                    undefended.push(square)
                }
            }
        })
    })

    return undefended
}

// Add a helper function to play sounds
const playSound = (sound: HTMLAudioElement) => {
    sound.pause()
    sound.currentTime = 0
    sound.play()
}

// Add this helper function
const isEitherKingInCheck = (fen: string): boolean => {
    const chess = new Chess(fen)

    // Check white king
    const whiteInCheck = chess.inCheck()

    // Switch turn to black and check black king
    const blackFen = chess.fen().replace(/ w /, ' b ')
    chess.load(blackFen)
    const blackInCheck = chess.inCheck()

    return whiteInCheck || blackInCheck
}

export function UndefendedChess() {
    useDocumentTitle('Undefended | ChessPrac')
    const navigate = useNavigate()
    const location = useLocation()
    const [gameState, setGameState] = useState<GameState>({
        fen: '',
        undefendedSquares: [],
        foundSquares: [],
        isLoaded: false,
    })
    const [isLoading, setIsLoading] = useState(false)
    const [squareStyles, setSquareStyles] = useState<CustomSquareStyles>({})
    const [elapsedTime, setElapsedTime] = useState(0)
    const [isActive, setIsActive] = useState(false)
    const [invalidSquare, setInvalidSquare] = useState<Square | null>(null)
    const [correctSquare, setCorrectSquare] = useState<Square | null>(null)
    const [showRemainingCount, setShowRemainingCount] = useState(false)
    const [isComplete, setIsComplete] = useState(false)
    const [rulesOpen, setRulesOpen] = useState(false)
    const [hasReadRules, setHasReadRules] = useState(() => {
        return localStorage.getItem('undefendedChessRulesRead') === 'true'
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
            let validPuzzleFound = false
            let attempts = 0
            const maxAttempts = 10 // Prevent infinite loops

            while (!validPuzzleFound && attempts < maxAttempts) {
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

                // Skip this puzzle if either king is in check
                if (isEitherKingInCheck(fen)) {
                    attempts++
                    continue
                }

                const undefendedSquares = findUndefendedSquares(fen)

                if (!isInitial || !location.search) {
                    const searchParams = new URLSearchParams()
                    searchParams.set('puzzle', data.puzzle.id)
                    navigate(`?${searchParams.toString()}`, { replace: isInitial })
                }

                setElapsedTime(0)
                setIsActive(false)

                setGameState({
                    fen,
                    undefendedSquares,
                    foundSquares: [],
                    puzzleId: data.puzzle.id,
                    rating: data.puzzle.rating,
                    isLoaded: true,
                })

                if (!isInitial) {
                    plausibleEvent('undefended:new-puzzle')
                }

                validPuzzleFound = true
            }

            if (!validPuzzleFound) {
                throw new Error('Could not find valid puzzle after multiple attempts')
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
                setIsComplete(false)
                setShowRemainingCount(false)
                setElapsedTime(0)
                setIsActive(false)
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

                // If either king is in check, generate a new puzzle instead
                if (isEitherKingInCheck(fen)) {
                    await generateNewPuzzle(false)
                    return
                }

                const undefendedSquares = findUndefendedSquares(fen)

                setGameState({
                    fen,
                    undefendedSquares,
                    foundSquares: [],
                    puzzleId: data.puzzle.id,
                    rating: data.puzzle.rating,
                    isLoaded: true,
                })
                setIsActive(true)
            } catch (error) {
                notifications.show({
                    message: 'Failed to load puzzle. Please try again.',
                    color: 'red',
                })
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
            loadPuzzle(puzzleId)
        }
    }, [location.search])

    const handleSquareClick = (square: Square) => {
        if (isComplete) return
        if (gameState.foundSquares.includes(square)) return

        const chess = new Chess(gameState.fen)
        const piece = chess.get(square)

        // Only allow clicking squares with pieces (not empty squares)
        if (!piece) return

        // Don't allow clicking kings or pawns
        if (piece.type === 'k' || piece.type === 'p') return

        if (gameState.undefendedSquares.includes(square)) {
            playSound(successSound)
            setCorrectSquare(square)
            setTimeout(() => {
                setCorrectSquare(null)
            }, 1000)

            const newFoundSquares = [...gameState.foundSquares, square]
            setGameState(prev => ({
                ...prev,
                foundSquares: newFoundSquares,
            }))
        } else {
            playSound(failSound)
            setInvalidSquare(square)
            setTimeout(() => {
                setInvalidSquare(null)
            }, 1000)
        }
    }

    const handleVerify = () => {
        const remaining = gameState.undefendedSquares.length - gameState.foundSquares.length
        if (remaining === 0) {
            playSound(winSound)
            setIsActive(false)
            setIsComplete(true)
            plausibleEvent('undefended:win')
        } else {
            playSound(failSound)
            notifications.show({
                message: `You have more pieces to find!`,
                color: 'red',
            })
            plausibleEvent('undefended:verify-failed')
        }
    }

    const getSquareStyles = () => {
        const styles: CustomSquareStyles = {}

        // Add permanent highlight for found squares
        gameState.foundSquares.forEach(square => {
            styles[square] = {
                backgroundColor: 'rgba(76, 175, 80, 0.4)',
            }
        })

        // Add animation for invalid square
        if (invalidSquare) {
            styles[invalidSquare] = {
                animation: `${classes.blinkRed} 0.3s ease-in-out 2`,
            }
        }

        // Add animation for correct square
        if (correctSquare) {
            styles[correctSquare] = {
                animation: `${classes.blinkGreen} 0.3s ease-in-out 2`,
            }
        }

        return styles
    }

    const handleNewPuzzleClick = () => {
        setSquareStyles({})
        setShowRemainingCount(false)
        setShowSolution(false)
        setIsComplete(false)
        setGameState(prev => ({
            ...prev,
            foundSquares: [],
        }))

        generateNewPuzzle(false).then(() => {
            setIsActive(true)
        })
    }

    const handleRulesClose = () => {
        setRulesOpen(false)
        plausibleEvent('undefended:rules-read')
        if (!hasReadRules) {
            localStorage.setItem('undefendedChessRulesRead', 'true')
            setHasReadRules(true)
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
                                <IconShieldOff size={32} />
                                <Title order={2}>Undefended</Title>
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
                                            localStorage.setItem('undefendedChessRulesRead', 'true')
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
                                    onSquareClick={handleSquareClick}
                                    boardOrientation="white"
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
                                        onClick={() => plausibleEvent('undefended:lichess-link')}
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
                                    onClick={() => plausibleEvent('undefended:lichess-link')}
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
                                        align="flex-start"
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
                                                </Stack>
                                                <Stack align="center" gap="xs">
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
                                            </>
                                        )}
                                    </Group>

                                    {isComplete && (
                                        <Text size="xl" fw={700} c="green">
                                            Puzzle complete! 🎉
                                        </Text>
                                    )}

                                    {showRemainingCount && !showSolution && !isComplete && (
                                        <Text size="lg">
                                            Remaining pieces:{' '}
                                            {gameState.undefendedSquares.length - gameState.foundSquares.length}
                                        </Text>
                                    )}

                                    {showSolution && (
                                        <Stack gap="xs">
                                            <Text fw={500}>Undefended pieces:</Text>
                                            <Group gap="xs" wrap="wrap">
                                                {gameState.undefendedSquares.map((square, index) => (
                                                    <Badge
                                                        key={square}
                                                        variant="light"
                                                        color={
                                                            gameState.foundSquares.includes(square) ? 'green' : 'gray'
                                                        }
                                                        size="lg"
                                                    >
                                                        {square}
                                                    </Badge>
                                                ))}
                                            </Group>
                                        </Stack>
                                    )}
                                </Stack>

                                <Group>
                                    {!showRemainingCount && !showSolution ? (
                                        <Button
                                            variant="outline"
                                            size="md"
                                            onClick={() => {
                                                setShowRemainingCount(true)
                                                plausibleEvent('undefended:show-count')
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
                                                plausibleEvent('undefended:show-solution')
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
                        )}
                    </Grid.Col>
                </Grid>
            </Stack>
            <Modal opened={rulesOpen} onClose={handleRulesClose} title="Undefended Chess Rules" size="md">
                <Text size="sm">Find all undefended pieces on the board.</Text>
                <ol>
                    <Text size="sm" component="li">
                        Click on any piece that has no defenders.
                    </Text>
                    <Text size="sm" component="li">
                        A piece is undefended if no friendly piece can capture its square.
                    </Text>
                    <Text size="sm" component="li">
                        Find all undefended pieces of both colors to complete the puzzle.
                    </Text>
                </ol>
            </Modal>
        </Center>
    )
}
