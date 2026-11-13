import Svg, { Path } from 'react-native-svg';

// The same speaker that web shows (lucide Volume2) on the button that mutes someone for me.
export const VolumeIcon = ({ size = 16, color = '#b9bbbe' }: { size?: number; color?: string }) => (
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
    <Path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
    <Path d="M16 9a5 5 0 0 1 0 6" />
    <Path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
  </Svg>
);
