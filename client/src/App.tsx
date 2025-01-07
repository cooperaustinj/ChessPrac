import { createTheme, MantineProvider, rem, Button, Stack, Title, Container } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { DoubleStrikeChess } from './double-strike/double-strike-chess'
import { ChecklistChess } from './checklist/checklist-chess'
import { UndefendedChess } from './undefended/undefended-chess'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { SlideMenu } from './components/slide-menu'

const theme = createTheme({
    fontSizes: {
        xs: rem(10),
        sm: rem(16),
        md: rem(20),
        lg: rem(24),
        xl: rem(26),
    },
})

function HomePage() {
    return (
        <Container size="sm" style={{ marginTop: '20vh' }}>
            <Stack align="center" gap="xl">
                <Title order={1}>ChessPrac</Title>
                <Stack w={300} gap="xl">
                    <Button component={Link} to="/double-strike" size="xl" fullWidth>
                        Double Strike
                    </Button>
                    <Button component={Link} to="/checklist" size="xl" fullWidth>
                        Checklist
                    </Button>
                    <Button component={Link} to="/undefended" size="xl" fullWidth>
                        Undefended
                    </Button>
                </Stack>
            </Stack>
        </Container>
    )
}

export function App() {
    return (
        <MantineProvider theme={theme} defaultColorScheme="dark">
            <BrowserRouter>
                <SlideMenu />
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/double-strike" element={<DoubleStrikeChess />} />
                    <Route path="/checklist" element={<ChecklistChess />} />
                    <Route path="/undefended" element={<UndefendedChess />} />
                </Routes>
                <Notifications limit={1} position="top-center" />
            </BrowserRouter>
        </MantineProvider>
    )
}

export default App
