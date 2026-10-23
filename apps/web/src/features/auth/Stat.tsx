export const Stat = ({ value, label }: { value: string; label: string }) => {
    return (
        <div>
            <p
                className="text-2xl font-black"
                style={{ fontFamily: 'Nunito, sans-serif', color: '#7289da' }}
            >
                {value}
            </p>
            <p className="text-xs mt-0.5" style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}>
                {label}
            </p>
        </div>
    )
}