import React from 'react';
import Svg, { Path } from 'react-native-svg';
import {
  DISCORDIA_VIEWBOX,
  DISCORDIA_DEFAULT_COLOR,
  DISCORDIA_PATH,
} from './constants';

export interface DiscordiaMarkProps {
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
}

export const DiscordiaMark: React.FC<DiscordiaMarkProps> = ({
  width = 32,
  height = 32,
  color = DISCORDIA_DEFAULT_COLOR,
}) => {
  return (
    <Svg width={width} height={height} viewBox={DISCORDIA_VIEWBOX} fill="none">
      <Path d={DISCORDIA_PATH} fill={color} />
    </Svg>
  );
};
