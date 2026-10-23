import Svg, { Path, Rect } from 'react-native-svg';

// The same microphone that web shows on the button that mutes it.
export const MicIcon = ({ size = 20, color = '#b9bbbe' }: { size?: number; color?: string }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M12 19v3" />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <Rect x="9" y="2" width="6" height="13" rx="3" />
  </Svg>
);
