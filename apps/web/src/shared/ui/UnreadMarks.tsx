interface UnreadMarksProps {
    mentionCount: number;
    /** What the mark is about, for the screen reader: "el canal general". */
    what: string;
}

// The mark of something unread. A mention stands out from plain activity: a red pill with the count
// instead of the white dot. Mentions do not exist yet (the count is always 0), but the style is ready.
export const UnreadMarks = ({ mentionCount, what }: UnreadMarksProps) =>
    mentionCount > 0 ? (
        <span
            role="img"
            aria-label={`${mentionCount} ${mentionCount === 1 ? 'mención sin leer' : 'menciones sin leer'} en ${what}`}
            className="ml-auto shrink-0 rounded-full px-1.5 text-xs font-bold text-white"
            style={{ background: '#ed4245', minWidth: 18, textAlign: 'center' }}
        >
            {mentionCount}
        </span>
    ) : (
        <span
            role="img"
            aria-label={`Mensajes sin leer en ${what}`}
            className="ml-auto shrink-0 rounded-full"
            style={{ background: '#fff', width: 8, height: 8 }}
        />
    );
