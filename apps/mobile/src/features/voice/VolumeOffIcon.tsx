import Svg, { Path } from 'react-native-svg';
import { VOICE_TEXTS } from '@discordia/core';

// The same crossed-out speaker that web shows (lucide VolumeX) for someone muted on this device.
// `labelled` is off inside the button, which has its own label, so only the indicator is found by it.
export const VolumeOffIcon = ({
  size = 16,
  color = '#ed4245',
  labelled = true,
}: {
  size?: number;
  color?: string;
  labelled?: boolean;
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    accessibilityLabel={labelled ? VOICE_TEXTS.locallyMuted : undefined}
  >
    <Path d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z" />
    <Path d="m16.5 14.5 5-5" />
    <Path d="m16.5 9.5 5 5" />
  </Svg>
);
