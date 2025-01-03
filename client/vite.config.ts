import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
    plugins: [tsconfigPaths(), react()],
    server: {
        port: 3001,
    },
    // css: {
    //     preprocessorOptions: {
    //         scss: {
    //             additionalData: `@import "./src/_mantine";`,
    //         },
    //     },
    // },
})
