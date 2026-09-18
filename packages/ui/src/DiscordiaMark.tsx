import React from 'react';
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
  className,
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox={DISCORDIA_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d={DISCORDIA_PATH} fill={color} />
    </svg>
  );
};
