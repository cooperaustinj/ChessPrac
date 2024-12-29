import { useState, useEffect } from 'react'
import { Chessboard } from 'react-chessboard'
import { Square, Piece, PromotionPieceOption, PromotionStyle } from 'react-chessboard/dist/chessboard/types'
import classes from './my-chessboard.module.css'

interface CustomSquareStyles {
    [square: string]: {
        backgroundColor?: string
        background?: string
        borderRadius?: string
    }
}

interface MyChessboardProps {
    position: string // FEN string
    onPieceDrop?: (source: Square, target: Square, piece: Piece) => boolean
    onPromotionPieceSelect?: (piece: PromotionPieceOption | undefined, source?: Square, target?: Square) => boolean
    onPromotionCheck?: (sourceSquare: Square, targetSquare: Square, piece: Piece) => boolean
    isDraggablePiece?: (props: { piece: Piece; sourceSquare: Square }) => boolean
    customBoardStyle?: React.CSSProperties
    showPromotionDialog?: boolean
    promotionDialogVariant?: PromotionStyle
    boardOrientation?: 'white' | 'black'
    animationDuration?: number
    onSquareClick?: (square: Square) => void
    customSquareStyles?: {
        [square: string]: {
            backgroundColor?: string
            background?: string
            borderRadius?: string
        }
    }
}

function getPieceAtSquare(position: string, square: Square): Piece | undefined {
    const fenBoard = position.split(' ')[0] // Get board part of FEN
    const ranks = fenBoard.split('/')
    const file = square.charCodeAt(0) - 97 // 'a' -> 0, 'b' -> 1, etc.
    const rank = 8 - parseInt(square[1]) // '1' -> 7, '2' -> 6, etc.

    let fileIndex = 0
    for (let i = 0; i < ranks[rank].length; i++) {
        const char = ranks[rank][i]
        if (isNaN(parseInt(char))) {
            if (fileIndex === file) {
                // Convert FEN piece char to Piece format
                const color = char === char.toUpperCase() ? 'w' : 'b'
                return `${color}${char.toUpperCase()}` as Piece
            }
            fileIndex++
        } else {
            fileIndex += parseInt(char)
        }
    }
    return undefined
}

export function MyChessboard({
    position,
    onPieceDrop,
    onPromotionPieceSelect,
    onPromotionCheck,
    isDraggablePiece,
    showPromotionDialog: externalShowPromotionDialog,
    promotionDialogVariant,
    boardOrientation,
    animationDuration = 0,
    onSquareClick: externalOnSquareClick,
    customSquareStyles,
}: MyChessboardProps) {
    const [moveFrom, setMoveFrom] = useState<Square | null>(null)
    const [moveTo, setMoveTo] = useState<Square | null>(null)
    const [optionSquares, setOptionSquares] = useState<CustomSquareStyles>({})
    const [internalShowPromotionDialog, setInternalShowPromotionDialog] = useState(false)

    const showPromotionDialog = externalShowPromotionDialog ?? internalShowPromotionDialog

    useEffect(() => {
        setMoveFrom(null)
        setMoveTo(null)
        setOptionSquares({})
        setInternalShowPromotionDialog(false)
    }, [position])

    function handleInternalSquareClick(square: Square) {
        if (moveFrom) {
            if (moveFrom === square) {
                setMoveFrom(null)
                setMoveTo(null)
                setOptionSquares({})
                return
            }

            const piece = getPieceAtSquare(position, moveFrom)
            if (!piece) return

            if (onPromotionCheck?.(moveFrom, square, piece)) {
                setMoveTo(square)
                setInternalShowPromotionDialog(true)
                return
            }

            if (onPieceDrop?.(moveFrom, square, piece)) {
                setMoveFrom(null)
                setMoveTo(null)
                setOptionSquares({})
                return
            }

            const newPiece = getPieceAtSquare(position, square)
            if (newPiece && (!isDraggablePiece || isDraggablePiece({ piece: newPiece, sourceSquare: square }))) {
                setMoveFrom(square)
                highlightSquare(square)
                return
            }

            setMoveFrom(null)
            setMoveTo(null)
            setOptionSquares({})
            return
        }

        const piece = getPieceAtSquare(position, square)
        if (piece && (!isDraggablePiece || isDraggablePiece({ piece, sourceSquare: square }))) {
            setMoveFrom(square)
            highlightSquare(square)
        }
    }

    function onPieceDropHandler(sourceSquare: Square, targetSquare: Square, piece: Piece) {
        if (isDraggablePiece && !isDraggablePiece({ piece, sourceSquare })) {
            return false
        }

        if (!sourceSquare || !targetSquare || !piece) {
            setMoveFrom(null)
            setMoveTo(null)
            setOptionSquares({})
            setInternalShowPromotionDialog(false)
            return false
        }

        if (onPromotionCheck?.(sourceSquare, targetSquare, piece)) {
            setMoveFrom(sourceSquare)
            setMoveTo(targetSquare)
            setInternalShowPromotionDialog(true)
            return false
        }

        const result = onPieceDrop?.(sourceSquare, targetSquare, piece) ?? false
        if (result) {
            setMoveFrom(null)
            setMoveTo(null)
            setOptionSquares({})
        }
        return result
    }

    function onPromotionPieceSelectHandler(
        piece: PromotionPieceOption | undefined,
        sourceSquare?: Square,
        targetSquare?: Square,
    ) {
        const source = sourceSquare ?? moveFrom
        const target = targetSquare ?? moveTo

        if (!piece || !source || !target || !onPromotionPieceSelect) {
            setMoveFrom(null)
            setMoveTo(null)
            setOptionSquares({})
            setInternalShowPromotionDialog(false)
            return false
        }

        const result = onPromotionPieceSelect(piece, source, target)
        if (result) {
            setMoveFrom(null)
            setMoveTo(null)
            setOptionSquares({})
            setInternalShowPromotionDialog(false)
        }
        return result
    }

    function highlightSquare(square: Square) {
        const newSquares: CustomSquareStyles = {
            [square]: {
                backgroundColor: 'rgba(255, 255, 0, 0.4)',
            },
        }
        setOptionSquares(newSquares)
    }

    return (
        <div className={classes.chessboardWrapper}>
            <Chessboard
                position={position}
                onSquareClick={externalOnSquareClick || handleInternalSquareClick}
                onPieceDrop={onPieceDropHandler}
                onPromotionPieceSelect={onPromotionPieceSelectHandler}
                isDraggablePiece={isDraggablePiece}
                customSquareStyles={customSquareStyles || optionSquares}
                showPromotionDialog={showPromotionDialog}
                promotionToSquare={moveTo}
                promotionDialogVariant={promotionDialogVariant}
                boardOrientation={boardOrientation}
                animationDuration={animationDuration}
            />
        </div>
    )
}
