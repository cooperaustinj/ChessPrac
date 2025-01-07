import { useState, useEffect, useRef } from 'react'
import { Group, Text, Box, UnstyledButton, ActionIcon } from '@mantine/core'
import { IconMenu2, IconListDetails, IconSwords, IconBrandGithub, IconShieldOff } from '@tabler/icons-react'
import { useNavigate, useLocation } from 'react-router-dom'
import classes from './slide-menu.module.css'

export function SlideMenu() {
    const [isOpen, setIsOpen] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    // Determine which route is active
    const isDoubleStrike = location.pathname.startsWith('/double-strike')
    const isChecklist = location.pathname.startsWith('/checklist')
    const isUndefended = location.pathname.startsWith('/undefended')

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                menuRef.current &&
                buttonRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const handleClick = (path: string) => {
        navigate(path)
        setIsOpen(false)
    }

    return (
        <>
            <Group
                bg="dark.6"
                py={6}
                pl={16}
                pr={16}
                style={{
                    borderBottom: '1px solid var(--mantine-color-dark-4)',
                    zIndex: 0,
                    justifyContent: 'space-between',
                }}
            >
                <UnstyledButton ref={buttonRef} onClick={() => setIsOpen(!isOpen)}>
                    <Group gap={6}>
                        <IconMenu2 size={24} />
                        <Text>ChessPrac</Text>
                    </Group>
                </UnstyledButton>
                <ActionIcon
                    variant="subtle"
                    color="gray"
                    component="a"
                    href="https://github.com/cooperaustinj/ChessPrac"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View source on GitHub"
                >
                    <IconBrandGithub size={24} />
                </ActionIcon>
            </Group>

            <Box ref={menuRef} className={`${classes.menuDropdown} ${isOpen ? classes.open : ''}`}>
                <Box
                    mb="xs"
                    className={`${classes.menuItem} ${isDoubleStrike ? classes.active : ''}`}
                    onClick={() => handleClick('/double-strike')}
                >
                    <IconSwords size={20} />
                    <span>Double Strike</span>
                </Box>
                <Box
                    mb="xs"
                    className={`${classes.menuItem} ${isChecklist ? classes.active : ''}`}
                    onClick={() => handleClick('/checklist')}
                >
                    <IconListDetails size={20} />
                    <span>Checklist</span>
                </Box>
                <Box
                    className={`${classes.menuItem} ${isUndefended ? classes.active : ''}`}
                    onClick={() => handleClick('/undefended')}
                >
                    <IconShieldOff size={20} />
                    <span>Undefended</span>
                </Box>
            </Box>
        </>
    )
}
