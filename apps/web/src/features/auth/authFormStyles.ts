export const inputStyle = {
    background: '#23272a',
    color: '#ffffff',
    border: '1.5px solid transparent',
    fontFamily: 'Open Sans, sans-serif',
}

export const labelStyle = { fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }

export const focusHandler = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#7289da'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(114,137,218,0.15)'
}

export const blurHandler = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'transparent'
    e.currentTarget.style.boxShadow = 'none'
}

export const httpStatus = (err: unknown): number | undefined =>
    (err as { response?: { status?: number } })?.response?.status
