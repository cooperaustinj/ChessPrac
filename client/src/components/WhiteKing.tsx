export function WhiteKing({ size = 72 }: { size?: number | string }) {
    return (
        <div style={{ width: size, height: size }}>
            <svg
                viewBox="0 0 45 45"
                width="100%"
                height="100%"
                style={{
                    display: 'block',
                }}
            >
                <g
                    style={{
                        fill: 'none',
                        fillOpacity: 1,
                        fillRule: 'evenodd',
                        stroke: '#000',
                        strokeWidth: 1.5,
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        strokeMiterlimit: 4,
                        strokeDasharray: 'none',
                        strokeOpacity: 1,
                    }}
                >
                    <path d="M 22.5,11.63 L 22.5,6" style={{ fill: 'none', stroke: '#000', strokeLinejoin: 'miter' }} />
                    <path
                        d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25"
                        style={{ fill: '#fff', fillOpacity: 1, strokeLinecap: 'butt', strokeLinejoin: 'miter' }}
                    />
                    <path
                        d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37"
                        style={{ fill: '#fff', stroke: '#000' }}
                    />
                    <path d="M 20,8 L 25,8" style={{ fill: 'none', stroke: '#000', strokeLinejoin: 'miter' }} />
                    <path
                        d="M 32,29.5 C 32,29.5 40.5,25.5 38.03,19.85 C 34.15,14 25,18 22.5,24.5 L 22.5,26.6 L 22.5,24.5 C 20,18 10.85,14 6.97,19.85 C 4.5,25.5 13,29.5 13,29.5"
                        style={{ fill: 'none', stroke: '#000' }}
                    />
                    <path
                        d="M 12.5,30 C 18,27 27,27 32.5,30 M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5 M 12.5,37 C 18,34 27,34 32.5,37"
                        style={{ fill: 'none', stroke: '#000' }}
                    />
                </g>
            </svg>
        </div>
    )
}
